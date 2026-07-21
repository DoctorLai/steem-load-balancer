const {
  chooseNode,
  strategyFirst,
  strategyRandom,
  strategyMaxJussiNumber,
  strategyLatestVersion,
  strategyLowestLatency,
  blockchainVersionOf,
  makeStrategyWeighted,
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

  test("strategyLatestVersion handles real health-check version objects", () => {
    const versionNodes = [
      { id: "old", version: { result: { blockchain_version: "0.22.9" } } },
      { id: "new", version: { result: { blockchain_version: "0.23.1" } } },
    ];
    expect(strategyLatestVersion(versionNodes)).toEqual(versionNodes[1]);
  });

  test("blockchainVersionOf extracts blockchain_version from version responses", () => {
    expect(
      blockchainVersionOf({
        version: { result: { blockchain_version: "0.23.1" } },
      }),
    ).toBe("0.23.1");
    expect(blockchainVersionOf({ version: "0.23.0" })).toBe("0.23.0");
  });

  test("strategyLowestLatency returns node with the smallest latencyMs", () => {
    const latencyNodes = [
      { id: "slow", latencyMs: 300 },
      { id: "fast", latencyMs: 45 },
      { id: "mid", latencyMs: 120 },
    ];
    expect(strategyLowestLatency(latencyNodes)).toEqual({
      id: "fast",
      latencyMs: 45,
    });
  });

  test("strategyLowestLatency treats missing latencyMs as slowest", () => {
    const latencyNodes = [
      { id: "unknown" },
      { id: "measured", latencyMs: 200 },
    ];
    expect(strategyLowestLatency(latencyNodes)).toEqual({
      id: "measured",
      latencyMs: 200,
    });
  });

  test("makeStrategyWeighted picks proportionally to node weight", () => {
    const candidates = [{ server: "a" }, { server: "b" }];
    // threshold = random() * total(=101). With random()=0.99 -> ~99.99, which
    // exceeds a's weight (1) so b (weight 100) is selected.
    const strategy = makeStrategyWeighted({ a: 1, b: 100 }, () => 0.99);
    expect(strategy(candidates)).toEqual({ server: "b" });
  });

  test("makeStrategyWeighted selects the first node when threshold is tiny", () => {
    const candidates = [{ server: "a" }, { server: "b" }];
    const strategy = makeStrategyWeighted({ a: 1, b: 100 }, () => 0);
    expect(strategy(candidates)).toEqual({ server: "a" });
  });

  test("makeStrategyWeighted defaults missing weights to 1", () => {
    const candidates = [{ server: "a" }, { server: "b" }];
    const strategy = makeStrategyWeighted({}, () => 0.75);
    // total = 2, threshold = 1.5 -> a(1) then b.
    expect(strategy(candidates)).toEqual({ server: "b" });
  });

  test("makeStrategyWeighted treats invalid and negative weights as zero", () => {
    const candidates = [{ server: "invalid" }, { server: "negative" }];
    const strategy = makeStrategyWeighted(
      { invalid: "not-a-number", negative: -1 },
      () => 1,
    );

    expect(strategy(candidates)).toEqual({ server: "negative" });
  });

  test("makeStrategyWeighted uses defaults when called without options", () => {
    const strategy = makeStrategyWeighted();
    expect(strategy([{ server: "a" }])).toEqual({ server: "a" });
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

  test("does not call strategies with an empty candidate list", async () => {
    const bad = [Promise.reject("fail1"), Promise.reject("fail2")];

    await expect(chooseNode(bad, 2, strategyMaxJussiNumber)).resolves.toEqual({
      selected: undefined,
      candidates: [],
    });
  });

  test("resolves early once k fulfilled", async () => {
    const fast = delay({ id: "fast" }, 50);
    const slow = delay({ id: "slow" }, 200);

    const start = performance.now();
    await chooseNode([fast, slow], 1, strategyFirst);
    const elapsed = performance.now() - start;

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
    expect(getStrategyByName("lowest_latency")).toBe(strategyLowestLatency);
  });

  test("returns a weighted strategy function for the 'weighted' name", () => {
    const strategy = getStrategyByName("weighted", { weights: { a: 2 } });
    expect(typeof strategy).toBe("function");
    expect(strategy([{ server: "a" }])).toEqual({ server: "a" });
  });

  test("uses default weighted options when none are provided", () => {
    const strategy = getStrategyByName("weighted");
    expect(strategy([{ server: "a" }])).toEqual({ server: "a" });
  });

  test("throws error for unknown strategy name", () => {
    expect(() => getStrategyByName("unknown")).toThrow(
      "Unknown strategy name: unknown",
    );
  });
});
