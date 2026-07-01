// Render the runtime counters as a Prometheus text-format exposition
// (version 0.0.4). This is intentionally dependency-free: it walks the same
// `Counters` instance used elsewhere and emits `# HELP`/`# TYPE` headers plus
// one sample line per series. Scrape it from `/metrics`.

// Escape a Prometheus label value per the exposition format: backslash, double
// quote and newline must be escaped.
function escapeLabelValue(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

function metric(lines, name, help, type, samples) {
  lines.push(`# HELP ${name} ${help}`);
  lines.push(`# TYPE ${name} ${type}`);
  for (const { labels, value } of samples) {
    if (labels) {
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${escapeLabelValue(v)}"`)
        .join(",");
      lines.push(`${name}{${labelStr}} ${value}`);
    } else {
      lines.push(`${name} ${value}`);
    }
  }
}

function perServerSamples(map) {
  const samples = [];
  for (const [server, value] of map) {
    samples.push({ labels: { server }, value });
  }
  return samples;
}

// Build the full Prometheus exposition string for the supplied counters.
function renderPrometheusMetrics(
  counters,
  { startTimeMs, now = Date.now(), circuitBreaker } = {},
) {
  const lines = [];

  metric(
    lines,
    "steem_lb_requests_total",
    "Total proxied requests.",
    "counter",
    [{ value: counters.total }],
  );

  if (typeof startTimeMs === "number") {
    metric(
      lines,
      "steem_lb_uptime_seconds",
      "Process uptime in seconds.",
      "gauge",
      [{ value: Math.floor((now - startTimeMs) / 1000) }],
    );
  }

  // maxJussi starts at -1 (sentinel for "no data yet"); only emit once a
  // healthy node has actually reported a jussi number.
  if (counters.maxJussi >= 0) {
    metric(
      lines,
      "steem_lb_max_jussi_number",
      "Highest jussi number observed across healthy nodes.",
      "gauge",
      [{ value: counters.maxJussi }],
    );
  }

  metric(
    lines,
    "steem_lb_node_access_total",
    "Requests routed to each node.",
    "counter",
    perServerSamples(counters.access),
  );

  metric(
    lines,
    "steem_lb_node_error_total",
    "Forwarding errors per node (after retries).",
    "counter",
    perServerSamples(counters.error),
  );

  metric(
    lines,
    "steem_lb_node_not_chosen_total",
    "Times a node failed the health check and was not chosen.",
    "counter",
    perServerSamples(counters.notChosen),
  );

  metric(
    lines,
    "steem_lb_node_jussi_behind_total",
    "Times a node was rejected for lagging jussi number.",
    "counter",
    perServerSamples(counters.jussiBehind),
  );

  metric(
    lines,
    "steem_lb_node_timed_out_total",
    "Times a node timed out during the health check.",
    "counter",
    perServerSamples(counters.timedOut),
  );

  const rps = counters.calculateRPS();
  metric(
    lines,
    "steem_lb_requests_per_second",
    "Requests per second over rolling windows.",
    "gauge",
    [
      { labels: { window: "1min" }, value: rps["1min"] },
      { labels: { window: "5min" }, value: rps["5min"] },
      { labels: { window: "15min" }, value: rps["15min"] },
    ],
  );

  if (circuitBreaker && typeof circuitBreaker.getState === "function") {
    const state = circuitBreaker.getState(now);
    const samples = Object.entries(state).map(([server, s]) => ({
      labels: { server },
      value: s.open ? 1 : 0,
    }));
    metric(
      lines,
      "steem_lb_circuit_breaker_open",
      "Whether a node's circuit breaker is currently open (1) or closed (0).",
      "gauge",
      samples,
    );
  }

  return lines.join("\n") + "\n";
}

export { renderPrometheusMetrics, escapeLabelValue };
