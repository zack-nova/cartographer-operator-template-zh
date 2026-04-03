import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

test("bundled CLIs print help", async () => {
  const cartographerHelp = await execFileAsync(process.execPath, [
    path.join(repoRoot, "tools", "cartographer-cli.mjs"),
    "help"
  ]);
  const batchHelp = await execFileAsync(process.execPath, [
    path.join(repoRoot, "tools", "run-batch.mjs"),
    "help"
  ]);

  assert.match(cartographerHelp.stdout, /Cartographer 中文操作 bundle/);
  assert.match(batchHelp.stdout, /Cartographer 中文批处理执行器/);
  assert.match(batchHelp.stdout, /normalize --request <path> --output <path>/);
  assert.match(batchHelp.stdout, /validate-input --input <path>/);
});

test("prepare fails fast when repos input violates schema", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "cartographer-operator-test-"));
  const reposPath = path.join(tempDir, "repos.yaml");

  await writeFile(
    reposPath,
    [
      "schema_version: 1",
      "defaults:",
      "  clone_root: ./work/cache/clones",
      "repos:",
      "  - repo_locator: /tmp/example",
      "    target_slug: example"
    ].join("\n"),
    "utf8"
  );

  await assert.rejects(
    () =>
      execFileAsync(process.execPath, [
        path.join(repoRoot, "tools", "run-batch.mjs"),
        "prepare",
        "--input",
        reposPath
      ]),
    /repos 输入文件 未通过 repos\.schema\.json 校验/
  );
});

test("normalize writes repos yaml from request markdown", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "cartographer-operator-normalize-"));
  const requestPath = path.join(tempDir, "request.md");
  const reposPath = path.join(tempDir, "repos.yaml");

  await writeFile(
    requestPath,
    [
      "# Request",
      "",
      "- `git@github.com:org/repo-a.git` on `main`",
      "- `/absolute/path/to/local-repo`"
    ].join("\n"),
    "utf8"
  );

  await execFileAsync(process.execPath, [
    path.join(repoRoot, "tools", "run-batch.mjs"),
    "normalize",
    "--request",
    requestPath,
    "--output",
    reposPath
  ]);

  const output = await readFile(reposPath, "utf8");
  assert.match(output, /repo_locator: git@github\.com:org\/repo-a\.git/);
  assert.match(output, /ref: main/);
  assert.match(output, /target_slug: repo-a/);
  assert.match(output, /repo_locator: \/absolute\/path\/to\/local-repo/);
  assert.match(output, /target_slug: local-repo/);
});

test("validate-input rejects duplicate target slugs", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "cartographer-operator-validate-"));
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
      "    target_slug: duplicate",
      "  - repo_locator: /tmp/repo-b",
      "    target_slug: duplicate"
    ].join("\n"),
    "utf8"
  );

  await assert.rejects(
    () =>
      execFileAsync(process.execPath, [
        path.join(repoRoot, "tools", "run-batch.mjs"),
        "validate-input",
        "--input",
        reposPath
      ]),
    /重复的 target_slug/
  );
});
