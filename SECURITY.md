# Security Policy

## Supported Versions

The Steem Load Balancer is distributed from the `main` branch and the
[`justyy/steem-load-balancer`](https://hub.docker.com/r/justyy/steem-load-balancer)
Docker image. Security fixes are always applied to the latest release.

| Version        | Supported          |
| -------------- | ------------------ |
| `latest` / `main` | :white_check_mark: |
| older tags     | :x:                |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report privately using one of the following:

1. **GitHub Private Vulnerability Reporting** (preferred) - open the repository's
   [Security tab](https://github.com/DoctorLai/steem-load-balancer/security) and
   click **Report a vulnerability**.
2. Contact the maintainer via [https://steemyy.com](https://steemyy.com).

Please include:

- A description of the vulnerability and its impact.
- Steps to reproduce (proof of concept, affected endpoints, request payloads).
- Any suggested remediation.

You can expect an acknowledgement of your report, and we will keep you informed
as we work on a fix. Once resolved, we are happy to credit you in the release
notes unless you prefer to remain anonymous.

## Scope & Hardening Notes

This project is a reverse proxy / load balancer in front of public Steem RPC
nodes. When self-hosting, keep the following in mind:

- Run behind TLS (`sslCertPath` / `sslKeyPath`) in production.
- Keep the `rateLimit` settings enabled to mitigate abuse.
- Treat the `headers` shared-secret values (e.g. `X-Edge-Key`) as secrets and
  inject them via environment variables, never commit them.
- Keep dependencies up to date - Dependabot is enabled to help with this.
