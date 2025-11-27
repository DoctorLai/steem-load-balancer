#!/bin/bash
## required env var STEEM_LB_PATH
if [ -z "$STEEM_LB_PATH" ]; then
    echo "STEEM_LB_PATH is not set"
    exit 1
fi

# Stop the steem load balancer node
./stop.sh || true

# Start the steem load balancer node
./run.sh $1
