import { CircuitBreaker } from "../src/circuit-breaker.js";

describe("CircuitBreaker", () => {
  test("is a no-op when disabled", () => {
    const cb = new CircuitBreaker({ enabled: false, failureThreshold: 1 });
    cb.recordFailure("a");
    cb.recordFailure("a");
    expect(cb.isOpen("a")).toBe(false);
    expect(cb.filterAvailable(["a", "b"])).toEqual(["a", "b"]);
  });

  test("opens after reaching the failure threshold", () => {
    let now = 1000;
    const cb = new CircuitBreaker({
      enabled: true,
      failureThreshold: 3,
      cooldownMs: 5000,
      now: () => now,
    });

    cb.recordFailure("a");
    cb.recordFailure("a");
    expect(cb.isOpen("a")).toBe(false);
    cb.recordFailure("a");
    expect(cb.isOpen("a")).toBe(true);
  });

  test("stays open during cooldown then becomes half-open", () => {
    let now = 0;
    const cb = new CircuitBreaker({
      enabled: true,
      failureThreshold: 1,
      cooldownMs: 1000,
      now: () => now,
    });

    cb.recordFailure("a");
    expect(cb.isOpen("a")).toBe(true);

    now = 999;
    expect(cb.isOpen("a")).toBe(true);

    now = 1000;
    // Cooldown elapsed: half-open, allows a trial.
    expect(cb.isOpen("a")).toBe(false);
  });

  test("a success closes the breaker and resets failures", () => {
    let now = 0;
    const cb = new CircuitBreaker({
      enabled: true,
      failureThreshold: 2,
      cooldownMs: 1000,
      now: () => now,
    });

    cb.recordFailure("a");
    cb.recordSuccess("a");
    cb.recordFailure("a");
    // Only one failure since the reset, so still closed.
    expect(cb.isOpen("a")).toBe(false);
  });

  test("filterAvailable removes open nodes", () => {
    let now = 0;
    const cb = new CircuitBreaker({
      enabled: true,
      failureThreshold: 1,
      cooldownMs: 1000,
      now: () => now,
    });

    cb.recordFailure("a");
    expect(cb.filterAvailable(["a", "b", "c"])).toEqual(["b", "c"]);
  });

  test("filterAvailable fails open when every node is ejected", () => {
    let now = 0;
    const cb = new CircuitBreaker({
      enabled: true,
      failureThreshold: 1,
      cooldownMs: 1000,
      now: () => now,
    });

    cb.recordFailure("a");
    cb.recordFailure("b");
    expect(cb.filterAvailable(["a", "b"])).toEqual(["a", "b"]);
  });

  test("getState reports failures and open status", () => {
    let now = 0;
    const cb = new CircuitBreaker({
      enabled: true,
      failureThreshold: 2,
      cooldownMs: 1000,
      now: () => now,
    });

    cb.recordFailure("a");
    cb.recordFailure("a");
    cb.recordFailure("b");

    const state = cb.getState();
    expect(state).toEqual({
      a: { failures: 2, open: true },
      b: { failures: 1, open: false },
    });
  });
});
