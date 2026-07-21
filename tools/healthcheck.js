// Container health probe used by the Dockerfile HEALTHCHECK.
//
// Exits 0 when the local /health endpoint returns HTTP 200, otherwise 1. It
// tries HTTPS first (self-signed certificates are allowed) and falls back to
// HTTP, so the same probe works whether or not SSL certificates are mounted.
// Dependency-free: only Node.js core modules are used.
import http from "node:http";
import https from "node:https";

const port = Number(process.env.HEALTHCHECK_PORT || 9091);
const path = "/health";
const timeoutMs = 4000;

function probe(mod, options) {
  return new Promise((resolve) => {
    const req = mod.get(
      { host: "127.0.0.1", port, path, timeout: timeoutMs, ...options },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

const healthy =
  (await probe(https, { rejectUnauthorized: false })) ||
  (await probe(http, {}));

process.exit(healthy ? 0 : 1);
