#!/bin/bash
set -x
DOCKER_IMAGE=steem-load-balancer
NODE_ENV=production
RETRY_COUNT=20
SSL_CERT_PATH=$SSL_CERT_PATH
SSL_KEY_PATH=$SSL_KEY_PATH

## listen to port 443 (HTTPS)
HOST_PORT=443

# stop existing deployment (remove container by name)
docker kill $DOCKER_IMAGE || true
docker rm $DOCKER_IMAGE || true

# Build the Docker image
docker build -t $DOCKER_IMAGE .

# Run the steem load balancer node with restart policy
docker run \
    -e NODE_ENV=$NODE_ENV \
    -e SSL_CERT_PATH=$SSL_CERT_PATH \
    -e SSL_KEY_PATH=$SSL_KEY_PATH \
    --name $DOCKER_IMAGE \
    --restart on-failure:$RETRY_COUNT \
    -p $HOST_PORT:8080 \
    -v /root/.acme.sh/:/root/.acme.sh/ \
    $DOCKER_IMAGE
