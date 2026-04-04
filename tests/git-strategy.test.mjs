import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRemoteCloneArgs,
  describeRemoteLocator,
} from "../src/lib/git.mjs";

test("buildRemoteCloneArgs uses shallow clone by default", () => {
  assert.deepEqual(
    buildRemoteCloneArgs({
      repoLocator: "https://github.com/org/repo.git",
      cloneDir: "/tmp/repo",
    }),
    ["clone", "--depth", "1", "--progress", "https://github.com/org/repo.git", "/tmp/repo"],
  );
});

test("buildRemoteCloneArgs uses branch-aware shallow clone when ref looks like a branch", () => {
  assert.deepEqual(
    buildRemoteCloneArgs({
      repoLocator: "https://github.com/org/repo.git",
      cloneDir: "/tmp/repo",
      ref: "main",
    }),
    [
      "clone",
      "--depth",
      "1",
      "--branch",
      "main",
      "--single-branch",
      "--progress",
      "https://github.com/org/repo.git",
      "/tmp/repo",
    ],
  );
});

test("describeRemoteLocator flags GitHub SSH locators for retry guidance", () => {
  assert.deepEqual(describeRemoteLocator("git@github.com:org/repo.git"), {
    type: "github_ssh",
    retryHint: "如果当前环境没有 GitHub SSH 凭据，可改用等价的 HTTPS 只读 locator 重试。",
  });
});
