import { execFile, spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { SourceResolveError } from "./errors.mjs";

const execFileAsync = promisify(execFile);

export function isRemoteLocator(repoLocator) {
  return /^(git@|ssh:\/\/|https?:\/\/)/.test(repoLocator);
}

export function describeRemoteLocator(repoLocator) {
  if (/^git@github\.com:/u.test(repoLocator) || /^ssh:\/\/git@github\.com\//u.test(repoLocator)) {
    return {
      type: "github_ssh",
      retryHint: "如果当前环境没有 GitHub SSH 凭据，可改用等价的 HTTPS 只读 locator 重试。",
    };
  }

  return {
    type: "generic_remote",
    retryHint: null,
  };
}

export function buildRemoteCloneArgs({ repoLocator, cloneDir, ref }) {
  if (ref !== undefined && looksLikeBranchOrTag(ref)) {
    return [
      "clone",
      "--depth",
      "1",
      "--branch",
      ref,
      "--single-branch",
      "--progress",
      repoLocator,
      cloneDir,
    ];
  }

  return ["clone", "--depth", "1", "--progress", repoLocator, cloneDir];
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
  const remoteInfo = describeRemoteLocator(repoTask.repo_locator);
  let needsCheckout = repoTask.ref !== undefined && !looksLikeBranchOrTag(repoTask.ref);

  try {
    await rm(cloneDir, { force: true, recursive: true });
    await mkdir(path.dirname(cloneDir), { recursive: true });
    console.error(`正在克隆远程仓库：${repoTask.repo_locator}`);
    if (remoteInfo.retryHint !== null) {
      console.error(`提示：${remoteInfo.retryHint}`);
    }
    await runGitClone(buildRemoteCloneArgs({
      repoLocator: repoTask.repo_locator,
      cloneDir,
      ref: repoTask.ref,
    }));
  } catch (error) {
    try {
      await rm(cloneDir, { force: true, recursive: true });
      await mkdir(path.dirname(cloneDir), { recursive: true });
      console.error(`浅克隆失败，正在回退到完整克隆：${repoTask.repo_locator}`);
      await runGitClone(["clone", "--progress", repoTask.repo_locator, cloneDir]);
      needsCheckout = repoTask.ref !== undefined;
    } catch (fallbackError) {
      throw new SourceResolveError(
        "clone",
        `克隆 ${repoTask.repo_locator} 失败：${extractErrorMessage(fallbackError)}${formatRetryHint(remoteInfo.retryHint)}`,
      );
    }
  }

  if (repoTask.ref !== undefined && needsCheckout) {
    await checkoutRef(cloneDir, repoTask.ref);
  }

  return {
    resolvedRepoPath: cloneDir,
    cloneDir
  };
}

async function runGitClone(args) {
  await new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GIT_SSH_COMMAND: "ssh -o BatchMode=yes",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const error = new Error(`git ${args.join(" ")} exited with code ${code ?? "unknown"}`);
      reject(Object.assign(error, { stdout, stderr }));
    });
  });
}

function formatRetryHint(retryHint) {
  return retryHint === null ? "" : ` ${retryHint}`;
}

function looksLikeBranchOrTag(ref) {
  return !/^[0-9a-f]{7,40}$/iu.test(ref);
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
