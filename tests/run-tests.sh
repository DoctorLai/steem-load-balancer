#!/bin/bash

source ../setup-env.sh

export CACHE_ENABLED=true
export CACHE_TTL=3

if ! $1; then
    echo "Integration tests failed! Cache enabled tests failed!"
    exit 1
fi

export CACHE_ENABLED=false

if ! $1; then
    echo "Integration tests failed! Cache disabled tests failed!"
    exit 1
fi

echo "All integration tests passed!"
exit 0
