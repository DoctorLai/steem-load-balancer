import {
  secondsToTimeDict,
  compareVersion,
  isObjectEmptyOrNullOrUndefined,
  limitStringMaxLength,
  shuffle,
  log,
  sleep,
  calculateErrorPercentage,
  calculatePercentage,
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
    const start = performance.now();
    await sleep(100);
    const end = performance.now();
    expect(Math.ceil(end - start)).toBeGreaterThanOrEqual(100);
  });
});

describe("calculatePercentage", () => {
  test("calculates percentage correctly for multiple URLs", () => {
    const accessCounters = new Map([
      ["/api/a", 30],
      ["/api/b", 70],
    ]);

    const totalCounter = 100;

    const result = calculatePercentage(accessCounters, totalCounter);

    expect(result).toEqual({
      "/api/a": { percent: 30.0, count: 30 },
      "/api/b": { percent: 70.0, count: 70 },
    });
  });

  test("rounds percentage to 2 decimal places", () => {
    const accessCounters = new Map([["/api/a", 33]]);

    const totalCounter = 99;

    const result = calculatePercentage(accessCounters, totalCounter);

    expect(result).toEqual({
      "/api/a": { percent: 33.33, count: 33 },
    });
  });

  test("handles zero count correctly", () => {
    const accessCounters = new Map([["/api/a", 0]]);

    const totalCounter = 50;

    const result = calculatePercentage(accessCounters, totalCounter);

    expect(result).toEqual({
      "/api/a": { percent: 0, count: 0 },
    });
  });

  test("handles empty accessCounters", () => {
    const accessCounters = new Map();
    const totalCounter = 100;

    const result = calculatePercentage(accessCounters, totalCounter);

    expect(result).toEqual({});
  });

  test("handles total_counter smaller than individual count", () => {
    const accessCounters = new Map([["/api/a", 150]]);

    const totalCounter = 100;

    const result = calculatePercentage(accessCounters, totalCounter);

    expect(result).toEqual({
      "/api/a": { percent: 150.0, count: 150 },
    });
  });

  test("handles total_counter = 0 safely", () => {
    const accessCounters = new Map([["/api/a", 10]]);

    const result = calculatePercentage(accessCounters, 0);

    expect(result).toEqual({
      "/api/a": { percent: 0, count: 10 },
    });
  });
});

describe("calculateErrorPercentage", () => {
  test("calculates error and success rates correctly", () => {
    const errorCounters = new Map([["/api/a", 5]]);

    const accessCounters = new Map([["/api/a", 100]]);

    const result = calculateErrorPercentage(errorCounters, accessCounters);

    expect(result).toEqual({
      "/api/a": {
        errRate: 5.0,
        total: 100,
        errorCount: 5,
        succRate: 95.0,
      },
    });
  });

  test("rounds rates to 3 decimal places", () => {
    const errorCounters = new Map([["/api/a", 1]]);

    const accessCounters = new Map([["/api/a", 3]]);

    const result = calculateErrorPercentage(errorCounters, accessCounters);

    expect(result["/api/a"].errRate).toBe(33.333);
    expect(result["/api/a"].succRate).toBe(66.667);
  });

  test("handles URLs with zero total requests", () => {
    const errorCounters = new Map([["/api/a", 10]]);

    const accessCounters = new Map(); // no access data

    const result = calculateErrorPercentage(errorCounters, accessCounters);

    expect(result).toEqual({
      "/api/a": {
        errRate: 0,
        total: 0,
        errorCount: 0,
        succRate: 100,
      },
    });
  });

  test("handles multiple URLs independently", () => {
    const errorCounters = new Map([
      ["/api/a", 2],
      ["/api/b", 1],
    ]);

    const accessCounters = new Map([
      ["/api/a", 10],
      ["/api/b", 4],
    ]);

    const result = calculateErrorPercentage(errorCounters, accessCounters);

    expect(result).toEqual({
      "/api/a": {
        errRate: 20.0,
        total: 10,
        errorCount: 2,
        succRate: 80.0,
      },
      "/api/b": {
        errRate: 25.0,
        total: 4,
        errorCount: 1,
        succRate: 75.0,
      },
    });
  });
});
