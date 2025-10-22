import { performance } from "perf_hooks";
import { AbortController } from "abort-controller";
import { limitStringMaxLength, log, sleep } from "./functions.js";

// const fetch = (...args) => import("node-fetch").then((module) => module.default(...args));
import fetch from "node-fetch";

async function fetchWithTimeout(url, options = {}, timeout = 5000) {
  const controller = new AbortController();
  const signal = controller.signal;

  const fetchPromise = fetch(url, { ...options, signal });

  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const start = performance.now();
    const response = await fetchPromise;
    const latency = performance.now() - start;
    return { response, latency };
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Fetch request to ${url} timed out after ${timeout} ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId); // cleanup timer
  }
}

// Forward GET request to the chosen node
async function forwardRequestGET(
  apiURL,
  retry_count,
  user_agent,
  timeout,
  agent,
) {
  for (let i = 0; i < retry_count; ++i) {
    try {
      log(`GET: Forwarding to ${apiURL}`);
      const { response: res, latency } = await fetchWithTimeout(
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
      log(`Status: ${res.status} Latency: ${latency}ms`);
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
async function forwardRequestPOST(
  apiURL,
  body,
  agent,
  timeout,
  retry_count,
  user_agent,
  logging_max_body_len,
) {
  for (let i = 0; i < retry_count; ++i) {
    try {
      log(
        `POST: Forwarding to ${apiURL}, body=${limitStringMaxLength(body, logging_max_body_len)}`,
      );
      const { response: res, latency } = await fetchWithTimeout(
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
      log(`Status: ${res.status} Latency: ${latency}ms`);
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

export { fetchWithTimeout, forwardRequestGET, forwardRequestPOST };
