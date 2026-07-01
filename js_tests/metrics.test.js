import { renderPrometheusMetrics, escapeLabelValue } from "../src/metrics.js";
import { Counters } from "../src/counters.js";
import { CircuitBreaker } from "../src/circuit-breaker.js";

describe("escapeLabelValue", () => {
  test("escapes backslashes, quotes and newlines", () => {
    expect(escapeLabelValue('a"b\\c\nd')).toBe('a\\"b\\\\c\\nd');
  });
});

describe("renderPrometheusMetrics", () => {
  test("emits HELP/TYPE headers and the total counter", () => {
    const counters = new Counters();
    const output = renderPrometheusMetrics(counters, {
      startTimeMs: Date.now(),
    });

    expect(output).toContain("# HELP steem_lb_requests_total");
    expect(output).toContain("# TYPE steem_lb_requests_total counter");
    expect(output).toContain("steem_lb_requests_total 0");
    expect(output.endsWith("\n")).toBe(true);
  });

  test("includes per-node access and error series with labels", async () => {
    const counters = new Counters();
    await counters.incrementAccess("https://a.example");
    await counters.incrementAccess("https://a.example");
    await counters.incrementError("https://a.example");

    const output = renderPrometheusMetrics(counters, {});

    expect(output).toContain(
      'steem_lb_node_access_total{server="https://a.example"} 2',
    );
    expect(output).toContain(
      'steem_lb_node_error_total{server="https://a.example"} 1',
    );
  });

  test("computes uptime from startTimeMs and now", () => {
    const counters = new Counters();
    const output = renderPrometheusMetrics(counters, {
      startTimeMs: 1000,
      now: 6000,
    });
    expect(output).toContain("steem_lb_uptime_seconds 5");
  });

  test("emits requests-per-second windows", () => {
    const counters = new Counters();
    const output = renderPrometheusMetrics(counters, {});
    expect(output).toContain('steem_lb_requests_per_second{window="1min"}');
    expect(output).toContain('steem_lb_requests_per_second{window="5min"}');
    expect(output).toContain('steem_lb_requests_per_second{window="15min"}');
  });

  test("includes circuit breaker state when provided", () => {
    const counters = new Counters();
    const cb = new CircuitBreaker({
      enabled: true,
      failureThreshold: 1,
      cooldownMs: 10000,
      now: () => 0,
    });
    cb.recordFailure("https://bad.example");

    const output = renderPrometheusMetrics(counters, {
      now: 0,
      circuitBreaker: cb,
    });

    expect(output).toContain("# TYPE steem_lb_circuit_breaker_open gauge");
    expect(output).toContain(
      'steem_lb_circuit_breaker_open{server="https://bad.example"} 1',
    );
  });

  test("omits uptime when startTimeMs is absent", () => {
    const counters = new Counters();
    const output = renderPrometheusMetrics(counters, {});
    expect(output).not.toContain("steem_lb_uptime_seconds");
  });

  test("omits max_jussi_number on cold start (no data yet)", () => {
    const counters = new Counters();
    // maxJussi defaults to -1 before any healthy probe.
    const output = renderPrometheusMetrics(counters, {});
    expect(output).not.toContain("steem_lb_max_jussi_number");
  });

  test("emits max_jussi_number once a jussi number is observed", async () => {
    const counters = new Counters();
    await counters.updateMaxJussi(12345);
    const output = renderPrometheusMetrics(counters, {});
    expect(output).toContain("# TYPE steem_lb_max_jussi_number gauge");
    expect(output).toContain("steem_lb_max_jussi_number 12345");
  });
});
