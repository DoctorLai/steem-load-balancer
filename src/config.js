import fs from "fs";
import yaml from "js-yaml";

// Load the YAML configuration file located at `configPath`, replacing any
// `${ENV_VAR}` placeholders with the matching environment variable value.
// Exits the process if the file does not exist, mirroring the original
// startup behaviour.
function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    console.error(`Configuration file not found at ${configPath}`);
    process.exit(1);
  }

  // Load the YAML file content with environment variable replacement
  const rawConfig = yaml.load(fs.readFileSync(configPath, "utf8"));

  // Replace environment variables in the loaded config
  return JSON.parse(
    JSON.stringify(rawConfig).replace(
      /\$\{(.+?)\}/g,
      (_, name) => process.env[name],
    ),
  );
}

export { loadConfig };
