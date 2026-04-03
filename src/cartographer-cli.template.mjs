import { readFile } from "node:fs/promises";

import {
  bootstrapRepository,
  discoverSource
} from "__CARTOGRAPHER_SOURCE__";

import {
  getMultiFlagValues,
  getOptionalFlagValue,
  getRequiredFlagValue,
  parseArgv
} from "./lib/argv.mjs";
import { resolveRuntimePaths } from "./lib/runtime-paths.mjs";
import { assertSchemaValue, loadSchemaRegistry } from "./lib/schema-registry.mjs";
import { loadYamlFile } from "./lib/yaml-file.mjs";

const runtimePaths = resolveRuntimePaths(import.meta.url);

await main(process.argv.slice(2));

async function loadVariableDecisions(filePath, schemaRegistry) {
  if (filePath === undefined) {
    return [];
  }

  const raw = await loadYamlFile(filePath);
  const validated = assertSchemaValue(
    schemaRegistry,
    "variable-decisions.schema.json",
    raw,
    `变量判断文件 ${filePath}`
  );

  return validated.variables;
}

async function loadRollingDecisions(filePath, schemaRegistry) {
  if (filePath === undefined) {
    return {
      rollingPaths: [],
      excludePaths: []
    };
  }

  const raw = await loadYamlFile(filePath);
  const validated = assertSchemaValue(
    schemaRegistry,
    "rolling-decisions.schema.json",
    raw,
    `rolling 判断文件 ${filePath}`
  );

  return {
    rollingPaths: validated.rolling_paths,
    excludePaths: validated.exclude_paths
  };
}

function writeOutput(parsedArgv, payload, renderText) {
  if (parsedArgv.booleans.has("json")) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(renderText(payload));
}

function printHelp() {
  console.log(
    [
      "Cartographer 中文操作 bundle",
      "",
      "discover --repo <path> [--ref <ref>] [--json]",
      "bootstrap --repo <path> --output <path> [--ref <ref>] [--auto-approve] [--created-at <iso>] [--harness-id <id>] [--orbit-id <id>] [--exclude <path>]... [--rolling <path>]... [--variables-file <path>] [--rolling-decisions-file <path>] [--json]"
    ].join("\n")
  );
}

async function runDiscover(parsedArgv) {
  const result = await discoverSource({
    repoLocator: getRequiredFlagValue(parsedArgv, "repo"),
    ref: getOptionalFlagValue(parsedArgv, "ref")
  });

  writeOutput(parsedArgv, result, (payload) =>
    [
      "发现完成",
      `- 仓库：${payload.source.rootDir}`,
      `- ref：${payload.source.resolvedRef}`,
      `- 发现文件数：${payload.discovery.discoveredPaths.length}`
    ].join("\n")
  );
}

async function runBootstrap(parsedArgv, schemaRegistry) {
  const variables = await loadVariableDecisions(
    getOptionalFlagValue(parsedArgv, "variables-file"),
    schemaRegistry
  );
  const rollingDecisionFile = await loadRollingDecisions(
    getOptionalFlagValue(parsedArgv, "rolling-decisions-file"),
    schemaRegistry
  );

  const excludePaths = [
    ...getMultiFlagValues(parsedArgv, "exclude"),
    ...rollingDecisionFile.excludePaths
  ];
  const rollingPaths = [
    ...getMultiFlagValues(parsedArgv, "rolling"),
    ...rollingDecisionFile.rollingPaths
  ];

  const result = await bootstrapRepository({
    repoLocator: getRequiredFlagValue(parsedArgv, "repo"),
    ref: getOptionalFlagValue(parsedArgv, "ref"),
    outputDir: getOptionalFlagValue(parsedArgv, "output"),
    autoApprove: parsedArgv.booleans.has("auto-approve"),
    createdAt: getOptionalFlagValue(parsedArgv, "created-at"),
    harnessId: getOptionalFlagValue(parsedArgv, "harness-id"),
    orbitId: getOptionalFlagValue(parsedArgv, "orbit-id"),
    excludePaths,
    rollingPaths,
    variables
  });

  writeOutput(parsedArgv, result, (payload) =>
    [
      "转换完成",
      `- source_type：${payload.sourceType}`,
      `- plan_status：${payload.plan.status}`,
      `- materialized：${payload.materialized?.writtenPaths.length ?? 0}`
    ].join("\n")
  );
}

async function ensureVersionManifest(schemaRegistry) {
  const manifestPath = new URL("../tools/cartographer-version.json", import.meta.url);
  const raw = JSON.parse(await readFile(manifestPath, "utf8"));

  assertSchemaValue(
    schemaRegistry,
    "cartographer-version.schema.json",
    raw,
    "cartographer 版本清单"
  );
}

async function main(argv) {
  try {
    const parsedArgv = parseArgv(argv);
    const schemaRegistry = await loadSchemaRegistry({ schemaDir: runtimePaths.schemaDir });
    await ensureVersionManifest(schemaRegistry);

    switch (parsedArgv.command) {
      case null:
      case "help":
        printHelp();
        return;
      case "discover":
        await runDiscover(parsedArgv);
        return;
      case "bootstrap":
        await runBootstrap(parsedArgv, schemaRegistry);
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
