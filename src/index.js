import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { fileURLToPath } from "url";

import { log } from "./functions.js";
import { loadConfig } from "./config.js";
import { Counters } from "./counters.js";
import { CircuitBreaker } from "./circuit-breaker.js";
import { createApp } from "./app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const startTime = new Date();
log(`Current Time: ${startTime.toISOString()}`);

// Read the YAML config file located one level up from the current directory.
// Validation is intentionally disabled here so the process can emit its own
// "No nodes provided in the configuration." message (see below) and exit
// gracefully, matching the documented start-up behaviour.
const configPath = path.join(__dirname, "../config.yaml");
const config = loadConfig(configPath, { validate: false });

// Extract configuration values and fail fast on an empty node list.
const nodes = config.nodes ?? [];
if (!Array.isArray(nodes) || nodes.length === 0) {
  log("No nodes provided in the configuration.");
  process.exit(1);
}

// Log the effective runtime configuration.
const PORT = config.port ?? 9091;
log(`PLimit: ${config.plimit}`);
log(`Reject Unauthorized: ${config.rejectUnauthorized ?? true}`);
log(`Timeout: ${config.timeout ?? 3000}`);
log(`FirstK: ${config.firstK ?? 1}`);
log(`Node Strategy: ${config.strategy ?? "max_jussi_number"}`);
log(`Cache Enabled: ${config.cache?.enabled ?? false}`);
log(
  `Sticky Routing: ${config.sticky === true || config.cache?.sticky === true}`,
);
log(`Circuit Breaker Enabled: ${config.circuitBreaker?.enabled ?? false}`);
log(`Max Payload Size = ${config.max_payload_size}`);
log(`Version: ${config.version ?? "NA"}`);
log(`Listening on Port: ${PORT}`);
log(`Nodes: ${config.nodes}`);

const counters = new Counters();
const circuitBreaker = new CircuitBreaker(config.circuitBreaker ?? {});
const agent = new https.Agent({
  rejectUnauthorized: config.rejectUnauthorized ?? true,
});

const app = createApp(config, { counters, startTime, circuitBreaker, agent });

// Define the server variable to use for shutdown
let server;

// Determine if SSL certificates exist
const sslCertPath = config.sslCertPath;
const sslKeyPath = config.sslKeyPath;
log(`sslCertPath = ${sslCertPath}`);
log(`sslKeyPath = ${sslKeyPath}`);

if (fs.existsSync(sslCertPath) && fs.existsSync(sslKeyPath)) {
  // SSL certificates are available; create HTTPS server
  const options = {
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath),
  };

  server = https.createServer(options, app);

  server.listen(PORT, () => {
    console.log(`HTTPS server is running on https://localhost:${PORT}`);
  });
} else {
  // SSL certificates are not available; create HTTP server
  server = http.createServer(app);

  server.listen(PORT, () => {
    console.log(`HTTP server is running on http://localhost:${PORT}`);
  });
}

// Graceful shutdown on Ctrl+C
process.on("SIGINT", () => {
  console.log("\nGracefully shutting down...");
  server.close(() => {
    console.log("Server closed normally.");
    // We can exit with a zero code to indicate a clean shutdown
    process.exit(0);
  });
});

// Graceful shutdown on SIGTERM
process.on("SIGTERM", () => {
  console.log("\nGracefully shutting down on SIGTERM...");
  server.close(() => {
    console.log("Server closed with exit code 1.");
    // Let the process exit with a non-zero code, so it can be restarted.
    process.exit(1);
  });
});
