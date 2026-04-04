import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  getOptionalFlagValue,
  getRequiredFlagValue,
  parseArgv
} from "./lib/argv.mjs";
import {
  OutputValidationError,
  SchemaValidationError,
  SourceResolveError
} from "./lib/errors.mjs";
import { resolveRepoTask } from "./lib/git.mjs";
import { inspectReposInput, loadAndValidateReposInput } from "./lib/input-validation.mjs";
import {
  buildDefaultWorkPaths,
  normalizeRequestMarkdown,
} from "./lib/request-normalization.mjs";
import { resolveRuntimePaths } from "./lib/runtime-paths.mjs";
import { assertSchemaValue, loadSchemaRegistry } from "./lib/schema-registry.mjs";
import { loadYamlFile, renderYaml } from "./lib/yaml-file.mjs";

const execFileAsync = promisify(execFile);
const runtimePaths = resolveRuntimePaths(import.meta.url);

await main(process.argv.slice(2));

function printHelp() {
  console.log(
    [
      "Cartographer 中文批处理执行器",
      "",
      "normalize --request <path> --output <path> [--overwrite]",
      "validate-input --input <path>",
      "prepare --input <path> [--batch-id <id>]",
      "run --input <path> [--batch-id <id>] [--confirm-overwrite]"
    ].join("\n")
  );
}

function createBatchId() {
  return new Date().toISOString().replaceAll(":", "-");
}

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

async function pathExists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function normalizeRequestToReposFile(parsedArgv, schemaRegistry) {
  const requestFilePath = path.resolve(getRequiredFlagValue(parsedArgv, "request"));
  const outputFilePath = path.resolve(getRequiredFlagValue(parsedArgv, "output"));
  const overwrite = parsedArgv.booleans.has("overwrite");

  if ((await pathExists(outputFilePath)) && !overwrite) {
    throw new Error(
      `输出文件已存在：${outputFilePath}。如需覆盖，请带上 --overwrite 重试。`
    );
  }

  const requestMarkdown = await readFile(requestFilePath, "utf8");
  const reposInput = normalizeRequestMarkdown(requestMarkdown, {
    defaults: buildDefaultWorkPaths(outputFilePath),
  });
  assertSchemaValue(schemaRegistry, "repos.schema.json", reposInput, "整理后的 repos 输入");
  await ensureDir(path.dirname(outputFilePath));
  await writeFile(outputFilePath, renderYaml(reposInput), "utf8");

  return {
    requestPath: requestFilePath,
    outputPath: outputFilePath,
    repoCount: reposInput.repos.length
  };
}

async function validateInput(parsedArgv, schemaRegistry) {
  const inputFilePath = path.resolve(getRequiredFlagValue(parsedArgv, "input"));
  const reposInput = await loadAndValidateReposInput(inputFilePath, schemaRegistry);
  const inspection = await inspectReposInput(reposInput);

  return {
    inputPath: inputFilePath,
    repoCount: inspection.repoCount,
    warningCount: inspection.warnings.length,
    warnings: inspection.warnings,
    repos: inspection.repos
  };
}

async function runCartographerJson(args) {
  const result = await execFileAsync(process.execPath, [
    path.join(runtimePaths.toolsDir, "cartographer-cli.mjs"),
    ...args
  ]);
  return JSON.parse(result.stdout);
}

