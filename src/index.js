import { Mutex } from "async-mutex";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import rateLimit from "express-rate-limit";
import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import https from "https";
import http from "http";
import compression from "compression";
import helmet from "helmet";

import {
  shuffle,
  log,
  compareVersion,
  limitStringMaxLength,
  secondsToTimeDict,
  sleep,
  isObjectEmptyOrNullOrUndefined,
  fetchWithTimeout,
} from "./functions.js"; // Make sure functions.js uses ES exports

const pLimit = (...args) =>
  import("p-limit").then((module) => module.default(...args));

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let startTime = new Date();
log(`Current Time: ${startTime.toISOString()}`);

// counters to keep track of the requests
let access_counters = new Map();
let error_counters = new Map();
let total_counter = 0;
let not_chosen_counters = new Map();
let jussi_behind_counters = new Map();
let timed_out_counters = new Map();
let current_max_jussi = -1;

// Mutexes to Update the counters
const mutexJussiNumber = new Mutex();
const mutexAccessCounter = new Mutex();
const mutexErrorCounter = new Mutex();
const mutexTotalCounter = new Mutex();
const mutexNotChosenCounter = new Mutex();
const mutexJussiBehindCounter = new Mutex();
const mutexTimedOutCounter = new Mutex();
const mutexCacheLastNode = new Mutex();

// Initialize queues to store request timestamps
let requestTimestamps = [];

// Read the YAML config file located one level up from the current directory
const configPath = path.join(__dirname, "../config.yaml");
if (!fs.existsSync(configPath)) {
  console.error(`Configuration file not found at ${configPath}`);
  process.exit(1);
}

// Load the YAML file content with environment variable replacement
let config = yaml.load(fs.readFileSync(configPath, "utf8"));

// Replace environment variables in the loaded config
config = JSON.parse(
  JSON.stringify(config).replace(
    /\$\{(.+?)\}/g,
    (_, name) => process.env[name],
  ),
);

log(`PLimit: ${config.plimit}`);

const rejectUnauthorized = config.rejectUnauthorized ?? false;

const agent = new https.Agent({
  rejectUnauthorized: rejectUnauthorized,
});

log(`Reject Unauthorized: ${rejectUnauthorized}`);

const timeout = config.timeout ?? 3000;
log(`Timeout: ${timeout}`);

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
const PORT = 8080;

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
  const now = Date.now();
  requestTimestamps.push(now);
  // Remove timestamps older than 15 minutes (900000 milliseconds)
  const cutoffTime = now - 15 * 60 * 1000;
  requestTimestamps = requestTimestamps.filter(
    (timestamp) => timestamp > cutoffTime,
  );

  const contentType = req.headers["content-type"] || "";
  if (contentType && contentType.toLowerCase().includes("application/json")) {
    try {
      return express.json()(req, res, next);
    } catch (e) {
      log("JSON payload parse failed:", e.message);
      return res.status(400).json({ error: "Invalid JSON payload" });
    }
  }

  let data = "";
  req.on("data", (chunk) => (data += chunk));
  req.on("end", () => {
    try {
      req.body = data ? JSON.parse(data) : {};
      next();
    } catch (e) {
      log(`JSON parse failed (content type=${contentType}):`, e.message);
      res.status(400).json({ error: "Invalid JSON" });
    }
  });
});

// Function to calculate RPS for 1, 5, and 15 minutes
function calculateRPS() {
  const now = Date.now();

  const intervals = {
    "1min": now - 1 * 60 * 1000,
    "5min": now - 5 * 60 * 1000,
    "15min": now - 15 * 60 * 1000,
  };

  const rps = {};
  for (const [key, intervalStart] of Object.entries(intervals)) {
    const requestsInInterval = requestTimestamps.filter(
      (timestamp) => timestamp > intervalStart,
    ).length;
    rps[key] = parseFloat(
      (requestsInInterval / (parseInt(key) * 60)).toFixed(2),
    ); // requests per second
  }

  return rps;
}

// Configure body-parser to accept larger payloads
log(`Max Payload Size = ${config.max_payload_size}`);
app.use(bodyParser.json({ limit: config.max_payload_size })); // For JSON payloads

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

