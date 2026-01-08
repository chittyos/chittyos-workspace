#!/bin/bash

# ChittyBeacon Test Script
# Tests all API endpoints locally or in production

set -e

# Default to local development
BASE_URL="${1:-http://localhost:8787}"

echo "================================"
echo "ChittyBeacon API Tests"
echo "================================"
echo "Base URL: $BASE_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test_endpoint() {
  local method=$1
  local endpoint=$2
  local expected_status=$3
  local description=$4

  echo -n "Testing: $description... "

  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint")
  fi

  status_code=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | sed '$d')

  if [ "$status_code" = "$expected_status" ]; then
    echo -e "${GREEN}PASS${NC} (HTTP $status_code)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${RED}FAIL${NC} (Expected HTTP $expected_status, got HTTP $status_code)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

# Test JSON response
test_json_field() {
  local method=$1
  local endpoint=$2
  local field=$3
  local description=$4

  echo -n "Testing: $description... "

  if [ "$method" = "GET" ]; then
    response=$(curl -s "$BASE_URL$endpoint")
  else
    response=$(curl -s -X "$method" "$BASE_URL$endpoint")
  fi

  value=$(echo "$response" | jq -r ".$field")

  if [ "$value" != "null" ] && [ -n "$value" ]; then
    echo -e "${GREEN}PASS${NC} (found '$field')"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${RED}FAIL${NC} (field '$field' not found or null)"
    echo "Response: $response"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

echo "=== Endpoint Tests ==="
echo ""

# Test 1: Health endpoint
test_endpoint "GET" "/health" "200" "GET /health returns 200"
test_json_field "GET" "/health" "status" "GET /health has 'status' field"
test_json_field "GET" "/health" "timestamp" "GET /health has 'timestamp' field"

echo ""

# Test 2: Status endpoint
test_endpoint "GET" "/status" "200" "GET /status returns 200"
test_json_field "GET" "/status" "overall" "GET /status has 'overall' field"
test_json_field "GET" "/status" "services" "GET /status has 'services' field"
test_json_field "GET" "/status" "summary" "GET /status has 'summary' field"

echo ""

# Test 3: Service-specific status (may fail if no data yet)
echo -e "${YELLOW}Note: These may fail if no health checks have run yet${NC}"
test_endpoint "GET" "/status/schema" "200" "GET /status/schema returns 200"
test_endpoint "GET" "/status/auth" "200" "GET /status/auth returns 200"
test_endpoint "GET" "/status/api" "200" "GET /status/api returns 200"

echo ""

# Test 4: Check endpoint (trigger health check)
test_endpoint "POST" "/check" "200" "POST /check returns 200"
test_json_field "POST" "/check" "timestamp" "POST /check has 'timestamp' field"
test_json_field "POST" "/check" "summary" "POST /check has 'summary' field"
test_json_field "POST" "/check" "results" "POST /check has 'results' field"

echo ""

# Test 5: Not found endpoint
test_endpoint "GET" "/nonexistent" "404" "GET /nonexistent returns 404"

echo ""

# Test 6: CORS headers
echo -n "Testing: CORS headers present... "
cors_header=$(curl -s -I "$BASE_URL/health" | grep -i "access-control-allow-origin")
if [ -n "$cors_header" ]; then
  echo -e "${GREEN}PASS${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}FAIL${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""
echo "=== Test Summary ==="
echo "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed.${NC}"
  exit 1
fi
