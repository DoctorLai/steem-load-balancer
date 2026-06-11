import { Mutex } from "async-mutex";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import compression from "compression";
import helmet from "helmet";
import { StatusCodes } from "http-status-codes";

import {
  shuffle,
  log,
  limitStringMaxLength,
  secondsToTimeDict,
  isObjectEmptyOrNullOrUndefined,
} from "./functions.js";

import { forwardRequestPOST, forwardRequestGET } from "./network.js";

import { chooseNode, getStrategyByName } from "./choose-node.js";
import { loadConfig } from "./config.js";
import { Counters } from "./counters.js";
import { createGetServerData } from "./health-check.js";

const pLimit = (...args) =>
  import("p-limit").then((module) => module.default(...args));

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let startTime = new Date();
log(`Current Time: ${startTime.toISOString()}`);

// Statistics (counters, mutexes and request-rate tracking).
const counters = new Counters();

// Mutex guarding the cached "last chosen node" map.
const mutexCacheLastNode = new Mutex();

// Read the YAML config file located one level up from the current directory
const configPath = path.join(__dirname, "../config.yaml");
const config = loadConfig(configPath);

log(`PLimit: ${config.plimit}`);

const rejectUnauthorized = config.rejectUnauthorized ?? true;

const agent = new https.Agent({
  rejectUnauthorized: rejectUnauthorized,
});

log(`Reject Unauthorized: ${rejectUnauthorized}`);

const timeout = config.timeout ?? 3000;
log(`Timeout: ${timeout}`);

const firstK = config.firstK ?? 1;
log(
  `Choosing the max jussi node from the first k=${firstK} nodes that respond OK.`,
);

const strategyName = config.strategy ?? "max_jussi_number";
log(`Node Strategy: ${strategyName}`);
const strategy = getStrategyByName(strategyName);

// caching
const cache = config.cache ?? { enabled: false, ttl: 3 };
const cacheEnabled = cache.enabled ?? false;
const cacheMaxAge = cache.ttl ?? 3;
const cacheLastNode = new Map();

log(`Cache Enabled: ${cacheEnabled}`);
if (cacheEnabled) {
  log(`Cache Max Age: ${cacheMaxAge}`);
}

// Extract configuration values
const nodes = config.nodes ?? [];
if (!Array.isArray(nodes) || nodes.length === 0) {
  log("No nodes provided in the configuration.");
  process.exit(1);
}
const rateLimitConfig = config.rateLimit;

const app = express();

// Port inside the container
// This can be overridden in config.yaml
const PORT = config.port ?? 9091;
log(`Listening on Port: ${PORT}`);

// app.set('trust proxy', true);

// Enable CORS for all origins
app.use(cors());

// Reduces bandwidth usage and speeds up responses.
app.use(compression());

// Protects against common vulnerabilities like XSS and clickjacking.
app.use(helmet());

app.head("/", (req, res, next) => {
  req.method = "GET";
  next();
});

// Middleware to assume 'Content-Type: application/json' if not provided
app.use((req, res, next) => {
  // Track the request timestamp for requests-per-second statistics.
  counters.recordRequest();

  // Force JSON parsing for every request
  req.headers["content-type"] = "application/json";
  next();
});

// Configure body-parser to accept larger payloads
log(`Max Payload Size = ${config.max_payload_size}`);
app.use(bodyParser.json({ limit: config.max_payload_size })); // For JSON payloads

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    log(`Invalid JSON received from ${req.ip}`);
    return res.status(400).json({ error: "Invalid JSON" });
  }
  next(err);
});

// Configure rate limiting
const limiter = rateLimit({
  windowMs: rateLimitConfig.windowMs, // Time window in milliseconds
  max: rateLimitConfig.maxRequests, // Max requests per windowMs
  message: { error: "Too Many Requests", errorCode: 429 },
  headers: true,
});

// Apply the rate limiting middleware to all requests
app.use(limiter);

