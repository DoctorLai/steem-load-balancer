import { performance } from "perf_hooks";

import { fetchWithTimeout } from "./network.js";
import {
  log,
  compareVersion,
  isObjectEmptyOrNullOrUndefined,
} from "./functions.js";

// Build the `getServerData` health-check function bound to the supplied
// dependencies. The returned function probes a single node, validating its
// version and jussi number, and updates the shared counters accordingly.
function createGetServerData({
  agent,
  timeout,
  userAgent,
  minBlockchainVersion,
  maxJussiNumberDiff,
  counters,
}) {
  // Fetch version from the server
  return async function getServerData(server) {
    const startTime = performance.now(); // start timer
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
            "User-Agent": userAgent,
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
            "User-Agent": userAgent,
          },
          agent,
        },
        timeout,
      );

      // Wait for both fetches to complete
      const [
        { response: versionResponse, latency: versionLatency },
        { response: jussiResponse, latency: jussiLatency },
      ] = await Promise.all([versionPromise, jussiPromise]);

      const latencyMs = performance.now() - startTime; // end timer
      log(
        `Server ${server} Latency: ${latencyMs.toFixed(2)} ms (version: ${versionLatency} ms, jussi: ${jussiLatency} ms)`,
      );

      if (!versionResponse.ok) {
        let err_msg = `Server ${server} (version) responded with status: ${versionResponse.status}`;
        log(err_msg);
        await counters.incrementNotChosen(server);
        throw new Error(err_msg);
      }

      if (!jussiResponse.ok) {
        let err_msg = `Server ${server} (jussi_number) responded with status: ${jussiResponse.status}`;
        log(err_msg);
        await counters.incrementNotChosen(server);
        throw new Error(err_msg);
      }

      const jsonResponse = await versionResponse.json();

      if (
        isObjectEmptyOrNullOrUndefined(jsonResponse) ||
        isObjectEmptyOrNullOrUndefined(jsonResponse["result"])
      ) {
        let err_msg = `Server ${server} Invalid version response: ${JSON.stringify(jsonResponse)}`;
        log(err_msg);
        await counters.incrementNotChosen(server);
        throw new Error(err_msg);
      }

      const blockchain_version = jsonResponse["result"]["blockchain_version"];
      if (compareVersion(blockchain_version, minBlockchainVersion) == -1) {
        let err_msg = `Server ${server} version = ${blockchain_version}: but min version is ${minBlockchainVersion}`;
        log(err_msg);
        await counters.incrementNotChosen(server);
        throw new Error(err_msg);
      }

      const jussi = await jussiResponse.json();
      if (isObjectEmptyOrNullOrUndefined(jussi)) {
        let err_msg = `Server ${server} Invalid jussi response: ${JSON.stringify(jussi)}`;
        log(err_msg);
        await counters.incrementNotChosen(server);
        throw new Error(err_msg);
      }
      if (jussi["status"] !== "OK") {
        let err_msg = `Server ${server} Jussi Status != "OK": ${JSON.stringify(jussi)}`;
        log(err_msg);
        await counters.incrementNotChosen(server);
        throw new Error(err_msg);
      }
      let jussi_number = jussi["jussi_num"];

      log(`Server ${server} jussi_number: ${jussi_number}`);
      if (typeof jussi_number === "number" && Number.isInteger(jussi_number)) {
        jussi_number = parseInt(jussi_number);
      }

      if (jussi_number === 20000000) {
        let err_msg = `Server ${server} Invalid jussi_number value (20000000): ${jussi_number}`;
        await counters.incrementJussiBehind(server);
        throw new Error(err_msg);
      }

      await counters.updateMaxJussi(jussi_number);

      if (counters.maxJussi > jussi_number + maxJussiNumberDiff) {
        let err_msg = `Server ${server} is too far behind: jussi_number ${jussi_number} vs latest ${counters.maxJussi} - diff ${counters.maxJussi - jussi_number}`;
        log(err_msg);
        await counters.incrementJussiBehind(server);
        throw new Error(err_msg);
      }

      log(
        `Tested OK: Server ${server} version=${blockchain_version}, jussi_number=${jussi_number}`,
      );
      return { server, version: jsonResponse, jussi_number, latencyMs };
    } catch (error) {
      let err_msg = `${error.name}: Server ${server} Failed to fetch version from ${server}: ${error.message}`;
      log(err_msg);
      if (error.name === "AbortError" || error.message.includes("timed out")) {
        err_msg = `Fetch request to ${server} timed out after ${timeout} ms`;
        log(err_msg);
        await counters.incrementTimedOut(server);
      }
      throw new Error(err_msg);
    }
  };
}

export { createGetServerData };
