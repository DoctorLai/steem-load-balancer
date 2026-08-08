import { jest } from "@jest/globals";
import request from "supertest";

import { createApp } from "../src/app.js";
import { CircuitBreaker } from "../src/circuit-breaker.js";

// A passthrough concurrency limiter so no real p-limit scheduling happens.
const passthroughLimit = async () => (fn) => fn();

const noopLog = () => {};

afterEach(() => {
  jest.restoreAllMocks();
});

function healthyNode(server) {
  return {
    server,
    version: { result: { blockchain_version: "0.23.0" } },
    jussi_number: 100,
    latencyMs: 10,
  };
}

function baseConfig(overrides = {}) {
  return {
    nodes: ["https://a.example", "https://b.example"],
    rateLimit: { windowMs: 60000, maxRequests: 1000 },
    version: "test-1.0.0",
    firstK: 1,
    strategy: "max_jussi_number",
    ...overrides,
  };
}

function makeApp(config, deps = {}) {
  return createApp(config, {
    log: noopLog,
    createLimit: passthroughLimit,
    getServerData: async (node) => healthyNode(node),
    forwardGET: async () => ({
      statusCode: 200,
      data: JSON.stringify({ status: "OK" }),
    }),
    forwardPOST: async () => ({
      statusCode: 200,
      data: JSON.stringify({ jsonrpc: "2.0", result: 42, id: 1 }),
    }),
    ...deps,
  });
}

describe("createApp operational endpoints", () => {
  test("GET /health returns status and version", async () => {
    const app = makeApp(baseConfig());
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("OK");
    expect(res.body.version).toBe("test-1.0.0");
    expect(res.body).toHaveProperty("uptime_seconds");
    expect(res.body.nodes).toEqual(["https://a.example", "https://b.example"]);
  });

  test("GET /version returns the configured version", async () => {
    const app = makeApp(baseConfig());
    const res = await request(app).get("/version");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ version: "test-1.0.0" });
  });

  test("GET /metrics returns Prometheus text", async () => {
    const app = makeApp(baseConfig());
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.text).toContain("steem_lb_requests_total");
    expect(res.text).toContain("# TYPE steem_lb_requests_total counter");
  });
});

describe("createApp proxying", () => {
  test("GET / forwards and augments the response", async () => {
    const app = makeApp(baseConfig({ max_age: 60 }), {
      startTime: new Date(Date.now() - 2000),
    });
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("max-age=60");
    expect(res.body.status).toBe("OK");
    expect(res.body.status_code).toBe(200);
    expect(res.body.__load_balancer_version__).toBe("test-1.0.0");
    expect(["https://a.example", "https://b.example"]).toContain(
      res.body.__server__,
    );
    expect(res.body.__config__).toMatchObject({
      strategy: "max_jussi_number",
      circuit_breaker_enabled: false,
    });
    expect(res.body.__stats__.seconds).toBeGreaterThanOrEqual(1);
    expect(res.body.__stats__.rps).toBeGreaterThan(0);
  });

  test("POST / forwards the JSON-RPC body", async () => {
    const app = makeApp(baseConfig());
    const res = await request(app).post("/").send({
      jsonrpc: "2.0",
      method: "condenser_api.get_account_count",
      id: 1,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ jsonrpc: "2.0", result: 42, id: 1 });
  });

  test("logging false suppresses request and forwarding logs", async () => {
    const log = jest.fn();
    const forwardPOST = jest.fn(async (server, body, options) => {
      options.logger(`POST ${server} body=${body}`);
      return {
        statusCode: 200,
        data: JSON.stringify({ jsonrpc: "2.0", result: 42, id: 1 }),
      };
    });
    const app = makeApp(baseConfig({ logging: false }), { log, forwardPOST });

    const res = await request(app).post("/").send({
      jsonrpc: "2.0",
      method: "condenser_api.get_account_count",
      id: 1,
    });

    expect(res.status).toBe(200);
    expect(forwardPOST).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
  });

  test("unsupported methods return 405", async () => {
    const getServerData = jest.fn(async (node) => healthyNode(node));
    const app = makeApp(baseConfig(), { getServerData });
    const res = await request(app).put("/");
    expect(res.status).toBe(405);
    expect(res.body).toEqual({ error: "Method Not Allowed" });
    expect(getServerData).not.toHaveBeenCalled();
  });

  test("invalid JSON body returns 400", async () => {
    const app = makeApp(baseConfig());
    const res = await request(app)
      .post("/")
      .set("Content-Type", "application/json")
      .send("{ not valid json ");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid JSON" });
  });

  test("returns 503 when no node can be chosen", async () => {
    const app = makeApp(baseConfig(), {
      getServerData: async () => {
        throw new Error("all nodes down");
      },
    });
    const res = await request(app).get("/");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "Failed to choose node" });
  });

  test("returns non-JSON upstream responses without discarding the payload", async () => {
    const app = makeApp(baseConfig(), {
      forwardGET: async () => ({ statusCode: 202, data: "still processing" }),
    });

    const res = await request(app).get("/");

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({
      raw: "still processing",
      warning: "Upstream did not return JSON",
      status_code: 202,
    });
  });

  test("preserves upstream 5xx status and records a breaker failure", async () => {
    const circuitBreaker = new CircuitBreaker({
      enabled: true,
      failureThreshold: 1,
      cooldownMs: 60000,
      now: () => 0,
    });
    const app = makeApp(baseConfig({ nodes: ["https://only.example"] }), {
      circuitBreaker,
      forwardGET: async () => ({
        statusCode: 503,
        data: JSON.stringify({ error: "upstream unavailable" }),
      }),
    });

    const res = await request(app).get("/");

    expect(res.status).toBe(503);
    expect(res.body.status_code).toBe(503);
    expect(circuitBreaker.getState()["https://only.example"]).toEqual({
      failures: 1,
      open: true,
    });
  });

  test("returns 500 when the chosen node is missing required fields", async () => {
    const app = makeApp(baseConfig(), {
      getServerData: async (node) => ({ server: node }), // no version/jussi_number
    });
    const res = await request(app).get("/");
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/No valid node found/);
  });

  test("returns 500 when the forwarding result has no status code", async () => {
    const circuitBreaker = new CircuitBreaker({
      enabled: true,
      failureThreshold: 1,
      cooldownMs: 60000,
      now: () => 0,
    });
    const app = makeApp(baseConfig(), {
      circuitBreaker,
      forwardGET: async () => ({ data: JSON.stringify({ status: "OK" }) }),
    });

    const res = await request(app).get("/");

    expect(res.status).toBe(500);
    expect(res.body.status).toBe("OK");
    expect(circuitBreaker.getState()[res.body.__server__]).toEqual({
      failures: 1,
      open: true,
    });
  });
});

