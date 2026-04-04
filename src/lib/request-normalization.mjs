import path from "node:path";

const BULLET_LINE_PATTERN = /^\s*[-*]\s+(?<body>.+?)\s*$/u;
const CODE_SPAN_PATTERN = /`([^`]+)`/gu;
const REMOTE_LOCATOR_PATTERN = /(git@[^`\s]+|ssh:\/\/[^`\s]+|https?:\/\/[^`\s]+)/u;
const LOCAL_LOCATOR_PATTERN = /((?:\/|\.\.?\/)[^`\s]+)/u;
const REF_CODE_SPAN_PATTERN = /(?:\bon\b|\bref\b)\s+`([^`]+)`/iu;
const REF_BARE_PATTERN = /(?:\bon\b|\bref\b)\s+([A-Za-z0-9._/-]+)/iu;
const TARGET_CODE_SPAN_PATTERN = /(?:\bas\b|\btarget_slug\b|\btarget\b)\s+`([^`]+)`/iu;
const TARGET_BARE_PATTERN = /(?:\bas\b|\btarget_slug\b|\btarget\b)\s+([A-Za-z0-9._-]+)/iu;

export function normalizeRequestMarkdown(markdown, options = {}) {
  const repos = [];
  const seenTargetSlugs = new Set();

  const lines = markdown.split(/\r?\n/u);

  for (const line of lines) {
    const match = BULLET_LINE_PATTERN.exec(line);

    if (match?.groups?.body === undefined) {
      continue;
    }

    const body = match.groups.body.trim();
    const repoLocator = extractRepoLocator(body);

    if (repoLocator === undefined) {
      continue;
    }

    const targetSlug = extractExplicitTargetSlug(body) ?? deriveTargetSlug(repoLocator);

    if (seenTargetSlugs.has(targetSlug)) {
      throw new Error(`请求中推导出了重复的 target_slug：${targetSlug}`);
    }

    seenTargetSlugs.add(targetSlug);

    const normalizedRepo = {
      repo_locator: repoLocator,
      target_slug: targetSlug
    };
    const ref = extractRef(body);

    if (ref !== undefined) {
      normalizedRepo.ref = ref;
    }

    repos.push(normalizedRepo);
  }

  if (repos.length === 0) {
    const proseRepo = extractSingleRepoFromMarkdown(markdown);

    if (proseRepo !== null) {
      repos.push(proseRepo);
    }
  }

  if (repos.length === 0) {
    throw new Error(
      "在 request markdown 中没有找到明确的 repo locator。请使用带远程 URL 或本地路径的 bullet 行。"
    );
  }

  return {
    schema_version: 1,
    defaults: {
      ...(options.defaults ?? {
        clone_root: "./work/cache/clones",
        analysis_root: "./work/analysis",
        output_root: "./work/output",
        plan_root: "./work/plans",
        report_root: "./work/reports",
      }),
      continue_on_error: options.continueOnError ?? true,
      auto_approve: options.autoApprove ?? true,
    },
    repos
  };
}

export function buildDefaultWorkPaths(
  outputFilePath,
  workspaceRoot = inferWorkspaceRootFromOutput(outputFilePath),
) {
  return {
    clone_root: toRepoRelativePath(outputFilePath, workspaceRoot, "work/cache/clones"),
    analysis_root: toRepoRelativePath(outputFilePath, workspaceRoot, "work/analysis"),
    output_root: toRepoRelativePath(outputFilePath, workspaceRoot, "work/output"),
    plan_root: toRepoRelativePath(outputFilePath, workspaceRoot, "work/plans"),
    report_root: toRepoRelativePath(outputFilePath, workspaceRoot, "work/reports"),
  };
}

export function deriveTargetSlug(repoLocator) {
  const normalizedLocator = repoLocator.replace(/\/+$/u, "").replace(/\.git$/u, "");
  const repoPath =
    normalizedLocator.includes(":") && !normalizedLocator.includes("://")
      ? normalizedLocator.split(":").at(-1)
      : normalizedLocator;
  const pathSegment = repoPath?.split("/").at(-1);

  if (pathSegment === undefined || pathSegment.trim() === "") {
    throw new Error(`无法从 repo locator 推导 target_slug：${repoLocator}`);
  }

  return pathSegment;
}

function extractRepoLocator(body) {
  for (const match of body.matchAll(CODE_SPAN_PATTERN)) {
    const candidate = match[1];

    if (looksLikeRepoLocator(candidate)) {
      return candidate;
    }
  }

  return REMOTE_LOCATOR_PATTERN.exec(body)?.[1] ?? LOCAL_LOCATOR_PATTERN.exec(body)?.[1];
}

function extractRef(body) {
  return REF_CODE_SPAN_PATTERN.exec(body)?.[1] ?? REF_BARE_PATTERN.exec(body)?.[1];
}

function extractExplicitTargetSlug(body) {
  return (
    TARGET_CODE_SPAN_PATTERN.exec(body)?.[1] ??
    TARGET_BARE_PATTERN.exec(body)?.[1]
  );
}

function looksLikeRepoLocator(candidate) {
  return REMOTE_LOCATOR_PATTERN.test(candidate) || LOCAL_LOCATOR_PATTERN.test(candidate);
}

function extractSingleRepoFromMarkdown(markdown) {
  const matches = [];

  for (const line of markdown.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (trimmed === "" || BULLET_LINE_PATTERN.test(trimmed)) {
      continue;
    }

    const repoLocator = extractRepoLocator(trimmed);

    if (repoLocator === undefined) {
      continue;
    }

    matches.push({
      repo_locator: repoLocator,
      target_slug: extractExplicitTargetSlug(trimmed) ?? deriveTargetSlug(repoLocator),
      ...(extractRef(trimmed) === undefined ? {} : { ref: extractRef(trimmed) }),
    });
  }

  if (matches.length !== 1) {
    return null;
  }

  return matches[0];
}

function inferWorkspaceRootFromOutput(outputFilePath) {
  const normalizedOutputDir = path.dirname(path.resolve(outputFilePath));
  const parentDir = path.basename(normalizedOutputDir);
  const grandparentDir = path.basename(path.dirname(normalizedOutputDir));

  if (parentDir === "input" && grandparentDir === "work") {
    return path.resolve(normalizedOutputDir, "..", "..");
  }

  return path.dirname(normalizedOutputDir);
}

function toRepoRelativePath(outputFilePath, workspaceRoot, targetRelativePath) {
  const fromDir = path.dirname(path.resolve(outputFilePath));
  const targetPath = path.join(path.resolve(workspaceRoot), targetRelativePath);
  const relativePath = path.relative(fromDir, targetPath);

  return relativePath === "" ? "." : relativePath.split(path.sep).join("/");
}
