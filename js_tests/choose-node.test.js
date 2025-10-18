const {
  chooseNode,
  strategyFirst,
  strategyRandom,
  strategyMaxJussiNumber,
  strategyLatestVersion,
  getStrategyByName,
} = require("../src/choose-node.js");

const { compareVersion } = require("../src/functions.js");

// Mock data
const nodes = [
  { id: "node1", jussi_number: 5, version: "0.22.1" },
  { id: "node2", jussi_number: 7, version: "0.23.0" },
  { id: "node3", jussi_number: 6, version: "0.22.9" },
];

// === Strategy Tests ===
describe("Node selection strategies", () => {
  test("strategyFirst returns first element", () => {
    expect(strategyFirst(nodes)).toBe(nodes[0]);
  });

  test("strategyRandom returns a random element (deterministic with mock)", () => {
    jest.spyOn(Math, "random").mockReturnValue(0.5); // middle
    const result = strategyRandom(nodes);
    expect(result).toBe(nodes[1]); // 0.5 * 3 → index 1
    Math.random.mockRestore();
  });

  test("strategyMaxJussiNumber returns node with highest jussi_number", () => {
    const result = strategyMaxJussiNumber(nodes);
    expect(result).toEqual(nodes[1]); // jussi_number = 7
  });

  test("strategyLatestVersion returns node with latest version", () => {
    global.compareVersion = compareVersion; // make sure it's available
    const result = strategyLatestVersion(nodes);
    expect(result).toEqual(nodes[1]); // version 0.23.0 is latest
  });
});

// === chooseNode Tests ===
describe("chooseNode()", () => {
  // helper delay
  const delay = (val, ms, fail = false) =>
    new Promise((resolve, reject) =>
      setTimeout(() => (fail ? reject(val) : resolve(val)), ms),
    );

  test("uses strategyFirst with firstKFulfilled", async () => {
    const promises = [
      delay({ id: "a" }, 100),
      delay({ id: "b" }, 50),
      delay({ id: "c" }, 150),
    ];

    const result = await chooseNode(promises, 2, strategyFirst);

    // candidates should be sorted by latency → ["b", "a"]
    expect(result.candidates).toEqual([{ id: "b" }, { id: "a" }]);
    expect(result.selected).toEqual({ id: "b" });
  });

  test("uses strategyMaxJussiNumber to pick node with highest jussi_number", async () => {
    const promises = [
      delay({ id: "n1", jussi_number: 5 }, 100),
      delay({ id: "n2", jussi_number: 8 }, 50),
      delay({ id: "n3", jussi_number: 7 }, 150),
    ];

    const result = await chooseNode(promises, 3, strategyMaxJussiNumber);

    expect(result.candidates).toEqual([
      { id: "n2", jussi_number: 8 },
      { id: "n1", jussi_number: 5 },
      { id: "n3", jussi_number: 7 },
    ]);

    expect(result.selected).toEqual({ id: "n2", jussi_number: 8 });
  });

  test("uses strategyLatestVersion to pick node with latest version", async () => {
    const compareVersion = (a, b) => {
      const pa = a.split(".").map(Number);
      const pb = b.split(".").map(Number);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        if ((pa[i] || 0) > (pb[i] || 0)) return 1;
        if ((pa[i] || 0) < (pb[i] || 0)) return -1;
      }
      return 0;
    };

    global.compareVersion = compareVersion; // ensure available for strategy

    const promises = [
      delay({ id: "v1", version: "0.22.0" }, 100),
      delay({ id: "v2", version: "0.23.1" }, 50),
      delay({ id: "v3", version: "0.23.0" }, 80),
    ];

    const result = await chooseNode(promises, 3, strategyLatestVersion);

    expect(result.candidates.map((x) => x.id)).toEqual(["v2", "v3", "v1"]);
    expect(result.selected).toEqual({ id: "v2", version: "0.23.1" });
  });

  test("uses strategyRandom to pick one of the fulfilled candidates", async () => {
    const promises = [
      delay({ id: "x" }, 50),
      delay({ id: "y" }, 100),
      delay({ id: "z" }, 150),
    ];

    const result = await chooseNode(promises, 3, strategyRandom);

    expect(result.candidates.length).toBe(3);
    expect(result.candidates.map((x) => x.id)).toEqual(["x", "y", "z"]);
    expect(result.candidates).toContainEqual(result.selected);
  });

  test("returns undefined selected if all promises fail", async () => {
    const bad = [Promise.reject("fail1"), Promise.reject("fail2")];

    const result = await chooseNode(bad, 2, strategyFirst);
    expect(result.selected).toBeUndefined();
    expect(result.candidates).toEqual([]);
  });

  test("resolves early once k fulfilled", async () => {
    const fast = delay({ id: "fast" }, 50);
    const slow = delay({ id: "slow" }, 200);

    const start = Date.now();
    await chooseNode([fast, slow], 1, strategyFirst);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(120);
  });

  test("returns all available candidates if fewer than k succeed", async () => {
    const promises = [
      delay({ id: "ok1" }, 50),
      Promise.reject("fail"),
      delay({ id: "ok2" }, 100),
    ];

    const result = await chooseNode(promises, 3, strategyFirst);
    expect(result.candidates.length).toBe(2);
    expect(result.candidates.map((x) => x.id)).toEqual(["ok1", "ok2"]);
    expect(result.selected.id).toBe("ok1");
  });

  test("returns consistent empty result if input promises array is empty", async () => {
    const result = await chooseNode([], 2, strategyFirst);
    expect(result.candidates).toEqual([]);
    expect(result.selected).toBeUndefined();
  });
});

// === getStrategyByName Tests ===
describe("getStrategyByName()", () => {
  test("returns correct strategy function for valid names", () => {
    expect(getStrategyByName("first")).toBe(strategyFirst);
    expect(getStrategyByName("random")).toBe(strategyRandom);
    expect(getStrategyByName("max_jussi_number")).toBe(strategyMaxJussiNumber);
    expect(getStrategyByName("latest_version")).toBe(strategyLatestVersion);
  });

  test("throws error for unknown strategy name", () => {
    expect(() => getStrategyByName("unknown")).toThrow(
      "Unknown strategy name: unknown",
    );
  });
});
