export function parseArgv(argv) {
  let command = null;
  const flags = new Map();
  const booleans = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (!current.startsWith("--")) {
      if (command !== null) {
        throw new Error(`发现未预期的位置参数：${current}`);
      }

      command = current;
      continue;
    }

    const flagName = current.slice(2);
    const next = argv[index + 1];

    if (next === undefined || next.startsWith("--")) {
      booleans.add(flagName);
      continue;
    }

    const values = flags.get(flagName) ?? [];
    values.push(next);
    flags.set(flagName, values);
    index += 1;
  }

  return { command, flags, booleans };
}

export function getOptionalFlagValue(parsedArgv, flagName) {
  const values = parsedArgv.flags.get(flagName);

  if (values === undefined || values.length === 0) {
    return undefined;
  }

  if (values.length > 1) {
    throw new Error(`参数最多只能提供一次：--${flagName}`);
  }

  return values[0];
}

export function getRequiredFlagValue(parsedArgv, flagName) {
  const value = getOptionalFlagValue(parsedArgv, flagName);

  if (value === undefined) {
    throw new Error(`缺少必填参数：--${flagName}`);
  }

  return value;
}

export function getMultiFlagValues(parsedArgv, flagName) {
  return parsedArgv.flags.get(flagName) ?? [];
}