// user agent sent in the header
const user_agent =
  config.user_agent ??
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
// max jussi difference to check for validity
const max_jussi_number_diff = config.max_jussi_number_diff ?? 100;
// min blockchain version
const min_blockchain_version = config.min_blockchain_version ?? "0.23.0";
// version
const proxy_version = config.version ?? "NA";
// max body length shown in logging
const logging_max_body_len = config.logging_max_body_len ?? 100;
// retry count for GET and POST forward
const retry_count = config.retry_count ?? 3;
log(`User-agent: ${user_agent}`);
log(`Max Jussi Number Difference: ${max_jussi_number_diff}`);
log(`Min Blockchain Version to Forward: ${min_blockchain_version}`);
log(`Version: ${proxy_version}`);
log(`Max Body Length Logging: ${logging_max_body_len}`);
log(`Retry for GET and POST forward: ${retry_count}`);
log(`Nodes: ${config.nodes}`);

// Health-check function bound to the runtime configuration and counters.
const getServerData = createGetServerData({
  agent,
  timeout,
  userAgent: user_agent,
  minBlockchainVersion: min_blockchain_version,
  maxJussiNumberDiff: max_jussi_number_diff,
  counters,
});

// Handle incoming requests
app.all("/", async (req, res) => {
  const ip = req.ip || req.headers["x-forwarded-for"] || "Unknown IP";
  const method = req.method.toUpperCase();
  const shuffledNodes = shuffle(nodes);
  let chosenNode = null;
  let candidates = null;

  // caching the last chosen node, should we just cache the last node regardless of the method and ip?
  const path = req.path;
  const cacheKey = `${ip}-${method}-${path}`;
  if (cacheEnabled) {
    if (cacheLastNode.has(cacheKey)) {
      const cachedNode = cacheLastNode.get(cacheKey);
      if (Date.now() - cachedNode.timestamp < cacheMaxAge * 1000) {
        log("Cached node found: ", cachedNode);
        log(`Using cached node: ${cachedNode.server}`);
        log(`Last timestamp: ${cachedNode.timestamp}`);
        chosenNode = cachedNode;
      }
    }
  }
  if (chosenNode == null) {
    const plimit = await pLimit(config.plimit);
    const promises = shuffledNodes.map((node) =>
      plimit(() => getServerData(node)),
    );

    const result = await chooseNode(promises, firstK, strategy).catch(
      (error) => {
        log(`Error: ${error.message}`);
        return null;
      },
    );

    if (!result || !result.selected) {
      res.status(503).json({ error: "Failed to choose node" });
      return;
    }

    chosenNode = result.selected;
    candidates = result.candidates;

    if (
      isObjectEmptyOrNullOrUndefined(chosenNode) ||
      isObjectEmptyOrNullOrUndefined(chosenNode.server) ||
      isObjectEmptyOrNullOrUndefined(chosenNode.version) ||
      isObjectEmptyOrNullOrUndefined(chosenNode.jussi_number)
    ) {
      // return 500
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: "No valid node found [server, version, jussi_number]" });
      return;
    }
    log(
      `Chosen Node: ${chosenNode.server} with jussi_number ${chosenNode.jussi_number}`,
    );
    chosenNode.timestamp = Date.now();
    if (cacheEnabled) {
      await mutexCacheLastNode.runExclusive(() => {
        cacheLastNode.set(cacheKey, chosenNode);
      });
    }
  }
  log(
    `Request: ${ip}, ${method}: Chosen Node (version=${chosenNode.version["result"]["blockchain_version"]}): ${chosenNode.server} - jussi_number: ${chosenNode.jussi_number}`,
  );
  log(`Current Max Jussi: ${counters.maxJussi}`);
  res.setHeader("IP", ip);
  res.setHeader("Server", chosenNode.server);
  if (typeof chosenNode.version !== "undefined") {
    res.setHeader("Version", JSON.stringify(chosenNode.version));
  }
  res.setHeader("LoadBalancerVersion", proxy_version);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (method === "GET") {
    if (typeof config.max_age !== "undefined") {
      res.setHeader("Cache-Control", "max-age=" + config.max_age);
    }
  }
  let data = {};
  let result;

  // update stats
  await counters.incrementTotal();
  await counters.incrementAccess(chosenNode.server);
  let currentDate = new Date();
  let differenceInSeconds = Math.floor((currentDate - startTime) / 1000);
  const diff = secondsToTimeDict(differenceInSeconds);

  try {
    if (method === "GET") {
      result = await forwardRequestGET(chosenNode.server, {
        agent,
        timeout,
        retry_count,
        user_agent,
        headers: config.headers?.[chosenNode.server] || {},
      });
    } else if (method === "POST") {
      let reqbody = req.body;
      const body = JSON.stringify(reqbody);
      log(
        `Request Body is ${limitStringMaxLength(body, logging_max_body_len)}`,
      );
      result = await forwardRequestPOST(chosenNode.server, body, {
        agent,
        timeout,
        retry_count,
        user_agent,
        logging_max_body_len,
        headers: config.headers?.[chosenNode.server] || {},
      });
    } else {
      return res.status(405).json({ error: "Method Not Allowed" });
    }
    try {
      data = JSON.parse(result.data);
    } catch {
      data = {
        raw: result.data,
        warning: "Upstream did not return JSON",
      };
    }
    if (method === "GET") {
      data["status_code"] = 200;
    }
  } catch (ex) {
    data = {
      status_code: 500,
      error: ex,
      __load_balancer_version__: proxy_version,
    };
    if (config.debug === true) {
      res.setHeader("Error", JSON.stringify(ex));
    }
    log(`Error forwarding request to ${chosenNode.server}: ${ex.message}`);
    // set error counters - this is after max-retry
    await counters.incrementError(chosenNode.server);
  }
  if (method === "GET") {
    data["__server__"] = chosenNode.server;
    data["__version__"] = chosenNode.version;
    data["__selected__"] = chosenNode;
    data["__servers__"] = config.nodes;
    data["__ip__"] = ip;
    data["__config__"] = {
      strategy: config.strategy,
      firstK: firstK,
      timeout: timeout,
      user_agent: user_agent,
      min_blockchain_version: min_blockchain_version,
      max_jussi_number_diff: max_jussi_number_diff,
      cache_enabled: cacheEnabled,
      cache_ttl: cacheMaxAge,
    };
    // not available when the node is cached
    data["__first_k_candidates__"] = candidates;
    data["__load_balancer_version__"] = proxy_version;
    // Calculate and include RPS stats
    const rpsStats = counters.calculateRPS();
    data["__stats__"] = {
      total: counters.total,
      rps: parseFloat((counters.total / differenceInSeconds).toFixed(2)),
      rps_stats: {
        "1min": rpsStats["1min"],
        "5min": rpsStats["5min"],
        "15min": rpsStats["15min"],
      },
      rate_limit: {
        windowMs: rateLimitConfig.windowMs,
        maxRequests: rateLimitConfig.maxRequests,
      },
      seconds: differenceInSeconds,
      uptime: {
        startTime: startTime,
        currentTime: currentDate,
        seconds: diff.seconds,
        minutes: diff.minutes,
        hours: diff.hours,
        days: diff.days,
        month: diff.months,
        year: diff.years,
      },
      access_counters: counters.getAccessPercentages(),
      error_counters: counters.getErrorPercentages(),
      not_chosen_counters: counters.getNotChosen(),
      jussi_behind_counters: counters.getJussiBehind(),
      timed_out_counters: counters.getTimedOut(),
    };
  }
  if (isObjectEmptyOrNullOrUndefined(result)) {
    res.status(500).json(data);
    return;
  }
  if (isObjectEmptyOrNullOrUndefined(result.statusCode)) {
    res.status(500).json(data);
    return;
  }
  res.status(result.statusCode).json(data);
});

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