describe("createApp circuit breaker integration", () => {
  test("records failures on forwarding errors and reflects them in /health", async () => {
    const circuitBreaker = new CircuitBreaker({
      enabled: true,
      failureThreshold: 1,
      cooldownMs: 60000,
      now: () => 0,
    });
    const app = makeApp(
      baseConfig({ nodes: ["https://only.example"], debug: true }),
      {
        circuitBreaker,
        forwardGET: async () => {
          throw new Error("upstream exploded");
        },
      },
    );

    const proxied = await request(app).get("/");
    // Single node fails open, so the request still returns (with a 500 payload).
    expect(proxied.body.status_code).toBe(500);
    expect(proxied.headers.error).toBe("{}");

    const health = await request(app).get("/health");
    expect(health.body.circuit_breaker["https://only.example"]).toEqual({
      failures: 1,
      open: true,
    });
  });

  test("resets the breaker after a successful forward", async () => {
    const circuitBreaker = new CircuitBreaker({
      enabled: true,
      failureThreshold: 2,
      cooldownMs: 60000,
    });
    const app = makeApp(baseConfig({ nodes: ["https://only.example"] }), {
      circuitBreaker,
    });

    await request(app).get("/");
    const health = await request(app).get("/health");
    expect(health.body.circuit_breaker["https://only.example"]).toEqual({
      failures: 0,
      open: false,
    });
  });

  test("does not reuse a cached node while its circuit is open", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.999);
    const circuitBreaker = new CircuitBreaker({
      enabled: true,
      failureThreshold: 1,
      cooldownMs: 60000,
      now: () => 0,
    });
    const getServerData = jest.fn(async (node) => healthyNode(node));
    const app = makeApp(
      baseConfig({
        cache: { enabled: true, ttl: 60 },
        nodes: ["https://open.example", "https://next.example"],
      }),
      {
        circuitBreaker,
        getServerData,
        chooseNodeFn: async (promises) => {
          const candidates = await Promise.all(promises);
          return { selected: candidates[0], candidates };
        },
      },
    );

    await request(app).get("/");
    circuitBreaker.recordFailure("https://open.example");

    const res = await request(app).get("/");

    expect(res.body.__server__).toBe("https://next.example");
  });

  test("reuses a healthy cached node without probing again", async () => {
    const getServerData = jest.fn(async (node) => healthyNode(node));
    const app = makeApp(baseConfig({ cache: { enabled: true, ttl: 60 } }), {
      getServerData,
    });

    const first = await request(app).get("/");
    const probeCount = getServerData.mock.calls.length;
    const second = await request(app).get("/");

    expect(second.body.__server__).toBe(first.body.__server__);
    expect(getServerData).toHaveBeenCalledTimes(probeCount);
  });
});

describe("createApp weighted routing", () => {
  test("uses the weighted strategy when configured", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0);
    const app = makeApp(
      baseConfig({
        nodes: ["https://a.example", "https://b.example"],
        strategy: "weighted",
        weights: { "https://a.example": 100, "https://b.example": 1 },
        firstK: 2,
      }),
    );
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.__config__.weighted_routing).toBe(true);
  });
});
