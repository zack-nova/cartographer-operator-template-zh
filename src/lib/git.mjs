import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { SourceResolveError } from "./errors.mjs";

const execFileAsync = promisify(execFile);

export function isRemoteLocator(repoLocator) {
  return /^(git@|ssh:\/\/|https?:\/\/)/.test(repoLocator);
}

export async function resolveLocalRepoRoot(repoPath) {
  const result = await execFileAsync("git", ["-C", repoPath, "rev-parse", "--show-toplevel"]);
  return result.stdout.trim();
}

export async function resolveRepoTask(batchContext, repoTask) {
  const cloneDir = path.join(batchContext.cloneRoot, batchContext.batchId, repoTask.target_slug);

  if (isRemoteLocator(repoTask.repo_locator)) {
    return cloneRemoteRepo(repoTask, cloneDir);
  }

  const sourceRoot = await resolveLocalRepoRoot(repoTask.repo_locator);

  if (repoTask.ref === undefined) {
    return {
      resolvedRepoPath: sourceRoot,
      cloneDir: undefined
    };
  }

  return cloneLocalRepoForRef(sourceRoot, repoTask, cloneDir);
}

async function cloneRemoteRepo(repoTask, cloneDir) {
  try {
    await rm(cloneDir, { force: true, recursive: true });
    await mkdir(path.dirname(cloneDir), { recursive: true });
    await execFileAsync("git", ["clone", repoTask.repo_locator, cloneDir]);
  } catch (error) {
    throw new SourceResolveError(
      "clone",
      `克隆 ${repoTask.repo_locator} 失败：${extractErrorMessage(error)}`
    );
  }

  if (repoTask.ref !== undefined) {
    await checkoutRef(cloneDir, repoTask.ref);
  }

  return {
    resolvedRepoPath: cloneDir,
    cloneDir
  };
}

async function cloneLocalRepoForRef(sourceRoot, repoTask, cloneDir) {
  try {
    await rm(cloneDir, { force: true, recursive: true });
    await mkdir(path.dirname(cloneDir), { recursive: true });
    await execFileAsync("git", ["clone", "--no-local", sourceRoot, cloneDir]);
  } catch (error) {
    throw new SourceResolveError(
      "clone",
      `克隆本地仓库 ${sourceRoot} 失败：${extractErrorMessage(error)}`
    );
  }

  await checkoutRef(cloneDir, repoTask.ref);

  return {
    resolvedRepoPath: cloneDir,
    cloneDir
  };
}

async function checkoutRef(repoRoot, ref) {
  try {
    await execFileAsync("git", ["-C", repoRoot, "checkout", ref]);
  } catch (error) {
    throw new SourceResolveError(
      "checkout",
      `在 ${repoRoot} 中 checkout ${ref} 失败：${extractErrorMessage(error)}`
    );
  }
}

function extractErrorMessage(error) {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const stderr = "stderr" in error && typeof error.stderr === "string" ? error.stderr.trim() : "";
  return stderr === "" ? error.message : stderr;
}
