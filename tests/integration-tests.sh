#!/bin/bash

## required env var STEEM_LB_PATH
if [ -z "$STEEM_LB_PATH" ]; then
    echo "STEEM_LB_PATH is not set"
    exit 1
fi

## build-and-run
pushd $STEEM_LB_PATH
./build.sh
./run.sh &

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

## send some requests
resp=$(curl -k -s -m 5 http://127.0.0.1:443/)
echo "Response: $resp"

docker kill $DOCKER_IMAGE || true
docker rm $DOCKER_IMAGE || true

resp_status=$(echo $resp | jq -r '.status')
resp_status_code=$(echo $resp | jq -r '.status_code')
if [ "$resp_status" != "OK" ] || [ "$resp_status_code" != "200" ]; then
    echo "Integration test failed: $resp"
    exit 1
else
    echo "Integration test passed!"
    exit 0
fi

popd