// Fetch version from the server
async function getServerData(server) {
  try {
    const versionPromise = fetchWithTimeout(
      server,
      {
        method: "POST",
        cache: "no-cache",
        mode: "cors",
        redirect: "follow",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": user_agent,
        },
        body: JSON.stringify({
          id: 0,
          jsonrpc: "2.0",
          method: "call",
          params: ["login_api", "get_version", []],
        }),
        agent,
      },
      timeout,
    );

    const jussiPromise = fetchWithTimeout(
      server,
      {
        method: "GET",
        cache: "no-cache",
        mode: "cors",
        redirect: "follow",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": user_agent,
        },
        agent,
      },
      timeout,
    );

    // log(jsonResponse);
    // {
    //   id: 0,
    //   jsonrpc: '2.0',
    //   result: {
    //     blockchain_version: '0.23.1',
    //     steem_revision: '46c7d93db350e8b031a81626e727c92b27d7348b',
    //     fc_revision: '46c7d93db350e8b031a81626e727c92b27d7348b'
    //   }
    // }

    // Wait for both fetches to complete
    const [versionResponse, jussiResponse] = await Promise.all([
      versionPromise,
      jussiPromise,
    ]);

    if (!versionResponse.ok) {
      let err_msg = `Server ${server} (version) responded with status: ${versionResponse.status}`;
      log(err_msg);
      await mutexNotChosenCounter.runExclusive(() => {
        not_chosen_counters.set(
          server,
          (not_chosen_counters.get(server) ?? 0) + 1,
        );
      });
      throw new Error(err_msg);
    }

    if (!jussiResponse.ok) {
      let err_msg = `Server ${server} (jussi_number) responded with status: ${jussiResponse.status}`;
      log(err_msg);
      await mutexNotChosenCounter.runExclusive(() => {
        not_chosen_counters.set(
          server,
          (not_chosen_counters.get(server) ?? 0) + 1,
        );
      });
      throw new Error(err_msg);
    }

    const jsonResponse = await versionResponse.json();

    if (
      isObjectEmptyOrNullOrUndefined(jsonResponse) ||
      isObjectEmptyOrNullOrUndefined(jsonResponse["result"])
    ) {
      let err_msg = `Server ${server} Invalid version response: ${JSON.stringify(jsonResponse)}`;
      log(err_msg);
      await mutexNotChosenCounter.runExclusive(() => {
        not_chosen_counters.set(
          server,
          (not_chosen_counters.get(server) ?? 0) + 1,
        );
      });
      throw new Error(err_msg);
    }

    const blockchain_version = jsonResponse["result"]["blockchain_version"];
    if (compareVersion(blockchain_version, min_blockchain_version) == -1) {
      let err_msg = `Server ${server} version = ${blockchain_version}: but min version is ${min_blockchain_version}`;
      log(err_msg);
      await mutexNotChosenCounter.runExclusive(() => {
        not_chosen_counters.set(
          server,
          (not_chosen_counters.get(server) ?? 0) + 1,
        );
      });
      throw new Error(err_msg);
    }

    const jussi = await jussiResponse.json();
    if (isObjectEmptyOrNullOrUndefined(jussi)) {
      let err_msg = `Server ${server} Invalid jussi response: ${JSON.stringify(jussi)}`;
      log(err_msg);
      await mutexNotChosenCounter.runExclusive(() => {
        not_chosen_counters.set(
          server,
          (not_chosen_counters.get(server) ?? 0) + 1,
        );
      });
      throw new Error(err_msg);
    }
    if (jussi["status"] !== "OK") {
      let err_msg = `Server ${server} Jussi Status != "OK": ${JSON.stringify(jussi)}`;
      log(err_msg);
      await mutexNotChosenCounter.runExclusive(() => {
        not_chosen_counters.set(
          server,
          (not_chosen_counters.get(server) ?? 0) + 1,
        );
      });
      throw new Error(err_msg);
    }
    let jussi_number = jussi["jussi_num"];

    log(`Server ${server} jussi_number: ${jussi_number}`);
    if (typeof jussi_number === "number" && Number.isInteger(jussi_number)) {
      jussi_number = parseInt(jussi_number);
    }

    if (jussi_number === 20000000) {
      let err_msg = `Server ${server} Invalid jussi_number value (20000000): ${jussi_number}`;
      await mutexJussiBehindCounter.runExclusive(() => {
        jussi_behind_counters.set(
          server,
          (jussi_behind_counters.get(server) ?? 0) + 1,
        );
      });
      throw new Error(err_msg);
    }

    await mutexJussiNumber.runExclusive(() => {
      current_max_jussi = Math.max(current_max_jussi, jussi_number);
    });

    if (current_max_jussi > jussi_number + max_jussi_number_diff) {
      let err_msg = `Server ${server} is too far behind: jussi_number ${jussi_number} vs latest ${current_max_jussi} - diff ${current_max_jussi - jussi_number}`;
      log(err_msg);
      await mutexJussiBehindCounter.runExclusive(() => {
        jussi_behind_counters.set(
          server,
          (jussi_behind_counters.get(server) ?? 0) + 1,
        );
      });
      throw new Error(err_msg);
    }

    log(
      `Tested OK: Server ${server} version=${blockchain_version}, jussi_number=${jussi_number}`,
    );
    return { server, version: jsonResponse, jussi_number };
  } catch (error) {
    let err_msg = `${error.name}: Server ${server} Failed to fetch version from ${server}: ${error.message}`;
    log(err_msg);
    if (error.name === "AbortError") {
      err_msg = `Fetch request to ${server} timed out after ${timeout} ms`;
      log(err_msg);
      await mutexTimedOutCounter.runExclusive(() => {
        timed_out_counters.set(
          server,
          (timed_out_counters.get(server) ?? 0) + 1,
        );
      });
    }
    throw new Error(err_msg);
  }
}

