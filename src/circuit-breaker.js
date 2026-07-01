// A minimal per-node circuit breaker. Each upstream node has an independent
// breaker that trips ("opens") after a configurable number of consecutive
// failures. While open, the node is temporarily ejected from routing for a
// cooldown period, after which it enters a "half-open" state and is given a
// single trial request. A success closes the breaker and resets the failure
// count; another failure re-opens it for a fresh cooldown.
//
// The breaker "fails open" at the fleet level: if every node is currently open
// it returns all nodes rather than none, so the load balancer never
// permanently refuses to route.
class CircuitBreaker {
  constructor({
    enabled = false,
    failureThreshold = 5,
    cooldownMs = 30000,
    now = Date.now,
  } = {}) {
    this.enabled = enabled;
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this._now = now;
    // node -> { failures: number, openedAt: number|null }
    this._state = new Map();
  }

  _get(node) {
    let state = this._state.get(node);
    if (state === undefined) {
      state = { failures: 0, openedAt: null };
      this._state.set(node, state);
    }
    return state;
  }

  // Is the node currently ejected? Transitions an expired open breaker to
  // half-open (allowing a trial request) as a side effect.
  isOpen(node, now = this._now()) {
    if (!this.enabled) {
      return false;
    }
    const state = this._state.get(node);
    if (state === undefined || state.openedAt === null) {
      return false;
    }
    if (now - state.openedAt >= this.cooldownMs) {
      // Cooldown elapsed: move to half-open so the next request is a trial.
      state.openedAt = null;
      return false;
    }
    return true;
  }

  recordSuccess(node) {
    if (!this.enabled) {
      return;
    }
    const state = this._get(node);
    state.failures = 0;
    state.openedAt = null;
  }

  recordFailure(node, now = this._now()) {
    if (!this.enabled) {
      return;
    }
    const state = this._get(node);
    state.failures += 1;
    if (state.failures >= this.failureThreshold) {
      state.openedAt = now;
    }
  }

  // Return the subset of `nodes` that are not currently ejected. If every node
  // is open, all nodes are returned (fail-open) so routing can still proceed.
  filterAvailable(nodes, now = this._now()) {
    if (!this.enabled) {
      return nodes.slice();
    }
    const available = nodes.filter((node) => !this.isOpen(node, now));
    return available.length > 0 ? available : nodes.slice();
  }

  // Snapshot of breaker state, suitable for diagnostics and metrics.
  getState(now = this._now()) {
    const snapshot = {};
    for (const [node, state] of this._state) {
      snapshot[node] = {
        failures: state.failures,
        open: this.isOpen(node, now),
      };
    }
    return snapshot;
  }
}

export { CircuitBreaker };
