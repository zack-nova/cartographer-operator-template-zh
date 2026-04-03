import { readFile } from "node:fs/promises";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";

import { SchemaValidationError } from "./errors.mjs";

const SCHEMA_FILES = [
  "repos.schema.json",
  "discovery-graph.schema.json",
  "variable-decisions.schema.json",
  "rolling-decisions.schema.json",
  "repo-report.schema.json",
  "cartographer-version.schema.json"
];

const registryCache = new Map();

export async function loadSchemaRegistry({ schemaDir }) {
  const cached = registryCache.get(schemaDir);

  if (cached !== undefined) {
    return cached;
  }

  const loading = createSchemaRegistry(schemaDir);
  registryCache.set(schemaDir, loading);
  return loading;
}

async function createSchemaRegistry(schemaDir) {
  const ajv = new Ajv2020({
    allErrors: true,
    allowUnionTypes: true,
    strict: false
  });

  const schemas = new Map();
  const validators = new Map();

  for (const schemaFile of SCHEMA_FILES) {
    const schemaPath = path.join(schemaDir, schemaFile);
    const schema = JSON.parse(await readFile(schemaPath, "utf8"));
    schemas.set(schemaFile, schema);
    ajv.addSchema(schema, schemaFile);
  }

  for (const schemaFile of SCHEMA_FILES) {
    validators.set(schemaFile, ajv.getSchema(schemaFile));
  }

  return {
    schemaDir,
    schemas,
    validators
  };
}

export function assertSchemaValue(registry, schemaName, value, label) {
  const validate = registry.validators.get(schemaName);

  if (validate === undefined) {
    throw new Error(`未找到 schema 校验器：${schemaName}`);
  }

  if (!validate(value)) {
    throw new SchemaValidationError(
      label,
      schemaName,
      formatSchemaErrors(validate.errors ?? [])
    );
  }

  return value;
}

function formatSchemaErrors(errors) {
  return errors
    .map((error) => {
      const instancePath = error.instancePath === "" ? "/" : error.instancePath;

      if (error.keyword === "required" && "missingProperty" in error.params) {
        return `${instancePath} 缺少必填属性 ${error.params.missingProperty}`;
      }

      if (
        error.keyword === "additionalProperties" &&
        "additionalProperty" in error.params
      ) {
        return `${instancePath} 包含未知属性 ${error.params.additionalProperty}`;
      }

      return `${instancePath} ${error.message ?? "无效"}`;
    })
    .join("; ");
}
