import fetch from "node-fetch";
import { sleep, limitStringMaxLength, log } from "../src/functions.js";
import { forwardRequestGET, forwardRequestPOST } from "../src/network.js";

jest.mock("node-fetch", () => jest.fn());
jest.mock("../src/functions.js", () => {
  const actual = jest.requireActual("../src/functions.js");
  return {
    ...actual,
    sleep: jest.fn(),
    limitStringMaxLength: jest.fn((s) => s),
    log: jest.fn(),
  };
});

describe("forwardRequestGET", () => {
  const apiURL = "https://example.com/api";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("passes headers and returns data", async () => {
    // Mock fetch with a simple object implementing .text() and .status
    fetch.mockResolvedValue({
      status: 200,
      text: jest.fn().mockResolvedValue("OK"),
    });

    const result = await forwardRequestGET(apiURL, {
      agent: false,
      timeout: 5000,
      retry_count: 1,
      user_agent: "jest-agent",
      headers: { "X-Test": "123" },
    });

    expect(fetch).toHaveBeenCalledTimes(1);

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(apiURL);
    expect(options.headers).toMatchObject({
      "Content-Type": "application/json",
      "User-Agent": "jest-agent",
      "X-Test": "123",
    });

    expect(result).toEqual({ statusCode: 200, data: "OK" });
  });

  test("retries on failure", async () => {
    fetch
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({
        status: 200,
        text: jest.fn().mockResolvedValue("OK"),
      });

    const result = await forwardRequestGET(apiURL, {
      agent: false,
      timeout: 5000,
      retry_count: 2,
      user_agent: "jest-agent",
      headers: { "X-Retry": "yes" },
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(result.statusCode).toBe(200);
  });

  test("throws after max retries", async () => {
    fetch.mockRejectedValue(new Error("timeout"));

    await expect(
      forwardRequestGET(apiURL, {
        agent: false,
        timeout: 5000,
        retry_count: 2,
        user_agent: "jest-agent",
        headers: {},
      }),
    ).rejects.toThrow("timeout");

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});

describe("forwardRequestPOST", () => {
  const apiURL = "https://example.com/api";
  const body = JSON.stringify({ hello: "world" });

  beforeEach(() => {
    jest.clearAllMocks();
    limitStringMaxLength.mockImplementation((s) => s);
  });

  test("passes headers and body and returns data", async () => {
    fetch.mockResolvedValue({
      status: 201,
      text: jest.fn().mockResolvedValue("CREATED"),
    });

    const result = await forwardRequestPOST(apiURL, body, {
      agent: false,
      timeout: 5000,
      retry_count: 1,
      user_agent: "jest-agent",
      logging_max_body_len: 100,
      headers: { Authorization: "Bearer token" },
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];

    expect(url).toBe(apiURL);
    expect(options.body).toBe(body);
    expect(options.headers).toMatchObject({
      "Content-Type": "application/json",
      "User-Agent": "jest-agent",
      Authorization: "Bearer token",
    });

    expect(result).toEqual({ statusCode: 201, data: "CREATED" });
  });

  test("retries and throws after failure", async () => {
    fetch.mockRejectedValue(new Error("server down"));

    await expect(
      forwardRequestPOST(apiURL, body, {
        agent: false,
        timeout: 5000,
        retry_count: 2,
        user_agent: "jest-agent",
        logging_max_body_len: 100,
        headers: {},
      }),
    ).rejects.toThrow("server down");

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});
