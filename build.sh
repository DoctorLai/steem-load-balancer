#!/bin/bash
## required env var STEEM_LB_PATH
if [ -z "$STEEM_LB_PATH" ]; then
    echo "STEEM_LB_PATH is not set"
    exit 1
fi

# stop existing deployment (remove container by name)
docker kill $DOCKER_IMAGE || true
docker rm $DOCKER_IMAGE || true

# Build the Docker image
docker build -t $DOCKER_IMAGE .
