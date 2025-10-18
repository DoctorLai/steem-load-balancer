# Steem Load Balancer
[![Node.js CI](https://github.com/DoctorLai/steem-load-balancer/actions/workflows/ci.yaml/badge.svg?branch=main)](https://github.com/DoctorLai/steem-load-balancer/actions/workflows/ci.yaml)

Here is the [AI-generated documentation](https://deepwiki.com/DoctorLai/steem-load-balancer/) by Deep-Wiki.

## Overview
The Steem Load Balancer is a Node.js-based application designed to distribute API requests across a list of predefined Steem Blockchain RPC Nodes. It enhances application availability and reliability by routing requests to the most responsive node. 

This project was developed by STEEM's Top Witness, [@justyy](https://steemyy.com), who also established Two STEEM Load Balancer RPC Nodes, [steem.justyy.com](https://steem.justyy.com) (New York) and [api.steemyy.com](https://api.steemyy.com) (London), using this project as its foundation.

A similar service, [https://steem.senior.workers.dev](https://steem.senior.workers.dev/), is based on CloudFlare Worker which runs at the CloudFlare Edge Network but comes with a daily quota of 100,000 requests.

Another similar service, [https://api2.steemyy.com](https://api2.steemyy.com) is based on CloudFlare's snippets. This node requires a CloudFlare Paid Plan (Pro+) and it will route to a quickest RPC node. See [steem-proxy-cloudflare](https://github.com/DoctorLai/steem-proxy-cloudflare) for more information.

![image](https://github.com/user-attachments/assets/02f6265d-1ad0-40b4-a5e7-a400dab689eb)

## Motivation
The primary motivation behind this project is to provide a scalable and reliable Load Balancer Node that can be integrated into applications to improve their availability and performance. Unlike CloudFlare-based solutions, this setup does not have a daily request quota, making it suitable for high-demand applications.

Please note that this can be easily configured to work with other Blockchains such as Hive and Blurt.

## Features
- Load Balancing: Distributes requests across multiple Steem API servers. The `jussi_num` and `status` are checked before a node is chosen (See below).
- Rate Limiting: Protects against abuse by limiting the number of requests. For example, maximum 300 requests per 60 second window. This can be set in the [config.yaml](./config.yaml).
- Logging: Provides detailed logs for debugging and monitoring.
- SSL Support: Configurable SSL certificates for secure HTTPS communication. Reject or Ignore the SSL certificates when forwarding the requests via the field `rejectUnauthorized` in [config.yaml](./config.yaml)

## How It Works?
The node first checks whether a previously selected node is still valid (i.e., the cached entry hasn't expired). If it is valid, the request is directly forwarded to that node. Otherwise, the system sends a `get_version` request to the candidate nodes listed in `config.nodes`. Among the first `config.firstK` nodes (default: 1), the node with the highest `jussi_num` value is selected, cached, and used for subsequent requests.

### Better Algorithms?
The Steem blockchain ensures idempotency at the transaction level when the signed content is identical. See [Testing Parallel Transfer on STEEM](https://steemit.com/steem/@justyy/testing-parallel-transfer-on-steem) which means that: 

> We can simplify the load-balancing logics. Just fan out the requests to multiple nodes and return the quickest response.

However, this is against the idea of load balancing. Faning out requests will be putting loads on RPC nodes.

### A Healthy Node
A Steem RPC node should return the following to indicate the healthy state. The `jussi_num` needs to catch up with the latest block height. If the `jussi_num` is far behind, e.g. the `max_jussi_number_diff` in [config.yaml](./config.yaml), then the node will not be considered. Currently, it is set to 100.

```json
{
  "status": "OK",
  "datetime": "2025-02-01T11:06:30.781448",
  "source_commit": "ae6c6c77601436e496a8816ece2cbc6e26fbe3c2",
  "docker_tag": "latest",
  "jussi_num": 92629431
}
```

## Configuration
The configuration for the Steem Load Balancer is specified in the [config.yaml](./config.yaml) file. Here's a breakdown of the configuration options:

Configuration File: [config.yaml](./config.yaml)
```yaml
nodes:
  - "https://api2.justyy.com"
  - "https://api.justyy.com"
  - "https://api.steemit.com"
  - "https://api.steemitdev.com"
  - "https://api.pennsif.net"
  - "https://api.moecki.online"
  - "https://api.botsteem.com"
  # - "https://rpc.amarbangla.net"
  # - "https://api.dlike.io"
  # - "https://api.campingclub.me"
  # - "https://api.wherein.io"
  # - "https://api.steememory.com"
  # - "https://steemapi.boylikegirl.club"
rateLimit:
  windowMs: 30000
  maxRequests: 600
version: "2025-03-07"
max_age: 3
logging: true
max_payload_size: "5mb"
max_jussi_number_diff: 500
min_blockchain_version: "0.23.0"
logging_max_body_len: 100
retry_count: 3
user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
sslCertPath: "${SSL_CERT_PATH}"
sslKeyPath: "${SSL_KEY_PATH}"
rejectUnauthorized: false
timeout: 2500
plimit: 5
port: 9091
cache:
  enabled: true
  ttl: 3
debug: false
firstK: 1
strategy: "max_jussi_number"  # options: first, random, max_jussi_number, latest_version
```

### Configuration Options
- nodes: An array of API server URLs to which requests will be distributed. You can add or remove nodes as needed.
- rateLimit: Configuration for rate limiting.
- windowMs: Time window in milliseconds for the rate limit (e.g., 60000 ms = 1 minute).
- maxRequests: Maximum number of requests allowed in the time window.
- version: The version of the Steem Load Balancer.
- max_age: Cache duration for responses in seconds (GET).
- logging: Boolean value to enable or disable logging.
- sslCertPath: Path to the SSL certificate file for HTTPS communication.
- sslKeyPath: Path to the SSL key file for HTTPS communication.
- user_agent: User Agent String in the Header to forward.
- min_blockchain_version: Min blockchain version number e.g. 0.23.0 to decide the validity of a node.
- max_payload_size: Max payload size.
- max_jussi_number_diff: The maximum difference of block difference is allowed.
- logging_max_body_len: truncate the request.body in log.
- retry_count: Retry count for GET and POST forward requests. There is a 100ms between retries.
- rejectUnauthorized: Should we ignore SSL errors? Default true.
- timeout: Max timeout (milliseconds) for fetch to time out.
- plimit: Max concurrent requests to poke the servers. Reduce this if the server is laggy.
- cache.enabled: Should we cache the chosen Node?
- cache.ttl: When cache.enabled, how many seconds before cache expires.
- debug: When set to debug, more messages are set e.g. in the response header.
- firstK: Choosing the node which has the max Jussi Number from the first `firstK` nodes that respond OK. Default is 1.
- strategy: The strategy to pick the chosen node. This can be one of: first, random, max_jussi_number (default), latest_version

## Installation
Clone the Repository:

```bash
git clone https://github.com/doctorlai/steem-load-balancer.git
cd steem-load-balancer
```

## Configure
Update the [config.yaml](./config.yaml) file with your desired nodes, rate limits, and SSL paths.

## Build the Docker Image
```bash
DOCKER_IMAGE=steem-load-balancer
STEEM_LB_PORT=9091

# Build the Docker image
docker build -t $DOCKER_IMAGE .
```

## Run the Server
```bash
docker run --name $DOCKER_IMAGE -p $STEEM_LB_PORT:9091 -v /root/.acme.sh/:/root/.acme.sh/ $DOCKER_IMAGE
```
![image](https://github.com/user-attachments/assets/ff6da76b-4506-4452-b742-04eeff7596b5)

## Build and Run
Use the following utility to build the docker and then start the server.

```bash
source ./setup-env.sh
./build.sh
./run.sh
```

And also, there are [stop](./stop.sh) and [restart](./restart.sh).

## Prebuilt Docker Image
A latest image has been built and store at docker hub, so you can do:

```bash
docker pull justyy/steem-load-balancer:latest
docker tag justyy/steem-load-balancer:latest steem-load-balancer:latest
```

Then:

```bash
# Run the steem load balancer node with restart policy
STEEM_LB_PORT=443
RETRY_COUNT=3

docker run \
    -e NODE_ENV=production \
    -e SSL_CERT_PATH=$SSL_CERT_PATH \
    -e SSL_KEY_PATH=$SSL_KEY_PATH \
    -e STEEM_LB_VERSION=$STEEM_LB_VERSION \
    --name steem-load-balancer \
    --restart on-failure:$RETRY_COUNT \
    -p $STEEM_LB_PORT:9091 \
    -v /root/.acme.sh/:/root/.acme.sh/ \
    steem-load-balancer:latest

## or simply
./run.sh # or ./restart.sh
```

## Docker Compose (Optional)
You can use the `docker-compose` or `docker compose` to build the load balancer:

```bash
docker-compose up --build -d
```

This will build and start the steem load balancer.

To view the logs using docker-compose, run:

```bash
docker-compose logs -f
```

To restart the docker-compose container, run:

```bash
docker-compose down  # Stop the containers
docker-compose up -d  # Start the containers in detached mode
```

Or simply:

```bash
docker-compose restart steem_lb
```

## Tests
Use the following script i.e. [integration-tests.sh](./tests/integration-tests.sh) to perform a basic integration test — it builds the Docker image, starts the server locally, sends a request, and verifies that the response has a 'status' of 'OK' with a status code of 200.

```bash
source ./setup-env.sh
## on success, exit code is 0.
## on failure, exit code is 1.
./tests/integration-tests.sh
```

Use [integration-tests-docker-compose.sh](./tests/integration-tests-docker-compose.sh) to test the steem load balancer via [docker-compose](./docker-compose.yml).

## Unit Tests
Run `npm test` to run the unit tests on the project.

## Tools
Tools are placed at [./tools](./tools/) directory.

## View the Logs
```bash
docker logs -f steem-load-balancer
```

## SSL Configuration
If you have SSL certificates, provide the paths in the [config.yaml](./config.yaml) file. If SSL is not configured or the certificate files are missing, the server will default to HTTP.

## Rate Limiting
The rate limiting configuration prevents abuse by restricting the number of requests a user can make within a given time window. Adjust the rateLimit settings in [config.yaml](./config.yaml) as needed.

## Logging
Enable logging by setting "logging": true in [config.yaml](./config.yaml). Logs will be printed to the console and can help with debugging and monitoring.

## Statistics
On the GET requests, the response JSON will show some additional data including statistics (including Uptime, Access Counters, Error Counters, Not Chosen Counters and Jussi Behind Counters):

See [a sample JSON response](./example-response.json) for sending a GET to the STEEM RPC Load Balancer.

## Running without Container
Port 9091 is the port number used in the container. However this can be changed in [config.yaml](./config.yaml). This is useful if you want to run the node directly e.g:

```bash
node src/index.js
```

## Troubleshooting
- Port 443 is already taken: Ensure no other process is using port 443. Use sudo lsof -i :443 to check. Change the port in the configuration if needed.
- SSL Certificate Issues: Ensure the SSL certificate and key files are in the correct format and paths are correctly specified.

## Choose a "stable" RPC node in your Steem App by using the Load Balancer Node
See [this post](https://steemit.com/steem/@justyy/choose-a-stable-rpc-node-in-your-steem-app-by-using-the-load-balancer-node),

### Example: Dynamic RPC Node Selection with Fallback
```python
load_balancing_nodes = [
    "https://api.steemyy.com",
    "https://api2.steemyy.com",
    "https://steem.justyy.com"
]

def node_rotator(nodes):
    """Infinite generator that yields nodes in round-robin."""
    while True:
        for node in nodes:
            yield node

def fetch_from_load_balancer(node):
    """Optional preprocessing, health check, or logging."""
    print(f"Selected node: {node}")
    return node

node_gen = node_rotator(load_balancing_nodes)
node = fetch_from_load_balancer(next(node_gen))

## Replace with your actual app loop condition
while True:
    try:
        # use the node in your API calls
        pass
    except Exception as e:
        print(f"Node error: {e}, switching node...")
        node = fetch_from_load_balancer(next(node_gen))
```

With this setup, your app will:
- Always start with a healthy RPC node
- Automatically switch to a new one if the current node fails
- This approach provides better stability and resilience compared to relying on a single hardcoded RPC endpoint.

## NODE_ENV
Setting NODE_ENV to "production" (by default) or "development".

![image](https://github.com/user-attachments/assets/58c343b9-0862-4560-91bd-e2b7cfd276f6)

## License
This project is licensed under the [MIT License](./LICENSE).

## Contributing?
Contribution are absolutely welcome! Please follow the guidance [here](./CONTRIBUTING.md) and [CODE OF CONDUCT](./CODE_OF_CONDUCT.md)

## Sibling Projects
- [steem-proxy-cloudflare](https://github.com/DoctorLai/steem-proxy-cloudflare)

## Support me
If you like this and want to support me in continuous development, you can do the following:
- [Buy me a coffee](https://justyy.com/out/bmc)
- [Sponsor me](https://github.com/sponsors/DoctorLai)
- [Vote me as a witness](https://steemyy.com/witness-voting/?witness=justyy&action=approve)
- [Set me a Witness Proxy if you are too lazy to vote](https://steemyy.com/witness-voting/?witness=justyy&action=proxy)

<a rel="nofollow" href="http://steemyy.com/out/buymecoffee" target="_blank"><img src="https://user-images.githubusercontent.com/1764434/161362754-c45a85d3-5c80-4e10-b05c-62af49291d0b.png" alt="Buy me a Coffee"/></a>
