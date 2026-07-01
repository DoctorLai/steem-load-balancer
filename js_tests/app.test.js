import { jest } from "@jest/globals";
import request from "supertest";

import { createApp } from "../src/app.js";
import { CircuitBreaker } from "../src/circuit-breaker.js";

// A passthrough concurrency limiter so no real p-limit scheduling happens.
const passthroughLimit = async () => (fn) => fn();

const noopLog = () => {};

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
    const app = makeApp(baseConfig());
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
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

  test("returns 500 when the chosen node is missing required fields", async () => {
    const app = makeApp(baseConfig(), {
      getServerData: async (node) => ({ server: node }), // no version/jussi_number
    });
    const res = await request(app).get("/");
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/No valid node found/);
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
    const app = makeApp(baseConfig({ nodes: ["https://only.example"] }), {
      circuitBreaker,
      forwardGET: async () => {
        throw new Error("upstream exploded");
      },
    });

    const proxied = await request(app).get("/");
    // Single node fails open, so the request still returns (with a 500 payload).
    expect(proxied.body.status_code).toBe(500);

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
});

describe("createApp weighted routing", () => {
  test("uses the weighted strategy when configured", async () => {
    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0);
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
    randomSpy.mockRestore();
  });
});
