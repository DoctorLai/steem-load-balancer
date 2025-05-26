#!/bin/bash
## This script is used to run integration tests for the steem load balancer
## It builds the docker image, runs the server, and sends a GET request to the server
## It checks if the server is up and running and if the response is correct.

## required env var STEEM_LB_PATH
if [ -z "$STEEM_LB_PATH" ]; then
    echo "STEEM_LB_PATH is not set"
    exit 1
fi

source $STEEM_LB_PATH/tests/retry-tests.sh

## build-and-run
if ! pushd $STEEM_LB_PATH; then
    echo "Failed to pushd to $STEEM_LB_PATH"
    exit 1
fi

echo "Stopping any existing server..."
./stop.sh || true

echo "Building the docker image..."
if ! ./build.sh; then
    echo "Failed to build the docker image"
    exit 1
fi

echo "Starting the server..."

./run.sh $STEEM_LB_PATH/tests/test_config_empty_list.yaml &

sleep 5

count=$(docker logs steem-load-balancer | grep "No nodes provided in the configuration." | wc -l)
if [ "$count" -gt 0 ]; then
    echo "Server started successfully with empty node list"
    export RESULT=true
else
    echo "Failed: Server started successfully with empty node list"
    export RESULT=false
fi

popd

echo "Stopping the server..."
$STEEM_LB_PATH/stop.sh

if [ "$RESULT" != "true" ]; then
    echo "Integration tests failed!"
    exit 1
fi
echo "All integration tests passed!"
exit 0
