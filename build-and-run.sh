#!/bin/bash
set -x
DOCKER_IMAGE=steem-load-balancer

## listen to port 443 (HTTPS)
HOST_PORT=443

# stop existing deployment
docker stop --name $DOCKER_IMAGE --force
docker rm --name $DOCKER_IMAGE

# Build the Docker image
docker build -t $DOCKER_IMAGE .

# Run the steem load balancer node
docker run --rm -p $HOST_PORT:8080 -v /root/.acme.sh/:/root/.acme.sh/ $DOCKER_IMAGE

