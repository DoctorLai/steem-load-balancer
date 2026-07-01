import { firstKFulfilled } from "./firstk.js";
import { compareVersion } from "./functions.js";

function strategyFirst(arr) {
  return arr[0];
}

function strategyRandom(arr) {
  const index = Math.floor(Math.random() * arr.length);
  return arr[index];
}

function strategyMaxJussiNumber(arr) {
  return arr.reduce((max, current) =>
    current.jussi_number > max.jussi_number ? current : max,
  );
}

function blockchainVersionOf(node) {
  return node.version?.result?.blockchain_version ?? node.version;
}

function strategyLatestVersion(arr) {
  return arr.reduce((latest, current) =>
    compareVersion(blockchainVersionOf(current), blockchainVersionOf(latest)) >
    0
      ? current
      : latest,
  );
}

// Pick the node that responded fastest during the health check. `latencyMs` is
// populated by the health-check probe; entries without a numeric latency are
// treated as the slowest possible so a measured node is always preferred.
function strategyLowestLatency(arr) {
  const latencyOf = (node) =>
    typeof node.latencyMs === "number" ? node.latencyMs : Infinity;
  return arr.reduce((fastest, current) =>
    latencyOf(current) < latencyOf(fastest) ? current : fastest,
  );
}

// Build a weighted-random strategy bound to a `weights` map (keyed by node URL).
// Among the responding candidates, a node is chosen with probability
// proportional to its configured weight (default 1). This lets operators send
// more traffic to beefier nodes or drain a node by setting its weight to 0.
function makeStrategyWeighted(weights = {}, random = Math.random) {
  const weightOf = (node) => {
    const raw = Number(weights[node.server]);
    if (!Number.isFinite(raw) || raw < 0) {
      return weights[node.server] === undefined ? 1 : 0;
    }
    return raw;
  };

  return function strategyWeighted(arr) {
    const total = arr.reduce((sum, node) => sum + weightOf(node), 0);
    if (total <= 0) {
      return arr[Math.floor(random() * arr.length)] ?? arr[arr.length - 1];
    }
    let threshold = random() * total;
    for (const node of arr) {
      threshold -= weightOf(node);
      if (threshold <= 0) {
        return node;
      }
    }
    return arr[arr.length - 1];
  };
}

// strategy is a function that takes the array of fulfilled results and returns the chosen one
async function chooseNode(promises, k, strategy) {
  const fulfilled = await firstKFulfilled(promises, k);
  return {
    selected: strategy(fulfilled),
    candidates: fulfilled,
  };
}

function getStrategyByName(name, { weights } = {}) {
  switch (name) {
    case "first":
      return strategyFirst;
    case "random":
      return strategyRandom;
    case "max_jussi_number":
      return strategyMaxJussiNumber;
    case "latest_version":
      return strategyLatestVersion;
    case "lowest_latency":
      return strategyLowestLatency;
    case "weighted":
      return makeStrategyWeighted(weights ?? {});
    default:
      throw new Error(`Unknown strategy name: ${name}`);
  }
}

export {
  chooseNode,
  getStrategyByName,
  strategyFirst,
  strategyRandom,
  strategyMaxJussiNumber,
  strategyLatestVersion,
  strategyLowestLatency,
  blockchainVersionOf,
  makeStrategyWeighted,
};
