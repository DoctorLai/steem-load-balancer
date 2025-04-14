#!/bin/bash

source ../setup-env.sh

export CACHE_ENABLED=true
export CACHE_TTL=3
$1

if [ "$RESULT" = false ]; then
    echo "Integration tests failed!"
    exit 1
fi

export CACHE_ENABLED=false
$1

if [ "$RESULT" = false ]; then
    echo "Integration tests failed!"
    exit 1
fi

echo "All integration tests passed!"
exit 0