async function writeDiscoveryAndDecisionTemplates(batchContext, repoTask, resolvedRepoPath, schemaRegistry) {
  const analysisDir = path.join(batchContext.analysisRoot, batchContext.batchId, repoTask.target_slug);
  await ensureDir(analysisDir);

  const discoverArgs = ["discover", "--repo", resolvedRepoPath, "--json"];

  if (repoTask.ref !== undefined) {
    discoverArgs.push("--ref", repoTask.ref);
  }

  const discoveryPayload = await runCartographerJson(discoverArgs);
  assertSchemaValue(
    schemaRegistry,
    "discovery-graph.schema.json",
    discoveryPayload,
    `${repoTask.target_slug} 的 discovery 结果`
  );
  await writeFile(
    path.join(analysisDir, "discovery.json"),
    `${JSON.stringify(discoveryPayload, null, 2)}\n`,
    "utf8"
  );

  const variablePath = path.join(analysisDir, "variable-decisions.yaml");
  if (!(await pathExists(variablePath))) {
    await writeFile(
      variablePath,
      renderYaml({
        schema_version: 1,
        variables: []
      }),
      "utf8"
    );
  }

  const rollingPath = path.join(analysisDir, "rolling-decisions.yaml");
  if (!(await pathExists(rollingPath))) {
    await writeFile(
      rollingPath,
      renderYaml({
        schema_version: 1,
        rolling_paths: [],
        exclude_paths: [],
        notes: []
      }),
      "utf8"
    );
  }

  const notesPath = path.join(analysisDir, "curation-notes.md");
  if (!(await pathExists(notesPath))) {
    await writeFile(
      notesPath,
      [
        "# Curation Notes",
        "",
        "- 记录每个变量为什么被提取。",
        "- 记录每个 rolling file 或 rolling block 为什么被排除在复用模板之外。",
        "- 不要把这个文件复制进生成出来的 harness 模板。"
      ].join("\n"),
      "utf8"
    );
  }
}

async function loadDecisionFiles(analysisDir, schemaRegistry) {
  const variableFile = path.join(analysisDir, "variable-decisions.yaml");
  const rollingFile = path.join(analysisDir, "rolling-decisions.yaml");

  const variableRaw = await loadYamlFile(variableFile);
  const rollingRaw = await loadYamlFile(rollingFile);

  return {
    variableFile,
    rollingFile,
    variables: assertSchemaValue(
      schemaRegistry,
      "variable-decisions.schema.json",
      variableRaw,
      `变量判断文件 ${variableFile}`
    ),
    rolling: assertSchemaValue(
      schemaRegistry,
      "rolling-decisions.schema.json",
      rollingRaw,
      `rolling 判断文件 ${rollingFile}`
    )
  };
}

async function validateMaterializedOutput(outputDir) {
  const requiredFiles = [
    ".harness/template.yaml",
    ".orbit/orbits/workspace.yaml",
    "AGENTS.md"
  ];

  for (const requiredFile of requiredFiles) {
    const expectedPath = path.join(outputDir, requiredFile);

    if (!(await pathExists(expectedPath))) {
      throw new OutputValidationError(
        `生成结果缺少必需文件 ${requiredFile}`
      );
    }
  }
}

async function writeRepoReport(reportRoot, batchId, report, schemaRegistry) {
  assertSchemaValue(
    schemaRegistry,
    "repo-report.schema.json",
    report,
    `仓库报告 ${report.targetSlug}`
  );

  const reportDir = path.join(reportRoot, batchId);
  await ensureDir(reportDir);
  const reportPath = path.join(reportDir, `${report.targetSlug}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

function renderBatchSummary(batchId, reports) {
  const successCount = reports.filter((report) => report.status === "success").length;
  const failedCount = reports.length - successCount;

  const lines = [
    `# 批次汇总：${batchId}`,
    "",
    `- 总数：${reports.length}`,
    `- 成功：${successCount}`,
    `- 失败：${failedCount}`,
    ""
  ];

  for (const report of reports) {
    const suffix = report.error === undefined ? "" : ` (${report.error.code}: ${report.error.message})`;
    lines.push(`- ${report.targetSlug}: ${report.status}${suffix}`);
  }

  return `${lines.join("\n")}\n`;
}

async function writeBatchSummary(reportRoot, batchId, reports) {
  const reportDir = path.join(reportRoot, batchId);
  await ensureDir(reportDir);
  const summaryPath = path.join(reportDir, "summary.md");
  await writeFile(summaryPath, renderBatchSummary(batchId, reports), "utf8");
  return summaryPath;
}

