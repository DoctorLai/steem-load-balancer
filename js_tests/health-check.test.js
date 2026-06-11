import { createGetServerData } from "../src/health-check.js";

jest.mock("../src/network.js", () => ({
  fetchWithTimeout: jest.fn(),
}));
jest.mock("../src/functions.js", () => {
  const actual = jest.requireActual("../src/functions.js");
  return { ...actual, log: jest.fn() };
});

import { fetchWithTimeout } from "../src/network.js";
import { Counters } from "../src/counters.js";

const SERVER = "https://node.example.com";
const TIMEOUT = 5000;
const MIN_VERSION = "0.23.0";
const MAX_JUSSI_DIFF = 100;

function makeCounters() {
  const counters = new Counters();
  jest.spyOn(counters, "incrementNotChosen");
  jest.spyOn(counters, "incrementJussiBehind");
  jest.spyOn(counters, "incrementTimedOut");
  jest.spyOn(counters, "updateMaxJussi");
  return counters;
}

function makeGetServerData(counters) {
  return createGetServerData({
    agent: false,
    timeout: TIMEOUT,
    userAgent: "jest-agent",
    minBlockchainVersion: MIN_VERSION,
    maxJussiNumberDiff: MAX_JUSSI_DIFF,
    counters,
  });
}

function makeOkVersionResponse(version = "0.23.1") {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue({
      result: { blockchain_version: version },
    }),
  };
}

function makeOkJussiResponse(jussiNum = 1000200) {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue({
      status: "OK",
      jussi_num: jussiNum,
    }),
  };
}

