#!/bin/bash

retry_test() {
    RETRY=6
    INTERVAL=1
    TESTS_PASSING=false
    for i in $(seq 1 $RETRY); do
        echo "Testing $1 (Counter = $i)..."
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
    echo "$1 passed!"
    return 0
}