function createReportBase(batchContext, repoTask, resolution) {
  return {
    schemaVersion: 1,
    batchId: batchContext.batchId,
    targetSlug: repoTask.target_slug,
    repoLocator: repoTask.repo_locator,
    ref: repoTask.ref ?? null,
    startedAt: new Date().toISOString(),
    cloneDir: resolution?.cloneDir,
    outputDir: path.join(batchContext.outputRoot, repoTask.target_slug)
  };
}

async function prepareBatch(parsedArgv, schemaRegistry) {
  const inputFilePath = path.resolve(getRequiredFlagValue(parsedArgv, "input"));
  const reposInput = await loadAndValidateReposInput(inputFilePath, schemaRegistry);
  const batchId = getOptionalFlagValue(parsedArgv, "batch-id") ?? createBatchId();

  const batchContext = {
    batchId,
    cloneRoot: reposInput.defaults.cloneRoot,
    analysisRoot: reposInput.defaults.analysisRoot
  };

  await ensureDir(batchContext.analysisRoot);

  try {
    for (const repoTask of reposInput.repos) {
      const resolution = await resolveRepoTask(batchContext, repoTask);
      await writeDiscoveryAndDecisionTemplates(
        batchContext,
        repoTask,
        resolution.resolvedRepoPath,
        schemaRegistry
      );
    }
  } finally {
    await rm(path.join(batchContext.cloneRoot, batchContext.batchId), {
      force: true,
      recursive: true
    });
  }

  return {
    batchId,
    analysisRoot: batchContext.analysisRoot
  };
}

async function runBatch(parsedArgv, schemaRegistry) {
  const inputFilePath = path.resolve(getRequiredFlagValue(parsedArgv, "input"));
  const confirmOverwrite = parsedArgv.booleans.has("confirm-overwrite");
  const reposInput = await loadAndValidateReposInput(inputFilePath, schemaRegistry);
  const batchId = getOptionalFlagValue(parsedArgv, "batch-id") ?? createBatchId();

  const batchContext = {
    batchId,
    cloneRoot: reposInput.defaults.cloneRoot,
    analysisRoot: reposInput.defaults.analysisRoot,
    outputRoot: reposInput.defaults.outputRoot,
    planRoot: reposInput.defaults.planRoot,
    reportRoot: reposInput.defaults.reportRoot,
    continueOnError: reposInput.defaults.continueOnError,
    autoApprove: reposInput.defaults.autoApprove
  };

  await ensureDir(batchContext.outputRoot);
  await ensureDir(batchContext.planRoot);
  await ensureDir(batchContext.reportRoot);

  const reports = [];

  try {
    for (const repoTask of reposInput.repos) {
      let resolution;
      const reportBase = createReportBase(batchContext, repoTask);

      try {
        resolution = await resolveRepoTask(batchContext, repoTask);
        const updatedBase = {
          ...reportBase,
          cloneDir: resolution.cloneDir
        };
        const analysisDir = path.join(batchContext.analysisRoot, batchContext.batchId, repoTask.target_slug);
        const outputDir = path.join(batchContext.outputRoot, repoTask.target_slug);
        const planPath = path.join(batchContext.planRoot, batchContext.batchId, `${repoTask.target_slug}.json`);

        const decisions = await loadDecisionFiles(analysisDir, schemaRegistry);

        if (await pathExists(outputDir)) {
          if (!confirmOverwrite) {
            throw new Error(
              `${repoTask.target_slug} 的输出目录已存在；如需覆盖，请带上 --confirm-overwrite 重试`
            );
          }

          await rm(outputDir, { force: true, recursive: true });
        }

        await ensureDir(path.dirname(planPath));

        const bootstrapArgs = [
          "bootstrap",
          "--repo",
          resolution.resolvedRepoPath,
          "--output",
          outputDir,
          "--variables-file",
          decisions.variableFile,
          "--rolling-decisions-file",
          decisions.rollingFile,
          "--json"
        ];

        if (repoTask.ref !== undefined) {
          bootstrapArgs.push("--ref", repoTask.ref);
        }

        if (batchContext.autoApprove) {
          bootstrapArgs.push("--auto-approve");
        }

        if (repoTask.harness_id !== undefined) {
          bootstrapArgs.push("--harness-id", repoTask.harness_id);
        }

        if (repoTask.orbit_id !== undefined) {
          bootstrapArgs.push("--orbit-id", repoTask.orbit_id);
        }

        for (const excludePath of repoTask.exclude_paths ?? []) {
          bootstrapArgs.push("--exclude", excludePath);
        }

        for (const rollingPath of repoTask.rolling_paths ?? []) {
          bootstrapArgs.push("--rolling", rollingPath);
        }

        const bootstrapPayload = await runCartographerJson(bootstrapArgs);
        await writeFile(planPath, `${JSON.stringify(bootstrapPayload.plan, null, 2)}\n`, "utf8");
        await validateMaterializedOutput(outputDir);

        const report = {
          ...updatedBase,
          status: "success",
          finishedAt: new Date().toISOString(),
          outputDir,
          planPath
        };

        await writeRepoReport(batchContext.reportRoot, batchContext.batchId, report, schemaRegistry);
        reports.push(report);
      } catch (error) {
        const report = buildFailureReport(batchContext, repoTask, resolution, reportBase, error);
        await writeRepoReport(batchContext.reportRoot, batchContext.batchId, report, schemaRegistry);
        reports.push(report);

        if (!batchContext.continueOnError) {
          break;
        }
      }
    }
  } finally {
    await rm(path.join(batchContext.cloneRoot, batchContext.batchId), {
      force: true,
      recursive: true
    });
  }

  const summaryPath = await writeBatchSummary(batchContext.reportRoot, batchContext.batchId, reports);

  return {
    batchId: batchContext.batchId,
    summaryPath,
    reports
  };
}

