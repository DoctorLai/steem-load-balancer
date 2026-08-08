# Contributing to Steem Load Balancer

Bug fixes, focused features, tests, and documentation improvements are welcome.

## Prerequisites

- Node.js 22 or newer. Node.js 24 is the recommended development version in `.nvmrc`.
- npm, included with Node.js.
- Docker and Docker Compose when changing container or integration behavior.

## Local Setup

```bash
git clone https://github.com/<your-username>/steem-load-balancer.git
cd steem-load-balancer
nvm use
npm ci
```

Create a focused branch from the latest `main`:

```bash
git checkout -b fix/short-description
```

## Making Changes

- Follow the existing ESM and formatting conventions.
- Add or update focused tests for behavior changes.
- Update `README.md` and `config.yaml` when configuration or public behavior changes.
- Do not commit credentials, private headers, certificates, or `.env` files.

Run the narrowest relevant test while developing, then run the complete local gate before pushing:

```bash
npm test -- js_tests/app.test.js
npm run check
```

Use `npm run test:integration` when changing startup, Docker, networking, or configuration behavior.

## Pull Requests

Keep pull requests scoped and explain the user-visible behavior, motivation, and test evidence. Complete the pull request checklist and link any related issue. CI must pass on all supported Node.js versions before merge.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately according to the [Security Policy](SECURITY.md); use GitHub Issues or Discussions for other questions.
