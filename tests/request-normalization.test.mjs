import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDefaultWorkPaths,
  deriveTargetSlug,
  normalizeRequestMarkdown
} from "../src/lib/request-normalization.mjs";

test("normalizeRequestMarkdown extracts explicit repo locators and refs from bullet lines", () => {
  const result = normalizeRequestMarkdown(
    [
      "# Task",
      "",
      "- `git@github.com:org/repo-a.git` on `main`",
      "- `https://github.com/org/repo-b.git` ref `release/docs`",
      "- `/absolute/path/to/local-repo`"
    ].join("\n")
  );

  assert.deepEqual(result.repos, [
    {
      repo_locator: "git@github.com:org/repo-a.git",
      ref: "main",
      target_slug: "repo-a"
    },
    {
      repo_locator: "https://github.com/org/repo-b.git",
      ref: "release/docs",
      target_slug: "repo-b"
    },
    {
      repo_locator: "/absolute/path/to/local-repo",
      target_slug: "local-repo"
    }
  ]);
});

test("normalizeRequestMarkdown falls back to a single explicit locator in prose", () => {
  const result = normalizeRequestMarkdown(
    "帮我把 `git@github.com:entireio/cli.git` 这个仓库里的 harness 文档转换为 harness 模板。",
  );

  assert.deepEqual(result.repos, [
    {
      repo_locator: "git@github.com:entireio/cli.git",
      target_slug: "cli",
    },
  ]);
});

test("normalizeRequestMarkdown fails closed on duplicate target slugs", () => {
  assert.throws(
    () =>
      normalizeRequestMarkdown(
        [
          "- `git@github.com:org/repo-a.git`",
          "- `/tmp/repo-a`"
        ].join("\n")
      ),
    /重复的 target_slug/
  );
});

test("normalizeRequestMarkdown fails when no explicit repo locator is present", () => {
  assert.throws(
    () => normalizeRequestMarkdown("Please convert whatever repo I mentioned yesterday."),
    /没有找到明确的 repo locator/
  );
});

test("deriveTargetSlug strips .git and trailing separators", () => {
  assert.equal(deriveTargetSlug("git@github.com:org/example.git"), "example");
  assert.equal(deriveTargetSlug("https://github.com/org/example/"), "example");
  assert.equal(deriveTargetSlug("/absolute/path/to/example"), "example");
});

test("buildDefaultWorkPaths makes defaults relative to the repos file location", () => {
  const defaults = buildDefaultWorkPaths(
    "/tmp/harness-test/work/input/repos.yaml",
  );

  assert.deepEqual(defaults, {
    clone_root: "../cache/clones",
    analysis_root: "../analysis",
    output_root: "../output",
    plan_root: "../plans",
    report_root: "../reports",
  });
});
