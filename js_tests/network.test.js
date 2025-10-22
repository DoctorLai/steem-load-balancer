import { fetchWithTimeout } from "../src/network.js";
import fetch from "node-fetch";
jest.mock("node-fetch", () => jest.fn());

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
