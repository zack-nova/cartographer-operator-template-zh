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

  for (const line of markdown.split(/\r?\n/u)) {
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
    throw new Error(
      "在 request markdown 中没有找到明确的 repo locator。请使用带远程 URL 或本地路径的 bullet 行。"
    );
  }

  return {
    schema_version: 1,
    defaults: {
      clone_root: "./work/cache/clones",
      analysis_root: "./work/analysis",
      output_root: "./work/output",
      plan_root: "./work/plans",
      report_root: "./work/reports",
      continue_on_error: options.continueOnError ?? true,
      auto_approve: options.autoApprove ?? true
    },
    repos
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
