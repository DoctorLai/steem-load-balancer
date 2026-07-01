import { weightedShuffle, computeCacheKey, weightOf } from "../src/routing.js";

describe("weightOf", () => {
  test("defaults to 1 when unset", () => {
    expect(weightOf("a", {})).toBe(1);
  });

  test("returns the configured weight", () => {
    expect(weightOf("a", { a: 5 })).toBe(5);
  });

  test("clamps negative or invalid explicit weights to 0", () => {
    expect(weightOf("a", { a: -3 })).toBe(0);
    expect(weightOf("a", { a: "not-a-number" })).toBe(0);
  });
});

describe("weightedShuffle", () => {
  test("returns all nodes (a permutation of the input)", () => {
    const nodes = ["a", "b", "c", "d"];
    const result = weightedShuffle(nodes, {}, () => 0.5);
    expect(result.slice().sort()).toEqual(nodes.slice().sort());
    expect(result).toHaveLength(nodes.length);
  });

  test("does not mutate the input array", () => {
    const nodes = ["a", "b", "c"];
    weightedShuffle(nodes, {}, () => 0.1);
    expect(nodes).toEqual(["a", "b", "c"]);
  });

  test("can select a high-weight node first with a deterministic RNG", () => {
    const nodes = ["low", "high"];
    // total = 101; threshold = 50.5 skips low(1) and selects high(100).
    const result = weightedShuffle(nodes, { low: 1, high: 100 }, () => 0.5);
    expect(result[0]).toBe("high");
  });

  test("skips zero-weight nodes until only they remain", () => {
    const nodes = ["drained", "active"];
    // With threshold just above 0, the active (weight 1) node is picked first.
    const result = weightedShuffle(nodes, { drained: 0, active: 1 }, () => 0.5);
    expect(result[0]).toBe("active");
    expect(result[1]).toBe("drained");
  });

  test("handles all-zero weights without dropping nodes", () => {
    const nodes = ["a", "b"];
    const result = weightedShuffle(nodes, { a: 0, b: 0 }, () => 0);
    expect(result.slice().sort()).toEqual(["a", "b"]);
  });
});

describe("computeCacheKey", () => {
  test("per-client key includes the IP", () => {
    expect(
      computeCacheKey({
        sticky: false,
        ip: "1.2.3.4",
        method: "GET",
        path: "/",
      }),
    ).toBe("1.2.3.4-GET-/");
  });

  test("sticky key omits the IP so all clients share a node", () => {
    const a = computeCacheKey({
      sticky: true,
      ip: "1.1.1.1",
      method: "GET",
      path: "/",
    });
    const b = computeCacheKey({
      sticky: true,
      ip: "2.2.2.2",
      method: "GET",
      path: "/",
    });
    expect(a).toBe(b);
    expect(a).toBe("sticky-GET-/");
  });
});
