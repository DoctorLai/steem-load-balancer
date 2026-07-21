# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project follows [Semantic Versioning](https://semver.org/).

## Unreleased

## 1.1.0 - 2026-07-21

### Added

- Pluggable, weighted, sticky, and latency-aware routing strategies.
- Per-node circuit breaker with cooldown and fail-open behavior.
- Health, version, and Prometheus metrics endpoints.
- Jest coverage thresholds and pull request coverage reports.
- Reproducible CI, dependency updates, Docker health checks, and repository
  policies.

### Changed

- Require Node.js 22 or newer.
- Make `npm run check` validate linting, formatting, test coverage, and syntax.
- Use Express's built-in JSON parser and production-only Docker dependencies.

### Fixed

- Make the CSV statistics utility compatible with the project's ESM runtime.
- Always attempt forwarding once when retry count is zero or omitted.