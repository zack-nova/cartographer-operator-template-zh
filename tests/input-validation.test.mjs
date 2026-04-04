import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { resolveRuntimePaths } from "../src/lib/runtime-paths.mjs";
import { loadSchemaRegistry } from "../src/lib/schema-registry.mjs";
import { inspectReposInput, loadAndValidateReposInput } from "../src/lib/input-validation.mjs";

const runtimePaths = resolveRuntimePaths(import.meta.url);
const schemaRegistryPromise = loadSchemaRegistry({ schemaDir: runtimePaths.schemaDir });
const execFileAsync = promisify(execFile);

test("loadAndValidateReposInput rejects duplicate target slugs", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "cartographer-operator-input-"));
  const reposPath = path.join(tempDir, "repos.yaml");

  await writeFile(
    reposPath,
    [
      "schema_version: 1",
      "defaults:",
      "  clone_root: ./work/cache/clones",
      "  analysis_root: ./work/analysis",
      "  output_root: ./work/output",
      "  plan_root: ./work/plans",
      "  report_root: ./work/reports",
      "  continue_on_error: true",
      "  auto_approve: true",
      "repos:",
      "  - repo_locator: /tmp/repo-a",
      "    target_slug: same",
      "  - repo_locator: /tmp/repo-b",
      "    target_slug: same"
    ].join("\n"),
    "utf8"
  );

  await assert.rejects(
    async () => loadAndValidateReposInput(reposPath, await schemaRegistryPromise),
    /重复的 target_slug/
  );
});

test("inspectReposInput warns when target output already exists", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "cartographer-operator-input-"));
  const localRepo = path.join(tempDir, "source-repo");
  const outputRoot = path.join(tempDir, "work", "output");
  const reposPath = path.join(tempDir, "repos.yaml");

  await mkdir(localRepo, { recursive: true });
  await execFileAsync("git", ["init", localRepo]);
  await mkdir(path.join(outputRoot, "source-repo"), { recursive: true });

  await writeFile(
    reposPath,
    [
      "schema_version: 1",
      "defaults:",
      "  clone_root: ./work/cache/clones",
      "  analysis_root: ./work/analysis",
      `  output_root: ${JSON.stringify("./work/output")}`,
      "  plan_root: ./work/plans",
      "  report_root: ./work/reports",
      "  continue_on_error: true",
      "  auto_approve: true",
      "repos:",
      `  - repo_locator: ${JSON.stringify(localRepo)}`,
      "    target_slug: source-repo"
    ].join("\n"),
    "utf8"
  );

  const reposInput = await loadAndValidateReposInput(reposPath, await schemaRegistryPromise);
  const report = await inspectReposInput(reposInput);

  assert.equal(report.repoCount, 1);
  assert.match(report.warnings[0], /输出目录已存在/);
  assert.equal(report.repos[0].locatorType, "local");
  assert.match(report.repos[0].localRepoRoot, /source-repo$/);
});

test("inspectReposInput warns when resolved work roots still point under work/input", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "cartographer-operator-input-"));
  const localRepo = path.join(tempDir, "source-repo");
  const reposPath = path.join(tempDir, "work", "input", "repos.yaml");

  await mkdir(path.dirname(reposPath), { recursive: true });
  await execFileAsync("git", ["init", localRepo]);

  await writeFile(
    reposPath,
    [
      "schema_version: 1",
      "defaults:",
      "  clone_root: ./work/cache/clones",
      "  analysis_root: ./work/analysis",
      "  output_root: ./work/output",
      "  plan_root: ./work/plans",
      "  report_root: ./work/reports",
      "  continue_on_error: true",
      "  auto_approve: true",
      "repos:",
      `  - repo_locator: ${JSON.stringify(localRepo)}`,
      "    target_slug: source-repo"
    ].join("\n"),
    "utf8"
  );

  const reposInput = await loadAndValidateReposInput(reposPath, await schemaRegistryPromise);
  const report = await inspectReposInput(reposInput);

  assert.ok(report.warnings.some((warning) => warning.includes("work/input")));
});
