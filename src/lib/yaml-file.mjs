import { readFile } from "node:fs/promises";

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export async function loadYamlFile(filePath) {
  return parseYaml(await readFile(filePath, "utf8"));
}

export function renderYaml(value) {
  return stringifyYaml(value);
}