function buildFailureReport(batchContext, repoTask, resolution, reportBase, error) {
  if (error instanceof SourceResolveError) {
    return {
      ...reportBase,
      cloneDir: resolution?.cloneDir,
      status: error.stage === "checkout" ? "failed_checkout" : "failed_clone",
      finishedAt: new Date().toISOString(),
      error: {
        code: error.stage,
        message: error.message
      }
    };
  }

  if (error instanceof SchemaValidationError || error instanceof OutputValidationError) {
    return {
      ...reportBase,
      cloneDir: resolution?.cloneDir,
      status: "failed_validation",
      finishedAt: new Date().toISOString(),
      error: {
        code: "validation",
        message: error.message
      }
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  const isPrecondition = message.includes("输出目录已存在");

  return {
    ...reportBase,
    cloneDir: resolution?.cloneDir,
    status: isPrecondition ? "failed_precondition" : "failed_bootstrap",
    finishedAt: new Date().toISOString(),
    error: {
      code: isPrecondition ? "precondition" : "bootstrap",
      message
    }
  };
}

function writeOutput(parsedArgv, payload) {
  if (parsedArgv.booleans.has("json")) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
}

async function main(argv) {
  try {
    const parsedArgv = parseArgv(argv);
    const schemaRegistry = await loadSchemaRegistry({ schemaDir: runtimePaths.schemaDir });

    switch (parsedArgv.command) {
      case null:
      case "help":
        printHelp();
        return;
      case "normalize":
        writeOutput(parsedArgv, await normalizeRequestToReposFile(parsedArgv, schemaRegistry));
        return;
      case "validate-input":
        writeOutput(parsedArgv, await validateInput(parsedArgv, schemaRegistry));
        return;
      case "prepare":
        writeOutput(parsedArgv, await prepareBatch(parsedArgv, schemaRegistry));
        return;
      case "run":
        writeOutput(parsedArgv, await runBatch(parsedArgv, schemaRegistry));
        return;
      default:
        throw new Error(`未知命令：${parsedArgv.command}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}
