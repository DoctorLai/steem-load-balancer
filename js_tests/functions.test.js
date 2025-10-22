import {
  secondsToTimeDict,
  compareVersion,
  isObjectEmptyOrNullOrUndefined,
  limitStringMaxLength,
  shuffle,
  log,
  sleep,
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
    expect(Math.round(end - start)).toBeGreaterThanOrEqual(100);
  });
});
