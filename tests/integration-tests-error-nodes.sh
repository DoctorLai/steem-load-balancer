#!/bin/bash
## This script is used to run integration tests for the steem load balancer
## It builds the docker image, runs the server, and sends a GET request to the server
## It checks if the server is up and running and if the response is correct.

## required env var STEEM_LB_PATH
if [ -z "$STEEM_LB_PATH" ]; then
    echo "STEEM_LB_PATH is not set"
    exit 1
fi

source ./retry-tests.sh

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

./run.sh $STEEM_LB_PATH/tests/test_config_error_nodes.yaml &

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

popd


## This tests the load balancer by sending a GET request with header to the server and checking the response
## which should be a 500 error because all requests should be failed: No valid node found
## curl -s -H "Content-type:application/json" https://api.steemyy.com | jq
send_a_get_request_header_when_all_nodes_are_down() {
    ## send a GET request
    ## curl -s https://api.steemyy.com | jq 
    resp_status_code=$(curl -m 5 -o /dev/null -s -w "%{http_code}\n" http://127.0.0.1:443/)

    if [ "$resp_status_code" != "500" ]; then
        echo "send_a_get_request_header failed with http response code: $resp_status_code"
        return 1
    fi
    echo "send_a_get_request_header_when_all_nodes_are_down passed! (response code: $resp_status_code)"
    return 0
}

if ! retry_test send_a_get_request_header_when_all_nodes_are_down; then
    echo "send_a_get_request_header_when_all_nodes_are_down failed"
    RESULT=false
else
    echo "send_a_get_request_header_when_all_nodes_are_down passed"
    RESULT=true
fi

echo "Stopping the server..."
$STEEM_LB_PATH/stop.sh

if [ "$RESULT" = false ]; then
    echo "Integration tests failed!"
    exit 1
fi
echo "All integration tests passed!"
exit 0
