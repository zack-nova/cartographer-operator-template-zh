import { constants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";

import { isRemoteLocator, resolveLocalRepoRoot } from "./git.mjs";
import { assertSchemaValue } from "./schema-registry.mjs";
import { loadYamlFile } from "./yaml-file.mjs";

export async function loadAndValidateReposInput(inputFilePath, schemaRegistry) {
  const raw = await loadYamlFile(inputFilePath);
  const validated = assertSchemaValue(
    schemaRegistry,
    "repos.schema.json",
    raw,
    "repos 输入文件"
  );

  assertUniqueTargetSlugs(validated.repos);

  return {
    schemaVersion: validated.schema_version,
    defaults: {
      cloneRoot: resolvePathFromInput(inputFilePath, validated.defaults.clone_root),
      analysisRoot: resolvePathFromInput(inputFilePath, validated.defaults.analysis_root),
      outputRoot: resolvePathFromInput(inputFilePath, validated.defaults.output_root),
      planRoot: resolvePathFromInput(inputFilePath, validated.defaults.plan_root),
      reportRoot: resolvePathFromInput(inputFilePath, validated.defaults.report_root),
      continueOnError: validated.defaults.continue_on_error,
      autoApprove: validated.defaults.auto_approve
    },
    repos: validated.repos
  };
}

export async function inspectReposInput(reposInput) {
  const warnings = [];
  const repos = [];

  for (const repoTask of reposInput.repos) {
    const outputDir = path.join(reposInput.defaults.outputRoot, repoTask.target_slug);
    const locatorType = isRemoteLocator(repoTask.repo_locator) ? "remote" : "local";
    let localRepoRoot;

    if (locatorType === "local") {
      try {
        localRepoRoot = await resolveLocalRepoRoot(repoTask.repo_locator);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `${repoTask.target_slug} 的本地 repo locator 无效：${repoTask.repo_locator}。${message}`
        );
      }
    }

    if (await pathExists(outputDir)) {
      warnings.push(
        `${repoTask.target_slug} 的输出目录已存在：${outputDir}`
      );
    }

    repos.push({
      targetSlug: repoTask.target_slug,
      repoLocator: repoTask.repo_locator,
      ref: repoTask.ref ?? null,
      locatorType,
      outputDir,
      ...(localRepoRoot === undefined ? {} : { localRepoRoot })
    });
  }

  return {
    repoCount: repos.length,
    warnings,
    repos
  };
}

export function assertUniqueTargetSlugs(repos) {
  const seen = new Set();

  for (const repo of repos) {
    if (seen.has(repo.target_slug)) {
      throw new Error(`repos 输入中存在重复的 target_slug：${repo.target_slug}`);
    }

    seen.add(repo.target_slug);
  }
}

function resolvePathFromInput(inputFilePath, configuredPath) {
  return path.resolve(path.dirname(inputFilePath), configuredPath);
}

async function pathExists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
