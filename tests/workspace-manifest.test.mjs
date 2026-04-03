import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { parse as parseYaml } from "yaml";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

test("workspace orbit manifest uses top-level id/description/include fields", async () => {
  const manifestPath = path.join(repoRoot, ".orbit", "orbits", "workspace.yaml");
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));

  assert.equal(manifest.id, "workspace");
  assert.equal(manifest.description, "Cartographer 中文操作工作区");
  assert.ok(Array.isArray(manifest.include));
  assert.ok(manifest.include.includes("AGENTS.md"));
  assert.equal("schema_version" in manifest, false);
  assert.equal("orbit" in manifest, false);
});
