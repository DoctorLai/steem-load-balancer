import { Counters, REQUEST_WINDOW_MS } from "../src/counters.js";

describe("Counters", () => {
  let counters;

  beforeEach(() => {
    counters = new Counters();
  });

  test("starts with empty/zeroed state", () => {
    expect(counters.total).toBe(0);
    expect(counters.maxJussi).toBe(-1);
    expect(counters.access.size).toBe(0);
    expect(counters.error.size).toBe(0);
    expect(counters.notChosen.size).toBe(0);
    expect(counters.jussiBehind.size).toBe(0);
    expect(counters.timedOut.size).toBe(0);
    expect(counters.requestTimestamps).toEqual([]);
  });

  test("incrementAccess counts per server", async () => {
    await counters.incrementAccess("https://a.com");
    await counters.incrementAccess("https://a.com");
    await counters.incrementAccess("https://b.com");
    expect(counters.access.get("https://a.com")).toBe(2);
    expect(counters.access.get("https://b.com")).toBe(1);
  });

  test("per-server counters are independent", async () => {
    await counters.incrementError("s");
    await counters.incrementNotChosen("s");
    await counters.incrementJussiBehind("s");
    await counters.incrementTimedOut("s");
    expect(counters.error.get("s")).toBe(1);
    expect(counters.notChosen.get("s")).toBe(1);
    expect(counters.jussiBehind.get("s")).toBe(1);
    expect(counters.timedOut.get("s")).toBe(1);
  });

  test("incrementTotal increments the global counter", async () => {
    await counters.incrementTotal();
    await counters.incrementTotal();
    expect(counters.total).toBe(2);
  });

  test("concurrent increments are serialized by the mutex", async () => {
    await Promise.all(
      Array.from({ length: 100 }, () => counters.incrementTotal()),
    );
    expect(counters.total).toBe(100);

    await Promise.all(
      Array.from({ length: 50 }, () => counters.incrementAccess("x")),
    );
    expect(counters.access.get("x")).toBe(50);
  });

  test("updateMaxJussi keeps the highest value seen", async () => {
    await counters.updateMaxJussi(100);
    expect(counters.maxJussi).toBe(100);
    await counters.updateMaxJussi(50);
    expect(counters.maxJussi).toBe(100);
    await counters.updateMaxJussi(150);
    expect(counters.maxJussi).toBe(150);
  });

  test("recordRequest drops timestamps older than the tracking window", () => {
    const now = 1_000_000_000;
    counters.recordRequest(now - REQUEST_WINDOW_MS - 1); // expired
    counters.recordRequest(now - 1000); // recent
    counters.recordRequest(now); // current -> prunes using cutoff `now - window`
    expect(counters.requestTimestamps).toEqual([now - 1000, now]);
  });

  test("calculateRPS computes per-second rates across the windows", () => {
    const now = Date.now();
    for (let i = 0; i < 60; i++) {
      counters.requestTimestamps.push(now);
    }
    const rps = counters.calculateRPS();
    expect(Object.keys(rps)).toEqual(["1min", "5min", "15min"]);
    expect(rps["1min"]).toBe(1); // 60 / (1 * 60)
    expect(rps["5min"]).toBe(0.2); // 60 / (5 * 60)
    expect(rps["15min"]).toBe(0.07); // 60 / (15 * 60), rounded
  });

  test("getAccessPercentages reports percentage and count per server", async () => {
    await counters.incrementAccess("a");
    await counters.incrementAccess("a");
    await counters.incrementAccess("b");
    await counters.incrementTotal();
    await counters.incrementTotal();
    await counters.incrementTotal();
    await counters.incrementTotal();
    expect(counters.getAccessPercentages()).toEqual({
      a: { percent: 50, count: 2 },
      b: { percent: 25, count: 1 },
    });
  });

  test("getErrorPercentages reports error/success rates per server", async () => {
    await counters.incrementAccess("a");
    await counters.incrementAccess("a");
    await counters.incrementError("a");
    expect(counters.getErrorPercentages()).toEqual({
      a: { errRate: 50, total: 2, errorCount: 1, succRate: 50 },
    });
  });

  test("getNotChosen/getJussiBehind/getTimedOut return plain objects", async () => {
    await counters.incrementNotChosen("a");
    await counters.incrementJussiBehind("b");
    await counters.incrementTimedOut("c");
    expect(counters.getNotChosen()).toEqual({ a: 1 });
    expect(counters.getJussiBehind()).toEqual({ b: 1 });
    expect(counters.getTimedOut()).toEqual({ c: 1 });
  });
});