// Forward GET request to the chosen node
async function forwardRequestGET(apiURL) {
  for (let i = 0; i < retry_count; ++i) {
    try {
      log(`GET: Forwarding to ${apiURL}`);
      const res = await fetchWithTimeout(
        apiURL,
        {
          method: "GET",
          cache: "no-cache",
          mode: "cors",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": user_agent,
          },
          redirect: "follow",
          agent,
        },
        timeout,
      );
      const data = await res.text();
      log(`Status: ${res.status}`);
      return { statusCode: res.status, data };
    } catch (error) {
      if (i < retry_count - 1) {
        log(`Retrying ${apiURL}, attempt ${i + 1}`);
        await sleep(100);
        continue;
      }
      throw error;
    }
  }
}

// Forward POST request to the chosen node
async function forwardRequestPOST(apiURL, body) {
  for (let i = 0; i < retry_count; ++i) {
    try {
      log(
        `POST: Forwarding to ${apiURL}, body=${limitStringMaxLength(body, logging_max_body_len)}`,
      );
      const res = await fetchWithTimeout(
        apiURL,
        {
          method: "POST",
          cache: "no-cache",
          mode: "cors",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": user_agent,
          },
          redirect: "follow",
          body: body,
          agent,
        },
        timeout,
      );
      log(`Status: ${res.status}`);
      const data = await res.text();
      return { statusCode: res.status, data };
    } catch (error) {
      if (i < retry_count - 1) {
        log(`Retrying ${apiURL}, attempt ${i + 1}`);
        await sleep(100);
        continue;
      }
      throw error;
    }
  }
}

function calculatePercentage(accessCounters) {
  const percentageDict = {};

  for (let [url, count] of accessCounters) {
    let percentage = (count / total_counter) * 100;
    percentageDict[url] = {
      percent: parseFloat(percentage.toFixed(2)),
      count: count,
    };
  }

  return percentageDict;
}

function calculateErrorPercentage(error_counters, access_counters) {
  const percentageDict = {};

  for (let [url, count] of error_counters) {
    const totalRequests = access_counters.get(url) || 0;
    if (totalRequests > 0) {
      let percentage = (count / totalRequests) * 100;
      percentageDict[url] = {
        errRate: parseFloat(percentage.toFixed(3)),
        total: totalRequests,
        errorCount: count,
        succRate: parseFloat((100 - percentage).toFixed(3)),
      };
    } else {
      // If there are no requests, set rates to zero
      percentageDict[url] = {
        errRate: 0,
        total: 0,
        errorCount: 0,
        succRate: 100,
      };
    }
  }

  return percentageDict;
}

