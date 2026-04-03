import test from "node:test";
import assert from "node:assert/strict";

import { resolveRuntimePaths } from "../src/lib/runtime-paths.mjs";
import {
  assertSchemaValue,
  loadSchemaRegistry
} from "../src/lib/schema-registry.mjs";

const runtimePaths = resolveRuntimePaths(import.meta.url);
const schemaRegistryPromise = loadSchemaRegistry({ schemaDir: runtimePaths.schemaDir });

test("repos schema accepts batch-level defaults and rejects per-repo strategy overrides", async () => {
  const schemaRegistry = await schemaRegistryPromise;

  const validInput = {
    schema_version: 1,
    defaults: {
      clone_root: "./work/cache/clones",
      analysis_root: "./work/analysis",
      output_root: "./work/output",
      plan_root: "./work/plans",
      report_root: "./work/reports",
      continue_on_error: true,
      auto_approve: true
    },
    repos: [
      {
        repo_locator: "git@github.com:org/example.git",
        target_slug: "example"
      }
    ]
  };

  assert.deepEqual(
    assertSchemaValue(schemaRegistry, "repos.schema.json", validInput, "repos input"),
    validInput
  );

  assert.throws(
    () =>
      assertSchemaValue(
        schemaRegistry,
        "repos.schema.json",
        {
          ...validInput,
          repos: [
            {
              repo_locator: "git@github.com:org/example.git",
              target_slug: "example",
              auto_approve: false
            }
          ]
        },
        "repos input"
      ),
    /auto_approve/
  );
});

test("variable decisions schema rejects invalid variable names", async () => {
  const schemaRegistry = await schemaRegistryPromise;

  assert.throws(
    () =>
      assertSchemaValue(
        schemaRegistry,
        "variable-decisions.schema.json",
        {
          schema_version: 1,
          variables: [
            {
              name: "Bad-Name",
              replacements: [{ path: "AGENTS.md", literal: "Example" }]
            }
          ]
        },
        "variable decisions file"
      ),
    /pattern/
  );
});

test("rolling decisions schema requires explicit arrays", async () => {
  const schemaRegistry = await schemaRegistryPromise;

  assert.throws(
    () =>
      assertSchemaValue(
        schemaRegistry,
        "rolling-decisions.schema.json",
        {
          schema_version: 1,
          rolling_paths: "docs/status.md",
          exclude_paths: []
        },
        "rolling decisions file"
      ),
    /must be array/
  );
});
