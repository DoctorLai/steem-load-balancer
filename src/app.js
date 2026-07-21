import { Mutex } from "async-mutex";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import https from "https";
import compression from "compression";
import helmet from "helmet";
import { StatusCodes } from "http-status-codes";

import {
  shuffle,
  log as defaultLog,
  limitStringMaxLength,
  secondsToTimeDict,
  isObjectEmptyOrNullOrUndefined,
} from "./functions.js";

import { forwardRequestPOST, forwardRequestGET } from "./network.js";
import {
  chooseNode as defaultChooseNode,
  getStrategyByName,
} from "./choose-node.js";
import { Counters } from "./counters.js";
import { createGetServerData } from "./health-check.js";
import { CircuitBreaker } from "./circuit-breaker.js";
import { weightedShuffle, computeCacheKey } from "./routing.js";
import { renderPrometheusMetrics } from "./metrics.js";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";

// Build the Express application from a parsed configuration object. The server
// (HTTP/HTTPS listener, signal handlers) is intentionally *not* created here so
// that the whole request pipeline can be exercised with supertest.
//
// Network-facing collaborators (`getServerData`, `forwardGET`, `forwardPOST`,
// `createLimit`) can be injected via `deps`, which is what the unit tests use to
// avoid real HTTP traffic.
function createApp(config, deps = {}) {
  const {
    counters = new Counters(),
    startTime = new Date(),
    circuitBreaker = new CircuitBreaker(config.circuitBreaker ?? {}),
    agent = new https.Agent({
      rejectUnauthorized: config.rejectUnauthorized ?? true,
    }),
    getServerData,
    forwardGET = forwardRequestGET,
    forwardPOST = forwardRequestPOST,
    chooseNodeFn = defaultChooseNode,
    createLimit,
    log = defaultLog,
  } = deps;

  // Derived configuration.
  const timeout = config.timeout ?? 3000;
  const firstK = config.firstK ?? 1;
  const strategyName = config.strategy ?? "max_jussi_number";
  const weights = config.weights ?? {};
  const strategy = getStrategyByName(strategyName, { weights });

  const cache = config.cache ?? { enabled: false, ttl: 3 };
  const cacheEnabled = cache.enabled ?? false;
  const cacheMaxAge = cache.ttl ?? 3;
  const sticky = config.sticky === true || cache.sticky === true;
  // Weighted routing biases the *order* nodes are probed by their weight. This
  // is most effective when `plimit` is smaller than the node count (so probe
  // submission order matters); with a high `plimit` the dominant weighting
  // comes from the `weighted` selection strategy itself. Enabled automatically
  // for the `weighted` strategy, or explicitly via `weighted_routing: true`.
  const weightedRouting =
    config.weighted_routing === true || strategyName === "weighted";

  const user_agent = config.user_agent ?? DEFAULT_USER_AGENT;
  const max_jussi_number_diff = config.max_jussi_number_diff ?? 100;
  const min_blockchain_version = config.min_blockchain_version ?? "0.23.0";
  const proxy_version = config.version ?? "NA";
  const logging_max_body_len = config.logging_max_body_len ?? 100;
  const retry_count = config.retry_count ?? 3;
  const nodes = config.nodes ?? [];
  const rateLimitConfig = config.rateLimit ?? {
    windowMs: 60000,
    maxRequests: 100,
  };

  const cacheLastNode = new Map();
  const mutexCacheLastNode = new Mutex();

  const resolvedGetServerData =
    getServerData ??
    createGetServerData({
      agent,
      timeout,
      userAgent: user_agent,
      minBlockchainVersion: min_blockchain_version,
      maxJussiNumberDiff: max_jussi_number_diff,
      counters,
    });

  const resolvedCreateLimit =
    createLimit ??
    (async () => {
      const pLimit = (await import("p-limit")).default;
      return pLimit(config.plimit ?? 5);
    });

  const app = express();

  // Enable CORS for all origins.
  app.use(cors());
  // Reduce bandwidth usage and speed up responses.
  app.use(compression());
  // Protect against common vulnerabilities like XSS and clickjacking.
  app.use(helmet());

  // Lightweight operational endpoints. Registered before the rate limiter and
  // body parser so orchestrators and monitors can probe them cheaply without
  // being throttled or counted as proxied blockchain requests.
  app.get("/health", (req, res) => {
    const now = new Date();
    const uptimeSeconds = Math.floor((now - startTime) / 1000);
    res.setHeader("Cache-Control", "no-store");
    res.json({
      status: "OK",
      version: proxy_version,
      uptime: secondsToTimeDict(uptimeSeconds),
      uptime_seconds: uptimeSeconds,
      total_requests: counters.total,
      nodes,
      circuit_breaker: circuitBreaker.getState(),
      timestamp: now.toISOString(),
    });
  });

  app.get("/version", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ version: proxy_version });
  });

  // Prometheus scrape endpoint.
  app.get("/metrics", (req, res) => {
    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(
      renderPrometheusMetrics(counters, {
        startTimeMs: startTime.getTime(),
        circuitBreaker,
      }),
    );
  });

  app.head("/", (req, res, next) => {
    req.method = "GET";
    next();
  });

  // Track request rate and force JSON parsing for every request.
  app.use((req, res, next) => {
    counters.recordRequest();
    req.headers["content-type"] = "application/json";
    next();
  });

  app.use(express.json({ limit: config.max_payload_size }));

  app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
      log(`Invalid JSON received from ${req.ip}`);
      return res.status(400).json({ error: "Invalid JSON" });
    }
    next(err);
  });

  const limiter = rateLimit({
    windowMs: rateLimitConfig.windowMs,
    max: rateLimitConfig.maxRequests,
    message: { error: "Too Many Requests", errorCode: 429 },
    headers: true,
  });
  app.use(limiter);

  // Main proxy handler.
  app.all("/", async (req, res) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || "Unknown IP";
    const method = req.method.toUpperCase();

    if (method !== "GET" && method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // Eject nodes whose circuit breaker is open, then order the survivors
    // (weighted or uniform) before probing them.
    const available = circuitBreaker.filterAvailable(nodes);
    const orderedNodes = weightedRouting
      ? weightedShuffle(available, weights)
      : shuffle(available);

    let chosenNode = null;
    let candidates = null;

    const cacheKey = computeCacheKey({
      sticky,
      ip,
      method,
      path: req.path,
    });

    if (cacheEnabled && cacheLastNode.has(cacheKey)) {
      const cachedNode = cacheLastNode.get(cacheKey);
      if (Date.now() - cachedNode.timestamp < cacheMaxAge * 1000) {
        if (circuitBreaker.isOpen(cachedNode.server)) {
          log(`Cached node is circuit-open, skipping: ${cachedNode.server}`);
          cacheLastNode.delete(cacheKey);
        } else {
          log(`Using cached node: ${cachedNode.server}`);
          chosenNode = cachedNode;
        }
      }
    }

    if (chosenNode == null) {
      const plimit = await resolvedCreateLimit();
      const promises = orderedNodes.map((node) =>
        plimit(() => resolvedGetServerData(node)),
      );

      const result = await chooseNodeFn(promises, firstK, strategy).catch(
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
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          error: "No valid node found [server, version, jussi_number]",
        });
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

    log(`Current Max Jussi: ${counters.maxJussi}`);
    res.setHeader("IP", ip);
    res.setHeader("Server", chosenNode.server);
    if (typeof chosenNode.version !== "undefined") {
      res.setHeader("Version", JSON.stringify(chosenNode.version));
    }
    res.setHeader("LoadBalancerVersion", proxy_version);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (method === "GET" && typeof config.max_age !== "undefined") {
      res.setHeader("Cache-Control", "max-age=" + config.max_age);
    }

    let data;
    let result;

    await counters.incrementTotal();
    await counters.incrementAccess(chosenNode.server);
    const currentDate = new Date();
    const differenceInSeconds = Math.floor((currentDate - startTime) / 1000);
    const diff = secondsToTimeDict(differenceInSeconds);

    try {
      if (method === "GET") {
        result = await forwardGET(chosenNode.server, {
          agent,
          timeout,
          retry_count,
          user_agent,
          headers: config.headers?.[chosenNode.server] || {},
        });
      } else if (method === "POST") {
        const body = JSON.stringify(req.body);
        log(
          `Request Body is ${limitStringMaxLength(body, logging_max_body_len)}`,
        );
        result = await forwardPOST(chosenNode.server, body, {
          agent,
          timeout,
          retry_count,
          user_agent,
          logging_max_body_len,
          headers: config.headers?.[chosenNode.server] || {},
        });
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
      // Successful forward: reset the node's circuit breaker.
      circuitBreaker.recordSuccess(chosenNode.server);
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
      await counters.incrementError(chosenNode.server);
      // Failed forward (after retries): trip the node's circuit breaker.
      circuitBreaker.recordFailure(chosenNode.server);
    }

    if (method === "GET") {
      data["__server__"] = chosenNode.server;
      data["__version__"] = chosenNode.version;
      data["__selected__"] = chosenNode;
      data["__servers__"] = config.nodes;
      data["__ip__"] = ip;
      data["__config__"] = {
        strategy: strategyName,
        firstK,
        timeout,
        user_agent,
        min_blockchain_version,
        max_jussi_number_diff,
        cache_enabled: cacheEnabled,
        cache_ttl: cacheMaxAge,
        sticky,
        weighted_routing: weightedRouting,
        circuit_breaker_enabled: circuitBreaker.enabled,
      };
      data["__first_k_candidates__"] = candidates;
      data["__load_balancer_version__"] = proxy_version;

      const rpsStats = counters.calculateRPS();
      data["__stats__"] = {
        total: counters.total,
        rps:
          differenceInSeconds > 0
            ? parseFloat((counters.total / differenceInSeconds).toFixed(2))
            : 0,
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
          startTime,
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
        circuit_breaker: circuitBreaker.getState(),
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

  // Expose runtime state for the bootstrap and for tests.
  app.locals.counters = counters;
  app.locals.startTime = startTime;
  app.locals.circuitBreaker = circuitBreaker;
  app.locals.config = config;

  return app;
}

export { createApp, DEFAULT_USER_AGENT };