describe("createGetServerData", () => {
  let counters;
  let getServerData;

  beforeEach(() => {
    jest.clearAllMocks();
    counters = makeCounters();
    getServerData = makeGetServerData(counters);
  });

  test("returns server info on a fully successful probe", async () => {
    fetchWithTimeout
      .mockResolvedValueOnce({ response: makeOkVersionResponse(), latency: 10 })
      .mockResolvedValueOnce({ response: makeOkJussiResponse(), latency: 8 });

    const result = await getServerData(SERVER);

    expect(result.server).toBe(SERVER);
    expect(result.jussi_number).toBe(1000200);
    expect(typeof result.latencyMs).toBe("number");
    expect(counters.incrementTimedOut).not.toHaveBeenCalled();
    expect(counters.incrementNotChosen).not.toHaveBeenCalled();
    expect(counters.incrementJussiBehind).not.toHaveBeenCalled();
  });

  test("increments notChosen and throws when version response is not ok", async () => {
    fetchWithTimeout
      .mockResolvedValueOnce({
        response: { ok: false, status: 503 },
        latency: 5,
      })
      .mockResolvedValueOnce({ response: makeOkJussiResponse(), latency: 5 });

    await expect(getServerData(SERVER)).rejects.toThrow();
    expect(counters.incrementNotChosen).toHaveBeenCalledWith(SERVER);
  });

  test("increments notChosen and throws when jussi response is not ok", async () => {
    fetchWithTimeout
      .mockResolvedValueOnce({ response: makeOkVersionResponse(), latency: 5 })
      .mockResolvedValueOnce({
        response: { ok: false, status: 503 },
        latency: 5,
      });

    await expect(getServerData(SERVER)).rejects.toThrow();
    expect(counters.incrementNotChosen).toHaveBeenCalledWith(SERVER);
  });

  test("increments notChosen and throws on empty version response", async () => {
    const versionResponse = { ok: true, json: jest.fn().mockResolvedValue({}) };
    fetchWithTimeout
      .mockResolvedValueOnce({ response: versionResponse, latency: 5 })
      .mockResolvedValueOnce({ response: makeOkJussiResponse(), latency: 5 });

    await expect(getServerData(SERVER)).rejects.toThrow();
    expect(counters.incrementNotChosen).toHaveBeenCalledWith(SERVER);
  });

  test("increments notChosen and throws when blockchain version is too low", async () => {
    fetchWithTimeout
      .mockResolvedValueOnce({
        response: makeOkVersionResponse("0.22.0"),
        latency: 5,
      })
      .mockResolvedValueOnce({ response: makeOkJussiResponse(), latency: 5 });

    await expect(getServerData(SERVER)).rejects.toThrow();
    expect(counters.incrementNotChosen).toHaveBeenCalledWith(SERVER);
  });

  test("increments notChosen and throws on empty jussi response", async () => {
    const jussiResponse = { ok: true, json: jest.fn().mockResolvedValue(null) };
    fetchWithTimeout
      .mockResolvedValueOnce({ response: makeOkVersionResponse(), latency: 5 })
      .mockResolvedValueOnce({ response: jussiResponse, latency: 5 });

    await expect(getServerData(SERVER)).rejects.toThrow();
    expect(counters.incrementNotChosen).toHaveBeenCalledWith(SERVER);
  });

  test("increments notChosen and throws when jussi status is not OK", async () => {
    const jussiResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ status: "ERROR", jussi_num: 1000200 }),
    };
    fetchWithTimeout
      .mockResolvedValueOnce({ response: makeOkVersionResponse(), latency: 5 })
      .mockResolvedValueOnce({ response: jussiResponse, latency: 5 });

    await expect(getServerData(SERVER)).rejects.toThrow();
    expect(counters.incrementNotChosen).toHaveBeenCalledWith(SERVER);
  });

  test("increments jussiBehind and throws when jussi_number is 20000000", async () => {
    fetchWithTimeout
      .mockResolvedValueOnce({ response: makeOkVersionResponse(), latency: 5 })
      .mockResolvedValueOnce({
        response: makeOkJussiResponse(20000000),
        latency: 5,
      });

    await expect(getServerData(SERVER)).rejects.toThrow();
    expect(counters.incrementJussiBehind).toHaveBeenCalledWith(SERVER);
    expect(counters.incrementNotChosen).not.toHaveBeenCalled();
  });

  test("increments jussiBehind and throws when node is too far behind", async () => {
    // Set maxJussi to a high value so the node appears behind
    await counters.updateMaxJussi(1001000);
    // jussi_number is more than MAX_JUSSI_DIFF behind maxJussi
    fetchWithTimeout
      .mockResolvedValueOnce({ response: makeOkVersionResponse(), latency: 5 })
      .mockResolvedValueOnce({
        response: makeOkJussiResponse(1000000 - MAX_JUSSI_DIFF - 1),
        latency: 5,
      });

    await expect(getServerData(SERVER)).rejects.toThrow();
    expect(counters.incrementJussiBehind).toHaveBeenCalledWith(SERVER);
  });

  test("increments timedOut when fetchWithTimeout throws a timeout error (message includes 'timed out')", async () => {
    const timeoutErr = new Error(
      `Fetch request to ${SERVER} timed out after ${TIMEOUT} ms`,
    );
    fetchWithTimeout.mockRejectedValue(timeoutErr);

    await expect(getServerData(SERVER)).rejects.toThrow();
    expect(counters.incrementTimedOut).toHaveBeenCalledWith(SERVER);
  });

  test("increments timedOut when fetchWithTimeout throws an AbortError", async () => {
    const abortErr = new Error("The operation was aborted");
    abortErr.name = "AbortError";
    fetchWithTimeout.mockRejectedValue(abortErr);

    await expect(getServerData(SERVER)).rejects.toThrow();
    expect(counters.incrementTimedOut).toHaveBeenCalledWith(SERVER);
  });

  test("does not increment timedOut for generic network errors", async () => {
    fetchWithTimeout.mockRejectedValue(new Error("Network failure"));

    await expect(getServerData(SERVER)).rejects.toThrow("Network failure");
    expect(counters.incrementTimedOut).not.toHaveBeenCalled();
  });
});
