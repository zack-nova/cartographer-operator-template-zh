import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_MARKERS = new Set(["src", "tools", "tests", "scripts"]);

export function resolveRepoRoot(importMetaUrl) {
  const currentFilePath = fileURLToPath(importMetaUrl);
  const currentDir = path.dirname(currentFilePath);
  const segments = currentDir.split(path.sep);
  const markerIndex = segments.findLastIndex((segment) => ROOT_MARKERS.has(segment));

  if (markerIndex === -1) {
    return path.resolve(currentDir, "..");
  }

  const rootSegments = segments.slice(0, markerIndex);
  return rootSegments.length === 0 ? path.sep : rootSegments.join(path.sep);
}

export function resolveRuntimePaths(importMetaUrl) {
  const repoRoot = resolveRepoRoot(importMetaUrl);

  return {
    repoRoot,
    schemaDir: path.join(repoRoot, "schema"),
    toolsDir: path.join(repoRoot, "tools")
  };
}