// Handle incoming requests
app.all("/", async (req, res) => {
  const ip = req.ip || req.headers["x-forwarded-for"] || "Unknown IP";
  const method = req.method.toUpperCase();
  const shuffledNodes = shuffle(nodes);
  let chosenNode = null;

  // caching the last chosen node, should we just cache the last node regardless of the method and ip?
  const cacheKey = `${ip}-${method}`;
  if (cacheEnabled) {
    await mutexCacheLastNode.runExclusive(() => {
      if (cacheLastNode.has(cacheKey)) {
        const cachedNode = cacheLastNode.get(cacheKey);
        if (Date.now() - cachedNode.timestamp < cacheMaxAge * 1000) {
          log("Cached node found: ", cachedNode);
          log(`Using cached node: ${cachedNode.server}`);
          log(`Last timestamp: ${cachedNode.timestamp}`);
          chosenNode = cachedNode;
        }
      }
    });
  }
  if (chosenNode == null) {
    const plimit = await pLimit(config.plimit);
    const promises = shuffledNodes.map((node) =>
      plimit(() => getServerData(node)),
    );
    chosenNode = await Promise.any(promises).catch((error) => {
      log(`Error: ${error.message}`);
      return null;
    });
    if (
      isObjectEmptyOrNullOrUndefined(chosenNode) ||
      isObjectEmptyOrNullOrUndefined(chosenNode.server) ||
      isObjectEmptyOrNullOrUndefined(chosenNode.version) ||
      isObjectEmptyOrNullOrUndefined(chosenNode.jussi_number)
    ) {
      // return 500
      res.status(500).json({ error: "No valid node found" });
      return;
    }
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
  log(`Current Max Jussi: ${current_max_jussi}`);
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
  await mutexTotalCounter.runExclusive(() => {
    total_counter++;
  });
  await mutexAccessCounter.runExclusive(() => {
    access_counters.set(
      chosenNode.server,
      (access_counters.get(chosenNode.server) ?? 0) + 1,
    );
  });
  let currentDate = new Date();
  let differenceInSeconds = Math.floor((currentDate - startTime) / 1000);
  const diff = secondsToTimeDict(differenceInSeconds);

  try {
    if (method === "GET") {
      result = await forwardRequestGET(chosenNode.server);
    } else if (method === "POST") {
      let reqbody = req.body;
      const body = JSON.stringify(reqbody);
      log(
        `Request Body is ${limitStringMaxLength(body, logging_max_body_len)}`,
      );
      result = await forwardRequestPOST(chosenNode.server, body);
    } else {
      return res.status(405).json({ error: "Method Not Allowed" });
    }
    data = JSON.parse(result.data);
    if (method === "GET") {
      data["status_code"] = 200;
    }
  } catch (ex) {
    data = {
      status_code: 500,
      error: ex,
      __load_balancer_version__: proxy_version,
    };
    res.setHeader("Error", JSON.stringify(ex));
    // set error counters - this is after max-retry
    await mutexErrorCounter.runExclusive(() => {
      error_counters.set(
        chosenNode.server,
        (error_counters.get(chosenNode.server) ?? 0) + 1,
      );
    });
  }
  if (method === "GET") {
    data["__server__"] = chosenNode.server;
    data["__version__"] = chosenNode.version;
    data["__servers__"] = config.nodes;
    data["__ip__"] = ip;
    data["__load_balancer_version__"] = proxy_version;
    // Calculate and include RPS stats
    const rpsStats = calculateRPS();
    data["__stats__"] = {
      total: total_counter,
      rps: parseFloat((total_counter / differenceInSeconds).toFixed(2)),
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
      access_counters: calculatePercentage(access_counters),
      error_counters: calculateErrorPercentage(error_counters, access_counters),
      not_chosen_counters: Object.fromEntries(not_chosen_counters),
      jussi_behind_counters: Object.fromEntries(jussi_behind_counters),
      timed_out_counters: Object.fromEntries(timed_out_counters),
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
