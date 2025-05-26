#!/bin/bash

source ./retry-tests.sh

config_version=$(cat config.yaml | grep version | awk '{print $2}' | tr -d '"' | head -n 1)

## This tests the load balancer by sending a GET request to the server and checking the response
## curl -s https://api.steemyy.com | jq
send_a_get_request() {
    ## send a GET request
    ## curl -s https://api.steemyy.com | jq 
    resp=$(curl -k -s -m 5 http://127.0.0.1:443/)
    echo "Response: $resp"

    ## get status, status_code, and __load_balancer_version__
    resp_status=$(echo $resp | jq -r '.status')
    resp_status_code=$(echo $resp | jq -r '.status_code')
    resp_load_balancer_version__=$(echo $resp | jq -r '.__load_balancer_version__')
    
    ## check if the response is OK and the version is correct
    if [ "$resp_status" != "OK" ] || [ "$resp_status_code" != "200" ] || [ "$resp_load_balancer_version__" != "$config_version" ]; then
        echo "send_a_get_request failed: $resp"
        return 1
    fi
    echo "send_a_get_request passed!"
    return 0
}

## This tests the load balancer by sending a GET request with header to the server and checking the response
## curl -s -H "Content-type:application/json" https://api.steemyy.com | jq
send_a_get_request_header() {
    ## send a GET request
    ## curl -s https://api.steemyy.com | jq 
    resp=$(curl -k -s -H "Content-type:application/json" -m 5 http://127.0.0.1:443/)
    echo "Response: $resp"

    ## get status, status_code, and __load_balancer_version__
    resp_status=$(echo $resp | jq -r '.status')
    resp_status_code=$(echo $resp | jq -r '.status_code')
    resp_load_balancer_version__=$(echo $resp | jq -r '.__load_balancer_version__')
    
    ## check if the response is OK and the version is correct
    if [ "$resp_status" != "OK" ] || [ "$resp_status_code" != "200" ] || [ "$resp_load_balancer_version__" != "$config_version" ]; then
        echo "send_a_get_request_header failed: $resp"
        return 1
    fi
    echo "send_a_get_request_header passed!"
    return 0
}

## This tests the load balancer by sending a POST request to the server and checking the response
## curl -s --data '{"jsonrpc":"2.0", "method":"condenser_api.get_account_count", "params":[], "id":1}' https://api.steemyy.com | jq
send_request_condenser_api_get_account_count() {    
    resp=$(curl -k -s -m 5 --data '{"jsonrpc":"2.0", "method": "condenser_api.get_account_count", "params": [], "id":1}' http://127.0.0.1:443/)
    echo "Response: $resp"

    ## resp = {"jsonrpc":"2.0","result":1931791,"id":1}
    ## get jsonrpc, result, and id
    resp_jsonrpc=$(echo $resp | jq -r '.jsonrpc')
    resp_result=$(echo $resp | jq -r '.result')
    resp_id=$(echo $resp | jq -r '.id')

    ## check if the response is OK and the version is correct
    ## check if resp_result is a valid number
    if [ "$resp_jsonrpc" != "2.0" ] || [ "$resp_id" != "1" ] || ! [[ "$resp_result" =~ ^[0-9]+$ ]]; then
        echo "send_request_condenser_api_get_account_count failed: $resp"
        return 1
    fi
    echo "send_request_condenser_api_get_account_count passed!"
    return 0
}

## This tests the load balancer by sending a POST request to the server and checking the response
## curl -s -H "Content-type:application/json" --data '{"jsonrpc":"2.0", "method":"condenser_api.get_account_count", "params":[], "id":1}' https://api.steemyy.com | jq
send_request_condenser_api_get_account_count_with_header() {    
    resp=$(curl -k -s -m 5 -H "Content-type:application/json" --data '{"jsonrpc": "2.0", "method": "condenser_api.get_account_count", "params": [], "id":1}' http://127.0.0.1:443/)
    echo "Response: $resp"

    ## resp = {"jsonrpc":"2.0","result":1931791,"id":1}
    ## get jsonrpc, result, and id
    resp_jsonrpc=$(echo $resp | jq -r '.jsonrpc')
    resp_result=$(echo $resp | jq -r '.result')
    resp_id=$(echo $resp | jq -r '.id')

    ## check if the response is OK and the version is correct
    ## check if resp_result is a valid number
    if [ "$resp_jsonrpc" != "2.0" ] || [ "$resp_id" != "1" ] || ! [[ "$resp_result" =~ ^[0-9]+$ ]]; then
        echo "send_request_condenser_api_get_account_count_with_header failed: $resp"
        return 1
    fi
    echo "send_request_condenser_api_get_account_count_with_header passed!"
    return 0
}

## {"id":0,"jsonrpc":"2.0","method":"call","params":["database_api","get_accounts",[["justyy"]]]}
## This tests the load balancer by sending a POST request to the server and checking the response
## curl -s --data '{"jsonrpc":"2.0", "method":"call", "params":["database_api","get_accounts",[["justyy"]]], "id":0}' https://api.steemyy.com | jq
send_request_database_api_get_accounts() {    
    resp=$(curl -k -s -m 5 --data '{"jsonrpc":"2.0", "method":"call", "params":["database_api","get_accounts",[["justyy"]]], "id":0}' http://127.0.0.1:443/)
    echo "Response: $resp"

    ## jsonrpc
    resp_jsonrpc=$(echo $resp | jq -r '.jsonrpc')
    ## result.id
    resp_result_id=$(echo $resp | jq -r '.result[0].id')
    ## result.name
    resp_result_name=$(echo $resp | jq -r '.result[0].name')

    ## Assertions
    if [ "$resp_jsonrpc" != "2.0" ] || [ "$resp_result_id" != "70955" ] || [ "$resp_result_name" != "justyy" ]; then
        echo "send_request_database_api_get_accounts failed: $resp"
        return 1
    fi
    echo "send_request_database_api_get_accounts passed!"
    return 0
}

## {"id":0,"jsonrpc":"2.0","method":"call","params":["database_api","get_accounts",[["justyy"]]]}
## This tests the load balancer by sending a POST request (with header) to the server and checking the response
## curl -s -H "Content-type:application/json" --data '{"jsonrpc":"2.0", "method":"call", "params":["database_api","get_accounts",[["justyy"]]], "id":0}' https://api.steemyy.com | jq
send_request_database_api_get_accounts_with_header() {    
    resp=$(curl -k -s -m 5 -H "Content-type:application/json" --data '{"jsonrpc":"2.0", "method":"call", "params":["database_api","get_accounts",[["justyy"]]], "id":0}' http://127.0.0.1:443/)
    echo "Response: $resp"

    ## jsonrpc
    resp_jsonrpc=$(echo $resp | jq -r '.jsonrpc')
    ## result.id
    resp_result_id=$(echo $resp | jq -r '.result[0].id')
    ## result.name
    resp_result_name=$(echo $resp | jq -r '.result[0].name')

    ## Assertions
    if [ "$resp_jsonrpc" != "2.0" ] || [ "$resp_result_id" != "70955" ] || [ "$resp_result_name" != "justyy" ]; then
        echo "send_request_database_api_get_accounts_with_header failed: $resp"
        return 1
    fi
    echo "send_request_database_api_get_accounts_with_header passed!"
    return 0
}

export RESULT=true

TEST_CASES=(
    "send_request_database_api_get_accounts"
    "send_request_database_api_get_accounts_with_header"
    "send_a_get_request_header"
    "send_a_get_request"
    "send_request_condenser_api_get_account_count"
    "send_request_condenser_api_get_account_count_with_header"
)

for test_case in "${TEST_CASES[@]}"; do
    echo "Running test case: $test_case"
    if ! retry_test $test_case; then
        export RESULT=false
        break
    fi
done
