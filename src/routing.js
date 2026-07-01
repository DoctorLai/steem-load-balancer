// Routing helpers: weighted node ordering and cache-key computation for sticky
// vs per-client routing.

// Return the numeric weight configured for `node`, defaulting to 1. Negative or
// non-numeric weights are clamped to 0 so a node can be drained by setting its
// weight to 0 without breaking the sampling maths.
function weightOf(node, weights = {}) {
  const raw = Number(weights[node]);
  if (!Number.isFinite(raw) || raw < 0) {
    return weights[node] === undefined ? 1 : 0;
  }
  return raw;
}

// Produce a new array containing every entry of `nodes` in a weighted-random
// order (sampling without replacement). Higher-weight nodes are more likely to
// appear earlier, which biases the "first K to respond" selection towards them.
// With all weights equal this behaves like a uniform shuffle.
function weightedShuffle(nodes, weights = {}, random = Math.random) {
  const pool = nodes.map((node) => ({ node, weight: weightOf(node, weights) }));
  const result = [];

  while (pool.length > 0) {
    let totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);

    // If all remaining weights are 0, fall back to uniform selection so the
    // nodes are still ordered rather than dropped.
    if (totalWeight <= 0) {
      const index = Math.floor(random() * pool.length);
      result.push(pool.splice(Math.min(index, pool.length - 1), 1)[0].node);
      continue;
    }

    let threshold = random() * totalWeight;
    let index = 0;
    for (; index < pool.length; index++) {
      threshold -= pool[index].weight;
      if (threshold <= 0) {
        break;
      }
    }
    if (index >= pool.length) {
      index = pool.length - 1;
    }
    result.push(pool.splice(index, 1)[0].node);
  }

  return result;
}

// Compute the cache key used to remember the last chosen upstream node.
//
// - Per-client (default): keyed by client IP + method + path, so each client
//   sticks to its own node for the cache TTL.
// - Sticky: keyed by method + path only, so *all* clients share the same
//   upstream node for the TTL, minimising node churn across the fleet.
function computeCacheKey({ sticky = false, ip, method, path }) {
  return sticky ? `sticky-${method}-${path}` : `${ip}-${method}-${path}`;
}

export { weightedShuffle, computeCacheKey, weightOf };
