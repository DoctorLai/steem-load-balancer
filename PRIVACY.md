# Privacy

## Project Services

Steem Load Balancer is self-hosted server software. The project maintainers do
not receive traffic, request bodies, IP addresses, or metrics from independent
deployments of this software.

GitHub and Docker Hub process information when you use their services. Their
respective privacy policies apply to repository activity and image downloads.

## Self-Hosted Deployments

An operator controls the configuration, logs, network infrastructure, and
upstream RPC nodes for each deployment. Depending on that configuration, request
metadata and bodies can appear in logs or be sent to upstream nodes. Operators
are responsible for publishing an appropriate privacy notice, selecting lawful
retention periods, securing logs, and complying with applicable law.

The application has no browser UI and does not use cookies or browser
`localStorage`. It does not include telemetry that reports deployment data to
the project maintainers.

## Data Minimization

Operators should disable request logging when it is unnecessary, keep
`logging_max_body_len` small, avoid placing secrets in request bodies, and
restrict access to logs and the metrics endpoint.

Privacy concerns about this repository can be raised through the channels in
[SUPPORT.md](SUPPORT.md). Report security vulnerabilities according to
[SECURITY.md](SECURITY.md).