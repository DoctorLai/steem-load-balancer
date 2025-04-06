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

config_version=$(cat config.yaml | grep version | awk '{print $2}' | tr -d '"' | head -n 1)

send_a_get_request() {
    ## send a request
    resp=$(curl -k -s -m 5 http://127.0.0.1:443/)
    echo "Response: $resp"

    ## get status, status_code, and __load_balancer_version__
    resp_status=$(echo $resp | jq -r '.status')
    resp_status_code=$(echo $resp | jq -r '.status_code')
    resp_load_balancer_version__=$(echo $resp | jq -r '.__load_balancer_version__')
    
    ## check if the response is OK and the version is correct
    if [ "$resp_status" != "OK" ] || [ "$resp_status_code" != "200" ] || [ "$resp_load_balancer_version__" != "$config_version" ]; then
        echo "Integration test failed: $resp"
        return 1
    fi
    echo "Integration test passed!"
    return 0
}

retry_test() {
    RETRY=6
    INTERVAL=1
    TESTS_PASSING=false
    for i in $(seq 1 $RETRY); do
        echo "Sending a GET request to the server (Counter = $i)..."
        if $1; then
            TESTS_PASSING=true
            break
        fi
        sleep $INTERVAL
    done
    if [ "$TESTS_PASSING" = false ]; then
        echo "$1 failed after $RETRY attempts"
        return 1
    fi
    echo "$1 passed"
    return 0
}

popd

RESULT=true

## Test GET request
if ! retry_test send_a_get_request; then
    RESULT=false
fi

docker-compose down

if [ "$RESULT" = false ]; then
    echo "Integration tests failed!"
    exit 1
fi
echo "All integration tests passed!"
exit 0
