import { access, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const currentFilePath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFilePath), "..");
const srcDir = path.join(repoRoot, "src");
const toolsDir = path.join(repoRoot, "tools");
const manifestPath = path.join(toolsDir, "cartographer-version.json");
const cartographerTemplatePath = path.join(srcDir, "cartographer-cli.template.mjs");
const runBatchEntryPath = path.join(srcDir, "run-batch-entry.mjs");
const yamlBrowserEntryPath = path.join(
  repoRoot,
  "node_modules",
  "yaml",
  "browser",
  "index.js"
);

await main();

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const cartographerSourceRoot =
    process.env.CARTOGRAPHER_SOURCE_ROOT ?? manifest.source_repo;
  const cartographerIndexPath = path.join(cartographerSourceRoot, "src", "index.ts");

  await access(cartographerIndexPath, constants.R_OK);
  const generatedEntryPath = path.join(srcDir, "cartographer-cli.generated.mjs");

  try {
    const cartographerEntryPath = await writeCartographerEntry(
      generatedEntryPath,
      cartographerIndexPath
    );

    await build({
      entryPoints: [cartographerEntryPath],
      bundle: true,
      platform: "node",
      format: "esm",
      alias: {
        yaml: yamlBrowserEntryPath
      },
      outfile: path.join(toolsDir, "cartographer-cli.mjs")
    });

    await build({
      entryPoints: [runBatchEntryPath],
      bundle: true,
      platform: "node",
      format: "esm",
      alias: {
        yaml: yamlBrowserEntryPath
      },
      outfile: path.join(toolsDir, "run-batch.mjs")
    });

    await updateVersionManifest(manifest, cartographerSourceRoot);
  } finally {
    await rm(generatedEntryPath, { force: true });
  }
}

async function writeCartographerEntry(generatedEntryPath, cartographerIndexPath) {
  const template = await readFile(cartographerTemplatePath, "utf8");
  const entryContent = template.replaceAll(
    "__CARTOGRAPHER_SOURCE__",
    normalizeImportPath(cartographerIndexPath)
  );
  await writeFile(generatedEntryPath, entryContent, "utf8");
  return generatedEntryPath;
}

function normalizeImportPath(filePath) {
  return filePath.replaceAll("\\", "\\\\");
}

async function updateVersionManifest(existingManifest, cartographerSourceRoot) {
  const cartographerBundlePath = path.join(toolsDir, "cartographer-cli.mjs");
  const bundleContent = await readFile(cartographerBundlePath);
  const sha256 = createHash("sha256").update(bundleContent).digest("hex");

  const nextManifest = {
    ...existingManifest,
    source_repo: cartographerSourceRoot,
    sha256,
    bundled_at:
      existingManifest.sha256 === sha256 &&
      existingManifest.source_repo === cartographerSourceRoot
        ? existingManifest.bundled_at
        : new Date().toISOString()
  };

  const nextContent = `${JSON.stringify(nextManifest, null, 2)}\n`;
  const previousContent = `${JSON.stringify(existingManifest, null, 2)}\n`;

  if (nextContent !== previousContent) {
    await writeFile(manifestPath, nextContent, "utf8");
  }
}
