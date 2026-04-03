export class SchemaValidationError extends Error {
  constructor(label, schemaName, detail) {
    super(`${label} 未通过 ${schemaName} 校验：${detail}`);
    this.name = "SchemaValidationError";
    this.label = label;
    this.schemaName = schemaName;
  }
}

export class SourceResolveError extends Error {
  constructor(stage, message) {
    super(message);
    this.name = "SourceResolveError";
    this.stage = stage;
  }
}

export class OutputValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "OutputValidationError";
  }
}
