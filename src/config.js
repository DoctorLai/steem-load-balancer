import fs from "fs";
import yaml from "js-yaml";

// Replace every `${ENV_VAR}` placeholder in `text` with the matching value from
// `env`. Missing environment variables are replaced with an empty string (and a
// warning is emitted) instead of the literal string "undefined".
//
// Substitution is performed on the raw YAML text *before* it is parsed so that
// unquoted placeholders keep their intended type. For example
// `enabled: ${CACHE_ENABLED}` with `CACHE_ENABLED=true` becomes the YAML boolean
// `true` rather than the string "true". Quoted placeholders such as
// `version: "${STEEM_LB_VERSION}"` remain strings.
function substituteEnvVars(text, env = process.env) {
  const missing = new Set();
  const result = text.replace(/\$\{(.+?)\}/g, (_, name) => {
    const value = env[name];
    if (value === undefined) {
      missing.add(name);
      return "";
    }
    return value;
  });

  if (missing.size > 0) {
    console.warn(
      `Warning: the following environment variables are not set and were replaced with empty strings: ${[...missing].join(", ")}`,
    );
  }

  return result;
}

function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray(value) === false
  );
}

// Validate the parsed configuration, throwing a descriptive error when required
// fields are missing or malformed. This surfaces configuration mistakes at
// startup instead of triggering confusing failures deep in the request path.
function validateConfig(config) {
  if (isPlainObject(config) === false) {
    throw new Error("Configuration must be a mapping/object.");
  }

  if (!Array.isArray(config.nodes) || config.nodes.length === 0) {
    throw new Error("Configuration must define a non-empty `nodes` array.");
  }

  for (const node of config.nodes) {
    if (typeof node !== "string" || node.trim() === "") {
      throw new Error(`Invalid node entry in configuration: ${String(node)}`);
    }
  }

  if (config.rateLimit != null) {
    const { windowMs, maxRequests } = config.rateLimit;
    if (typeof windowMs !== "number" || windowMs <= 0) {
      throw new Error("`rateLimit.windowMs` must be a positive number.");
    }
    if (typeof maxRequests !== "number" || maxRequests <= 0) {
      throw new Error("`rateLimit.maxRequests` must be a positive number.");
    }
  }

  return config;
}

// Load the YAML configuration file located at `configPath`, replacing any
// `${ENV_VAR}` placeholders with the matching environment variable value.
// Exits the process if the file does not exist, mirroring the original
// startup behaviour.
function loadConfig(configPath, { validate = true, env = process.env } = {}) {
  if (!fs.existsSync(configPath)) {
    console.error(`Configuration file not found at ${configPath}`);
    process.exit(1);
  }

  const rawText = fs.readFileSync(configPath, "utf8");
  const substituted = substituteEnvVars(rawText, env);
  const config = yaml.load(substituted);

  if (validate) {
    validateConfig(config);
  }

  return config;
}

export { loadConfig, substituteEnvVars, validateConfig };
