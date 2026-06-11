import { Mutex } from "async-mutex";
import { calculatePercentage, calculateErrorPercentage } from "./functions.js";

// How long request timestamps are retained for RPS calculations (15 minutes).
const REQUEST_WINDOW_MS = 15 * 60 * 1000;

// Encapsulates all request/health statistics together with the mutexes that
// guard concurrent updates. Keeping this state in one place removes the heavy
// duplication of the "lock -> read -> increment -> set" pattern that used to be
// scattered throughout the request handling code.
class Counters {
  constructor() {
    // Per-server counters.
    this.access = new Map();
    this.error = new Map();
    this.notChosen = new Map();
    this.jussiBehind = new Map();
    this.timedOut = new Map();

    // Global counters.
    this.total = 0;
    this.maxJussi = -1;

    // Timestamps of recent requests, used to compute requests-per-second.
    this.requestTimestamps = [];

    // Mutexes guarding each piece of mutable state.
    this._mutexes = {
      access: new Mutex(),
      error: new Mutex(),
      notChosen: new Mutex(),
      jussiBehind: new Mutex(),
      timedOut: new Mutex(),
      total: new Mutex(),
      maxJussi: new Mutex(),
    };
  }

  // Atomically increment the counter for `key` inside `map`.
  _incrementMapCounter(mutex, map, key) {
    return mutex.runExclusive(() => {
      map.set(key, (map.get(key) ?? 0) + 1);
    });
  }

  incrementAccess(server) {
    return this._incrementMapCounter(this._mutexes.access, this.access, server);
  }

  incrementError(server) {
    return this._incrementMapCounter(this._mutexes.error, this.error, server);
  }

  incrementNotChosen(server) {
    return this._incrementMapCounter(
      this._mutexes.notChosen,
      this.notChosen,
      server,
    );
  }

  incrementJussiBehind(server) {
    return this._incrementMapCounter(
      this._mutexes.jussiBehind,
      this.jussiBehind,
      server,
    );
  }

  incrementTimedOut(server) {
    return this._incrementMapCounter(
      this._mutexes.timedOut,
      this.timedOut,
      server,
    );
  }

  incrementTotal() {
    return this._mutexes.total.runExclusive(() => {
      this.total += 1;
    });
  }

  // Track the highest jussi number seen so far across all healthy nodes.
  updateMaxJussi(jussiNumber) {
    return this._mutexes.maxJussi.runExclusive(() => {
      this.maxJussi = Math.max(this.maxJussi, jussiNumber);
    });
  }

  // Record a request timestamp and drop entries older than the tracking window.
  recordRequest(now = Date.now()) {
    this.requestTimestamps.push(now);
    const cutoffTime = now - REQUEST_WINDOW_MS;
    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => timestamp > cutoffTime,
    );
  }

  // Calculate requests-per-second over 1, 5 and 15 minute windows.
  calculateRPS() {
    const now = Date.now();

    const intervals = {
      "1min": now - 1 * 60 * 1000,
      "5min": now - 5 * 60 * 1000,
      "15min": now - 15 * 60 * 1000,
    };

    const rps = {};
    for (const [key, intervalStart] of Object.entries(intervals)) {
      const requestsInInterval = this.requestTimestamps.filter(
        (timestamp) => timestamp > intervalStart,
      ).length;
      rps[key] = parseFloat(
        (requestsInInterval / (parseInt(key) * 60)).toFixed(2),
      ); // requests per second
    }

    return rps;
  }

  getAccessPercentages() {
    return calculatePercentage(this.access, this.total);
  }

  getErrorPercentages() {
    return calculateErrorPercentage(this.error, this.access);
  }

  getNotChosen() {
    return Object.fromEntries(this.notChosen);
  }

  getJussiBehind() {
    return Object.fromEntries(this.jussiBehind);
  }

  getTimedOut() {
    return Object.fromEntries(this.timedOut);
  }
}

export { Counters, REQUEST_WINDOW_MS };
