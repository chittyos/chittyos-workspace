#!/bin/bash
# ChittyRegister API Testing Script
# Usage: ./test-api.sh [BASE_URL]

BASE_URL="${1:-http://localhost:8787}"

echo "Testing ChittyRegister API at: $BASE_URL"
echo "============================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print test header
test_header() {
    echo -e "${BLUE}▶ $1${NC}"
}

# Function to print success
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print error
error() {
    echo -e "${RED}✗ $1${NC}"
}

# Test 1: Health Check
test_header "Test 1: Health Check"
response=$(curl -s "$BASE_URL/health")
if echo "$response" | grep -q "ok"; then
    success "Health check passed"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
else
    error "Health check failed"
    echo "$response"
fi
echo ""

# Test 2: Get Registry Status
test_header "Test 2: Registry Status"
response=$(curl -s "$BASE_URL/api/v1/status")
if echo "$response" | grep -q "statistics"; then
    success "Status endpoint working"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
else
    error "Status endpoint failed"
    echo "$response"
fi
echo ""

# Test 3: List Services (empty registry)
test_header "Test 3: List All Services"
response=$(curl -s "$BASE_URL/api/v1/services")
if echo "$response" | grep -q "services"; then
    success "List services working"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
else
    error "List services failed"
    echo "$response"
fi
echo ""

# Test 4: Register a service (valid)
test_header "Test 4: Register Valid Service"
response=$(curl -s -X POST "$BASE_URL/api/v1/register" \
    -H "Content-Type: application/json" \
    -H "X-Chitty-ID: test-user-001" \
    -d '{
        "name": "testservice",
        "version": "1.0.0",
        "type": "worker",
        "category": "Application",
        "description": "This is a test service for validating the registration system",
        "owner": "testuser",
        "endpoints": {
            "api": "https://testservice.chitty.cc/api",
            "health": "https://testservice.chitty.cc/health"
        },
        "metadata": {
            "repository": "https://github.com/test/testservice",
            "license": "MIT",
            "tags": ["test"]
        }
    }')
if echo "$response" | grep -q "success"; then
    success "Service registration successful"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
else
    error "Service registration failed"
    echo "$response"
fi
echo ""

# Test 5: Register with invalid name
test_header "Test 5: Register with Invalid Name (should fail)"
response=$(curl -s -X POST "$BASE_URL/api/v1/register" \
    -H "Content-Type: application/json" \
    -H "X-Chitty-ID: test-user-002" \
    -d '{
        "name": "Invalid_Name_123",
        "version": "1.0.0",
        "type": "worker",
        "category": "Application",
        "description": "This should fail validation due to invalid name",
        "owner": "testuser"
    }')
if echo "$response" | grep -q "errors"; then
    success "Validation working - invalid name rejected"
    echo "$response" | jq '.errors' 2>/dev/null || echo "$response"
else
    error "Validation failed - should have rejected invalid name"
    echo "$response"
fi
echo ""

# Test 6: Register with short description
test_header "Test 6: Register with Short Description (should fail)"
response=$(curl -s -X POST "$BASE_URL/api/v1/register" \
    -H "Content-Type: application/json" \
    -H "X-Chitty-ID: test-user-003" \
    -d '{
        "name": "shortdesc",
        "version": "1.0.0",
        "type": "worker",
        "category": "Application",
        "description": "Too short",
        "owner": "testuser"
    }')
if echo "$response" | grep -q "errors"; then
    success "Validation working - short description rejected"
    echo "$response" | jq '.errors' 2>/dev/null || echo "$response"
else
    error "Validation failed - should have rejected short description"
    echo "$response"
fi
echo ""

# Test 7: Get specific service
test_header "Test 7: Get Specific Service (testservice)"
response=$(curl -s "$BASE_URL/api/v1/services/testservice")
if echo "$response" | grep -q "testservice"; then
    success "Service retrieval working"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
else
    error "Service retrieval failed"
    echo "$response"
fi
echo ""

# Test 8: Get non-existent service
test_header "Test 8: Get Non-existent Service (should 404)"
response=$(curl -s "$BASE_URL/api/v1/services/doesnotexist")
if echo "$response" | grep -q "not found"; then
    success "404 handling working"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
else
    error "404 handling failed"
    echo "$response"
fi
echo ""

# Test 9: List services with filters
test_header "Test 9: List Services with Filters (type=worker)"
response=$(curl -s "$BASE_URL/api/v1/services?type=worker")
if echo "$response" | grep -q "services"; then
    success "Filtered listing working"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
else
    error "Filtered listing failed"
    echo "$response"
fi
echo ""

# Test 10: CORS preflight
test_header "Test 10: CORS Preflight (OPTIONS)"
response=$(curl -s -X OPTIONS "$BASE_URL/api/v1/services" -I)
if echo "$response" | grep -q "Access-Control-Allow"; then
    success "CORS headers present"
    echo "$response" | grep "Access-Control"
else
    error "CORS headers missing"
    echo "$response"
fi
echo ""

echo "============================================"
echo "Testing complete!"
