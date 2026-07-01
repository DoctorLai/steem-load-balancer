import { jest } from "@jest/globals";
import fs from "fs";
import os from "os";
import path from "path";

import {
  loadConfig,
  substituteEnvVars,
  validateConfig,
} from "../src/config.js";

describe("substituteEnvVars", () => {
  test("replaces placeholders with environment values", () => {
    const text = 'version: "${MY_VERSION}"';
    expect(substituteEnvVars(text, { MY_VERSION: "1.2.3" })).toBe(
      'version: "1.2.3"',
    );
  });

  test("replaces multiple placeholders", () => {
    const text = "a: ${A}\nb: ${B}";
    expect(substituteEnvVars(text, { A: "1", B: "2" })).toBe("a: 1\nb: 2");
  });

  test("replaces missing variables with an empty string and warns", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const text = 'key: "${NOT_SET}"';
    expect(substituteEnvVars(text, {})).toBe('key: ""');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("NOT_SET");
    warn.mockRestore();
  });

  test("leaves text without placeholders untouched", () => {
    const text = "hello: world";
    expect(substituteEnvVars(text, {})).toBe(text);
  });
});

describe("validateConfig", () => {
  test("accepts a valid configuration", () => {
    const config = {
      nodes: ["https://a.example", "https://b.example"],
      rateLimit: { windowMs: 1000, maxRequests: 10 },
    };
    expect(validateConfig(config)).toBe(config);
  });

  test("throws when nodes is missing", () => {
    expect(() => validateConfig({})).toThrow(/non-empty `nodes`/);
  });

  test("throws when nodes is empty", () => {
    expect(() => validateConfig({ nodes: [] })).toThrow(/non-empty `nodes`/);
  });

  test("throws when a node entry is not a string", () => {
    expect(() => validateConfig({ nodes: [123] })).toThrow(/Invalid node/);
  });

  test("throws when a node entry is blank", () => {
    expect(() => validateConfig({ nodes: ["  "] })).toThrow(/Invalid node/);
  });

  test("throws when config is not an object", () => {
    expect(() => validateConfig(null)).toThrow(/mapping\/object/);
    expect(() => validateConfig([])).toThrow(/mapping\/object/);
  });

  test("throws for invalid rateLimit.windowMs", () => {
    expect(() =>
      validateConfig({ nodes: ["https://a"], rateLimit: { windowMs: 0 } }),
    ).toThrow(/windowMs/);
  });

  test("throws for invalid rateLimit.maxRequests", () => {
    expect(() =>
      validateConfig({
        nodes: ["https://a"],
        rateLimit: { windowMs: 1000, maxRequests: -5 },
      }),
    ).toThrow(/maxRequests/);
  });
});

describe("loadConfig", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "slb-config-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeConfig(contents) {
    const file = path.join(tmpDir, "config.yaml");
    fs.writeFileSync(file, contents);
    return file;
  }

  test("parses booleans and numbers from env vars with correct types", () => {
    const file = writeConfig(
      [
        "nodes:",
        "  - https://a.example",
        "cache:",
        "  enabled: ${CACHE_ENABLED}",
        "  ttl: ${CACHE_TTL}",
        "debug: ${DEBUG}",
      ].join("\n"),
    );

    const config = loadConfig(file, {
      env: { CACHE_ENABLED: "true", CACHE_TTL: "5", DEBUG: "false" },
    });

    expect(config.cache.enabled).toBe(true);
    expect(config.cache.ttl).toBe(5);
    expect(config.debug).toBe(false);
  });

  test("keeps quoted placeholders as strings", () => {
    const file = writeConfig(
      ["nodes:", "  - https://a.example", 'version: "${VERSION}"'].join("\n"),
    );

    const config = loadConfig(file, { env: { VERSION: "2026-01-01" } });
    expect(config.version).toBe("2026-01-01");
  });

  test("validates by default and throws for empty nodes", () => {
    const file = writeConfig("nodes: []");
    expect(() => loadConfig(file, { env: {} })).toThrow(/non-empty `nodes`/);
  });

  test("skips validation when validate is false", () => {
    const file = writeConfig("nodes: []");
    expect(() => loadConfig(file, { validate: false, env: {} })).not.toThrow();
  });

  test("exits the process when the file is missing", () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const exit = jest.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    expect(() => loadConfig(path.join(tmpDir, "missing.yaml"))).toThrow(
      "process.exit called",
    );
    expect(exit).toHaveBeenCalledWith(1);

    error.mockRestore();
    exit.mockRestore();
  });
});
