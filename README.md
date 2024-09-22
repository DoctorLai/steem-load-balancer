# Steem Load Balancer

## Overview
The Steem Load Balancer is a Node.js-based application designed to distribute API requests across a list of predefined Steem Blockchain RPC Nodes. It enhances application availability and reliability by routing requests to the most responsive node. 

This project was developed by STEEM's Top Witness, [@justyy](https://steemyy.com), who also established Two STEEM Load Balancer RPC Nodes, [steem.justyy.com](https://steem.justyy.com) and [api.steemyy.com](https://api.steemyy.com), using this project as its foundation.

A similar service, [https://steem.senior.workers.dev/](https://steem.senior.workers.dev/), is based on CloudFlare but comes with a daily quota of 100,000 requests.

![image](https://github.com/user-attachments/assets/02f6265d-1ad0-40b4-a5e7-a400dab689eb)

## Motivation
The primary motivation behind this project is to provide a scalable and reliable Load Balancer Node that can be integrated into applications to improve their availability and performance. Unlike CloudFlare-based solutions, this setup does not have a daily request quota, making it suitable for high-demand applications.

Please note that this can be easily configured to work with other Blockchains such as Hive and Blurt.

## Features
- Load Balancing: Distributes requests across multiple Steem API servers.
- Rate Limiting: Protects against abuse by limiting the number of requests.
- Logging: Provides detailed logs for debugging and monitoring.
- SSL Support: Configurable SSL certificates for secure HTTPS communication.

## Configuration
The configuration for the Steem Load Balancer is specified in the [config.json](./config.json) file. Here's a breakdown of the configuration options:

Configuration File: config.json
```json
{
    "nodes": [
        "https://api.steemit.com",
        "https://api.steememory.com",
        "https://api.worldofxpilar.com",
        "https://steemapi.boylikegirl.club",
        "https://api.justyy.com",
        "https://api.campingclub.me",
        "https://api.dlike.io",
        "https://api.pennsif.net",
        "https://api.worldofxpilar.com",
        "https://api.moecki.online"
    ],
    "rateLimit": {
        "windowMs": 60000,
        "maxRequests": 300
    },
    "version": "2024-09-22",
    "max_age": 3,
    "logging": true,
    "max_payload_size": "5mb",
    "max_jussi_number_diff": 100,
    "min_blockchain_version": "0.23.0",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    "sslCertPath": "/root/.acme.sh/steem.justyy.com_ecc/fullchain.cer",
    "sslKeyPath": "/root/.acme.sh/steem.justyy.com_ecc/steem.justyy.com.key"
}
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
- max_jussi_number_diff: Not used yet.

## Installation
Clone the Repository:

```bash
git clone https://github.com/doctorlai/steem-load-balancer.git
cd steem-load-balancer
```

## Configure
Update the config.json file with your desired nodes, rate limits, and SSL paths.

## Build the Docker Image
```bash
DOCKER_IMAGE=steem-load-balancer
HOST_PORT=8080

# Build the Docker image
docker build -t $DOCKER_IMAGE .
```

## Run the Server
```bash
docker run --name $DOCKER_IMAGE -p $HOST_PORT:8080 -v /root/.acme.sh/:/root/.acme.sh/ $DOCKER_IMAGE
```
![image](https://github.com/user-attachments/assets/874e8051-2c0f-47f2-8480-e0acc7981200)

## ./build-and-run.sh
Use the following utility to build the docker and then start the server.

```bash
./build-and-run.sh
```

## View the Logs
```bash
docker logs -f steem-load-balancer
```

## SSL Configuration
If you have SSL certificates, provide the paths in the config.json file. If SSL is not configured or the certificate files are missing, the server will default to HTTP.

## Rate Limiting
The rate limiting configuration prevents abuse by restricting the number of requests a user can make within a given time window. Adjust the rateLimit settings in config.json as needed.

## Logging
Enable logging by setting "logging": true in config.json. Logs will be printed to the console and can help with debugging and monitoring.

## Troubleshooting
Port 443 is already taken: Ensure no other process is using port 443. Use sudo lsof -i :443 to check. Change the port in the configuration if needed.

SSL Certificate Issues: Ensure the SSL certificate and key files are in the correct format and paths are correctly specified.

## NODE_ENV
Setting NODE_ENV to "production" (by default) or "development".

![image](https://github.com/user-attachments/assets/58c343b9-0862-4560-91bd-e2b7cfd276f6)

## License
This project is licensed under the [MIT License](./LICENSE).
