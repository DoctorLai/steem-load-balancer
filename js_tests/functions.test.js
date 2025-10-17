import {
  secondsToTimeDict,
  compareVersion,
  isObjectEmptyOrNullOrUndefined,
  limitStringMaxLength,
  shuffle,
  log,
  sleep,
  firstKFulfilled,
  delay,
} from "../src/functions.js";

describe("secondsToTimeDict", () => {
  test("should convert seconds to time dictionary", () => {
    const seconds = 365 * 86400 + 1;
    const expected = {
      years: 1,
      months: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 1,
    };
    expect(secondsToTimeDict(seconds)).toEqual(expected);
  });

  test("should handle zero seconds", () => {
    const seconds = 0;
    const expected = {
      years: 0,
      months: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
    expect(secondsToTimeDict(seconds)).toEqual(expected);
  });
});

describe("compareVersion", () => {
  test("should return 1 when version1 is greater than version2", () => {
    expect(compareVersion("1.2.3", "1.2.2")).toBe(1);
  });

  test("should return -1 when version1 is less than version2", () => {
    expect(compareVersion("1.2.2", "1.2.3")).toBe(-1);
  });

  test("should return 0 when versions are equal", () => {
    expect(compareVersion("1.2.3", "1.2.3")).toBe(0);
  });

  test("should handle versions with different lengths", () => {
    expect(compareVersion("1.2", "1.2.3")).toBe(-1);
    expect(compareVersion("1.2.3", "1.2")).toBe(1);
  });
});

describe("isObjectEmptyOrNullOrUndefined", () => {
  test("should return true for null", () => {
    expect(isObjectEmptyOrNullOrUndefined(null)).toBe(true);
  });

  test("should return true for undefined", () => {
    expect(isObjectEmptyOrNullOrUndefined(undefined)).toBe(true);
  });

  test("should return true for empty object", () => {
    expect(isObjectEmptyOrNullOrUndefined({})).toBe(true);
  });

  test("should return false for object with properties", () => {
    expect(isObjectEmptyOrNullOrUndefined({ a: 1 })).toBe(false);
  });

  test("should return true for empty array", () => {
    expect(isObjectEmptyOrNullOrUndefined([])).toBe(true);
  });

  test("should return false for number", () => {
    expect(isObjectEmptyOrNullOrUndefined(0)).toBe(false);
  });

  test("should return false for string", () => {
    expect(isObjectEmptyOrNullOrUndefined("")).toBe(false);
  });

  test("should return false for boolean false", () => {
    expect(isObjectEmptyOrNullOrUndefined(false)).toBe(false);
  });

  test("should return false for function", () => {
    expect(isObjectEmptyOrNullOrUndefined(() => {})).toBe(false);
  });
});

describe("limitStringMaxLength", () => {
  test("should return the same string if within limit", () => {
    expect(limitStringMaxLength("Hello", 10)).toBe("Hello");
  });

  test("should truncate and add ellipsis if exceeding limit", () => {
    expect(limitStringMaxLength("Hello, World!", 5)).toBe("Hello...");
  });

  test("should handle empty string", () => {
    expect(limitStringMaxLength("", 5)).toBe("");
  });

  test("should handle limit equal to string length", () => {
    expect(limitStringMaxLength("Hello", 5)).toBe("Hello");
  });
});

describe("shuffle", () => {
  test("should shuffle the array", () => {
    const array = [1, 2, 3, 4, 5];
    const shuffledArray = shuffle(array);
    expect(shuffledArray).toHaveLength(array.length);
    expect(shuffledArray).toEqual(expect.arrayContaining(array));
  });

  test("should handle empty array", () => {
    expect(shuffle([])).toEqual([]);
  });

  test("should handle single element array", () => {
    expect(shuffle([1])).toEqual([1]);
  });
});

describe("log", () => {
  test("should log messages with timestamp", () => {
    console.log = jest.fn();
    log("Test message");
    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\]/),
      "Test message",
    );
  });
});

describe("sleep", () => {
  test("should resolve after specified time", async () => {
    const start = Date.now();
    await sleep(100);
    const end = Date.now();
    expect(end - start).toBeGreaterThanOrEqual(100);
  });
});

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
    expect(elapsed).toBeLessThan(120); // should resolve early
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
});
