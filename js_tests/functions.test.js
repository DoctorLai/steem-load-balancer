import {
  secondsToTimeDict,
  compareVersion,
  isObjectEmptyOrNullOrUndefined,
  limitStringMaxLength,
  shuffle,
  log,
  sleep,
  fetchWithTimeout,
} from "../src/functions.js";

import fetch from "node-fetch";
jest.mock("node-fetch", () => jest.fn());

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
    expect(end - start).toBeGreaterThanOrEqual(100);
  });
});

describe("fetchWithTimeout", () => {
  const TEST_URL = "https://jsonplaceholder.typicode.com/todos/1";

  beforeEach(() => {
    fetch.mockReset();
  });

  it("should return response and latency for a successful fetch", async () => {
    const mockResponse = { ok: true, json: async () => ({ id: 1 }) };
    fetch.mockResolvedValue(mockResponse);

    const { response, latency } = await fetchWithTimeout(TEST_URL, {}, 5000);
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data).toHaveProperty("id", 1);
    expect(typeof latency).toBe("number");
    expect(latency).toBeGreaterThanOrEqual(0);
    expect(latency).toBeLessThan(5000);
  });

  it("should throw an error if fetch times out", async () => {
    // Mock fetch to never resolve, but listen to abort signal
    fetch.mockImplementation((url, options) => {
      const { signal } = options || {};
      return new Promise((resolve, reject) => {
        if (signal) {
          signal.addEventListener("abort", () => {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        }
        // never resolves
      });
    });

    const timeout = 100;
    await expect(fetchWithTimeout(TEST_URL, {}, timeout)).rejects.toThrow(
      `Fetch request to ${TEST_URL} timed out after ${timeout} ms`,
    );
  });

  it("should throw network errors correctly", async () => {
    fetch.mockRejectedValue(new Error("Network failure"));

    await expect(fetchWithTimeout(TEST_URL, {}, 5000)).rejects.toThrow(
      "Network failure",
    );
  });

  it("should measure latency roughly correctly", async () => {
    const mockResponse = { ok: true, json: async () => ({ id: 1 }) };
    fetch.mockImplementation(async () => {
      // simulate 50ms latency
      await new Promise((res) => setTimeout(res, 50));
      return mockResponse;
    });

    const { latency } = await fetchWithTimeout(TEST_URL, {}, 5000);
    expect(Math.round(latency)).toBeGreaterThanOrEqual(50);
    expect(latency).toBeLessThan(5000);
  });
});
