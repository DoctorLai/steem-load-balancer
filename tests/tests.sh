#!/bin/bash

source ./retry-tests.sh

config_version=$(cat config.yaml | grep version | awk '{print $2}' | tr -d '"' | head -n 1)
config_version=$(eval echo $config_version)

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

## Response: {"status":"OK","datetime":"2025-10-18T18:40:51.878775","source_commit":"ae6c6c77601436e496a8816ece2cbc6e26fbe3c2","docker_tag":"latest","jussi_num":100078097,"status_code":200,"__server__":"https://api.steemit.com","__version__":{"id":0,"jsonrpc":"2.0","result":{"blockchain_version":"0.23.0","steem_revision":"5feab9b78d30a37506f252d7c72cfcdc88c34231","fc_revision":"5feab9b78d30a37506f252d7c72cfcdc88c34231"}},"__selected__":{"server":"https://api.steemit.com","version":{"id":0,"jsonrpc":"2.0","result":{"blockchain_version":"0.23.0","steem_revision":"5feab9b78d30a37506f252d7c72cfcdc88c34231","fc_revision":"5feab9b78d30a37506f252d7c72cfcdc88c34231"}},"jussi_number":100078097,"latencyMs":150.41480100000012,"timestamp":1760812851615},"__servers__":["https://api.moecki.online","https://api.justyy.com","https://api.steemit.com","https://api.steemitdev.com","https://api2.justyy.com","https://api.pennsif.net","https://steemapi.boylikegirl.club","https://api.botsteem.com"],"__ip__":"::ffff:172.17.0.1","__config__":{"strategy":"max_jussi_number","firstK":2,"timeout":2000,"user_agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36","min_blockchain_version":"0.23.0","max_jussi_number_diff":500,"cache_enabled":"true","cache_ttl":"3"},"__first_k_candidates__":[{"server":"https://api.steemit.com","version":{"id":0,"jsonrpc":"2.0","result":{"blockchain_version":"0.23.0","steem_revision":"5feab9b78d30a37506f252d7c72cfcdc88c34231","fc_revision":"5feab9b78d30a37506f252d7c72cfcdc88c34231"}},"jussi_number":100078097,"latencyMs":150.41480100000012,"timestamp":1760812851615},{"server":"https://api.justyy.com","version":{"id":0,"jsonrpc":"2.0","result":{"blockchain_version":"0.23.1","steem_revision":"46c7d93db350e8b031a81626e727c92b27d7348b","fc_revision":"46c7d93db350e8b031a81626e727c92b27d7348b"}},"jussi_number":100078097,"latencyMs":174.69748099999993}],"__load_balancer_version__":"f3805da766aa8cde0c1b76685564eba91c73ff8a","__stats__":{"total":3,"rps":1.5,"rps_stats":{"1min":0.05,"5min":0.01,"15min":0},"rate_limit":{"windowMs":10000,"maxRequests":600},"seconds":2,"uptime":{"startTime":"2025-10-18T18:40:49.610Z","currentTime":"2025-10-18T18:40:51.615Z","seconds":2,"minutes":0,"hours":0,"days":0,"month":0,"year":0},"access_counters":{"https://api.justyy.com":{"percent":66.67,"count":2},"https://api.steemit.com":{"percent":33.33,"count":1}},"error_counters":{},"not_chosen_counters":{},"jussi_behind_counters":{},"timed_out_counters":{}}}
# {
#   "status": "OK",
#   "datetime": "2025-10-18T18:40:51.878775",
#   "source_commit": "ae6c6c77601436e496a8816ece2cbc6e26fbe3c2",
#   "docker_tag": "latest",
#   "jussi_num": 100078097,
#   "status_code": 200,
#   "__server__": "https://api.steemit.com",
#   "__version__": {
#     "id": 0,
#     "jsonrpc": "2.0",
#     "result": {
#       "blockchain_version": "0.23.0",
#       "steem_revision": "5feab9b78d30a37506f252d7c72cfcdc88c34231",
#       "fc_revision": "5feab9b78d30a37506f252d7c72cfcdc88c34231"
#     }
#   },
#   "__selected__": {
#     "server": "https://api.steemit.com",
#     "version": {
#       "id": 0,
#       "jsonrpc": "2.0",
#       "result": {
#         "blockchain_version": "0.23.0",
#         "steem_revision": "5feab9b78d30a37506f252d7c72cfcdc88c34231",
#         "fc_revision": "5feab9b78d30a37506f252d7c72cfcdc88c34231"
#       }
#     },
#     "jussi_number": 100078097,
#     "latencyMs": 150.41480100000012,
#     "timestamp": 1760812851615
#   },
#   "__servers__": [
#     "https://api.moecki.online",
#     "https://api.justyy.com",
#     "https://api.steemit.com",
#     "https://api.steemitdev.com",
#     "https://api2.justyy.com",
#     "https://api.pennsif.net",
#     "https://steemapi.boylikegirl.club",
#     "https://api.botsteem.com"
#   ],
#   "__ip__": "::ffff:172.17.0.1",
#   "__config__": {
#     "strategy": "max_jussi_number",
#     "firstK": 2,
#     "timeout": 2000,
#     "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
#     "min_blockchain_version": "0.23.0",
#     "max_jussi_number_diff": 500,
#     "cache_enabled": "true",
#     "cache_ttl": "3"
#   },
#   "__first_k_candidates__": [
#     {
#       "server": "https://api.steemit.com",
#       "version": {
#         "id": 0,
#         "jsonrpc": "2.0",
#         "result": {
#           "blockchain_version": "0.23.0",
#           "steem_revision": "5feab9b78d30a37506f252d7c72cfcdc88c34231",
#           "fc_revision": "5feab9b78d30a37506f252d7c72cfcdc88c34231"
#         }
#       },
#       "jussi_number": 100078097,
#       "latencyMs": 150.41480100000012,
#       "timestamp": 1760812851615
#     },
#     {
#       "server": "https://api.justyy.com",
#       "version": {
#         "id": 0,
#         "jsonrpc": "2.0",
#         "result": {
#           "blockchain_version": "0.23.1",
#           "steem_revision": "46c7d93db350e8b031a81626e727c92b27d7348b",
#           "fc_revision": "46c7d93db350e8b031a81626e727c92b27d7348b"
#         }
#       },
#       "jussi_number": 100078097,
#       "latencyMs": 174.69748099999993
#     }
#   ],
#   "__load_balancer_version__": "f3805da766aa8cde0c1b76685564eba91c73ff8a",
#   "__stats__": {
#     "total": 3,
#     "rps": 1.5,
#     "rps_stats": {
#       "1min": 0.05,
#       "5min": 0.01,
#       "15min": 0
#     },
#     "rate_limit": {
#       "windowMs": 10000,
#       "maxRequests": 600
#     },
#     "seconds": 2,
#     "uptime": {
#       "startTime": "2025-10-18T18:40:49.610Z",
#       "currentTime": "2025-10-18T18:40:51.615Z",
#       "seconds": 2,
#       "minutes": 0,
#       "hours": 0,
#       "days": 0,
#       "month": 0,
#       "year": 0
#     },
#     "access_counters": {
#       "https://api.justyy.com": {
#         "percent": 66.67,
#         "count": 2
#       },
#       "https://api.steemit.com": {
#         "percent": 33.33,
#         "count": 1
#       }
#     },
#     "error_counters": {},
#     "not_chosen_counters": {},
#     "jussi_behind_counters": {},
#     "timed_out_counters": {}
#   }
# }
send_a_get_request_header() {
    ## send a GET request
    resp=$(curl -k -s -H "Content-type:application/json" -m 5 http://127.0.0.1:443/)
    echo "Response: $resp"

    ## required top-level fields
    required_fields=("status" "datetime" "source_commit" "docker_tag" "jussi_num" "status_code" "__server__" "__version__" "__selected__" "__servers__" "__ip__" "__config__" "__first_k_candidates__" "__load_balancer_version__" "__stats__")

    for field in "${required_fields[@]}"; do
        exists=$(echo "$resp" | jq -e ".${field}" >/dev/null 2>&1; echo $?)
        if [ "$exists" -ne 0 ]; then
            echo "Field $field missing in response!"
            return 1
        fi
    done

    ## check some specific values
    resp_status=$(echo "$resp" | jq -r '.status')
    resp_status_code=$(echo "$resp" | jq -r '.status_code')
    resp_lb_version=$(echo "$resp" | jq -r '.__load_balancer_version__')

    if [ "$resp_status" != "OK" ] || [ "$resp_status_code" != "200" ] || [ "$resp_lb_version" != "$config_version" ]; then
        echo "Response check failed!"
        echo "Expected status=OK, status_code=200, load_balancer_version=$config_version"
        echo "Got status=$resp_status, status_code=$resp_status_code, load_balancer_version=$resp_lb_version"
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
