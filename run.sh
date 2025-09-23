#!/bin/bash
## required env var STEEM_LB_PATH
if [ -z "$STEEM_LB_PATH" ]; then
    echo "STEEM_LB_PATH is not set"
    exit 1
fi

config="$STEEM_LB_PATH/config.yaml"

if [ -z "$1" ]; then
    echo "No config file provided. Using default: $config"
else
    config="$1"
fi

if [ ! -f "$config" ]; then
    echo "Config file $config does not exist"
    exit 1
fi

# Run the steem load balancer node with restart policy
docker run \
    -e NODE_ENV=$NODE_ENV \
    -e SSL_CERT_PATH=$SSL_CERT_PATH \
    -e SSL_KEY_PATH=$SSL_KEY_PATH \
    -e CACHE_ENABLED=$CACHE_ENABLED \
    -e CACHE_TTL=$CACHE_TTL \
    --name $DOCKER_IMAGE \
    --restart on-failure:$RETRY_COUNT \
    -p $STEEM_LB_PORT:9091 \
    -v /root/.acme.sh/:/root/.acme.sh/ \
    -v $config:/app/config.yaml \
    $DOCKER_IMAGE
