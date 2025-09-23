#!/bin/bash

export STEEM_LB_PATH="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd)"
export DOCKER_IMAGE=justyy/steem-load-balancer
export NODE_ENV=production
export RETRY_COUNT=20
export SSL_CERT_PATH=$SSL_CERT_PATH
export SSL_KEY_PATH=$SSL_KEY_PATH
export CACHE_ENABLED=true
export CACHE_TTL=3

## listen to port 443 (HTTPS)
export STEEM_LB_PORT=443