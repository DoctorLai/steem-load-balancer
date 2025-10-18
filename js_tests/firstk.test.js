import { firstKFulfilled, delay } from "../src/firstk.js";

describe("firstKFulfilled", () => {
  it("resolves after first k fulfillments", async () => {
    const start = Date.now();
    const result = await firstKFulfilled(
      [delay("A", 100), delay("B", 50), delay("C", 150), delay("D", 200)],
      2,
    );
    const elapsed = Date.now() - start;

    expect(result.length).toBe(2);
    expect(result).toEqual(expect.arrayContaining(["A", "B"]));
    expect(elapsed).toBeLessThan(140); // should resolve early
  });

  it("returns all fulfilled if fewer than k succeed", async () => {
    const result = await firstKFulfilled(
      [delay("ok1", 50), delay("fail", 80, true), delay("ok2", 100)],
      3,
    );
    expect(result.length).toBe(2);
    expect(result).toEqual(expect.arrayContaining(["ok1", "ok2"]));
  });

  it("returns [] when all rejected", async () => {
    const result = await firstKFulfilled(
      [delay("x", 20, true), delay("y", 30, true)],
      1,
    );
    expect(result).toEqual([]);
  });

  it("resolves immediately when k = 0", async () => {
    const result = await firstKFulfilled([delay("x", 100)], 0);
    expect(result).toEqual([]);
  });

  it("handles empty input array", async () => {
    const result = await firstKFulfilled([], 2);
    expect(result).toEqual([]);
  });

  it("handles k greater than number of promises", async () => {
    const result = await firstKFulfilled([delay("a", 50), delay("b", 70)], 5);
    expect(result.length).toBe(2);
    expect(result).toEqual(expect.arrayContaining(["a", "b"]));
  });

  it("resolves immediately when k < 0", async () => {
    const result = await firstKFulfilled([delay("x", 100)], -123);
    expect(result).toEqual([]);
  });
});
