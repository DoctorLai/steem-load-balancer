#!/bin/bash
## This script is used to run integration tests for the steem load balancer
## It builds the docker image using docker-compose, runs the server, and sends a GET request to the server
## It checks if the server is up and running and if the response is correct.

## required env var STEEM_LB_PATH
if [ -z "$STEEM_LB_PATH" ]; then
    echo "STEEM_LB_PATH is not set"
    exit 1
fi

## build-and-run
if ! pushd $STEEM_LB_PATH; then
    echo "Failed to pushd to $STEEM_LB_PATH"
    exit 1
fi

docker-compose down

echo "Starting the server via docker-compose up -d..."
docker-compose up -d

MAX_TIMEOUT_SEC=300
while :
do
    echo "Waiting for the server to start..."
    # check $DOCKER_IMAGE status via docker ps
    status=$(docker ps | grep $DOCKER_IMAGE | awk '{print $7}')
    if [ "$status" == "Up" ]; then
        break
    fi
    ## check if timeout
    if [ $MAX_TIMEOUT_SEC -le 0 ]; then
        echo "Timeout: Server did not start"
        exit 1
    fi
    MAX_TIMEOUT_SEC=$((MAX_TIMEOUT_SEC-1))
    sleep 1
done

echo "Server is up and running"

## Running all Tests
source $STEEM_LB_PATH/tests/tests.sh
popd

echo "Stopping the server..."
docker-compose down

if [ "$RESULT" = false ]; then
    echo "Integration tests failed!"
    exit 1
fi
echo "All integration tests passed!"
exit 0
