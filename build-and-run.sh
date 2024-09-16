#!/bin/bash
set -x
DOCKER_IMAGE=steem-load-balancer

## listen to port 443 (HTTPS)
HOST_PORT=443

# stop existing deployment (remove container by name)
docker stop $DOCKER_IMAGE || true
docker rm $DOCKER_IMAGE || true

# Build the Docker image
docker build -t $DOCKER_IMAGE .

# Run the steem load balancer node with restart policy
docker run --name $DOCKER_IMAGE --restart always -p $HOST_PORT:8080 -v /root/.acme.sh/:/root/.acme.sh/ $DOCKER_IMAGE
