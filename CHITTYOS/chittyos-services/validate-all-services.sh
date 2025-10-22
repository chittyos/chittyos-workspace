#!/bin/bash

# ChittyOS Service Validation Script
# Tests all 17 production services and generates comprehensive report

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ChittyOS Service Validation - All 17 Services               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

SERVICES=(
  # Core Infrastructure
  "router:router.chitty.cc"
  "canon:canon.chitty.cc"
  "schema:schema.chitty.cc"
  "registry:registry.chitty.cc"
  "id:id.chitty.cc"
  "auth:auth.chitty.cc"
  "sync:sync.chitty.cc"
  "gateway:gateway.chitty.cc"

  # AI & Intelligence
  "ai-gateway:ai.chitty.cc"
  "agents:agents.chitty.cc"
  "langchain:langchain.chitty.cc"
  "mcp-agents:mcp.chitty.cc"
  "openai-oauth:openai.chitty.cc"

  # Platform Services
  "api:api.chitty.cc"
  "beacon:beacon.chitty.cc"
  "chat:chat.chitty.cc"
  "unified:unified.chitty.cc"
)

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL=0
HEALTHY=0
UNHEALTHY=0
AUTH_REQUIRED=0

# Results arrays
declare -a RESULTS_HEALTHY
declare -a RESULTS_AUTH
declare -a RESULTS_UNHEALTHY

echo "Testing all services..."
echo ""

for service_def in "${SERVICES[@]}"; do
  IFS=':' read -r name host <<< "$service_def"
  TOTAL=$((TOTAL + 1))

  # Test health endpoint
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' "https://$host/health" 2>/dev/null)
  RESPONSE=$(curl -s "https://$host/health" 2>/dev/null)

  # Categorize result
  if [ "$HTTP_CODE" = "200" ]; then
    HEALTHY=$((HEALTHY + 1))
    RESULTS_HEALTHY+=("$name:$host:$HTTP_CODE")
    echo -e "${GREEN}✅${NC} $name ($host) - HTTP $HTTP_CODE - HEALTHY"
  elif [ "$HTTP_CODE" = "403" ]; then
    AUTH_REQUIRED=$((AUTH_REQUIRED + 1))
    RESULTS_AUTH+=("$name:$host:$HTTP_CODE")
    echo -e "${YELLOW}🔒${NC} $name ($host) - HTTP $HTTP_CODE - AUTH REQUIRED (deployed)"
  else
    UNHEALTHY=$((UNHEALTHY + 1))
    RESULTS_UNHEALTHY+=("$name:$host:$HTTP_CODE")
    echo -e "${RED}❌${NC} $name ($host) - HTTP $HTTP_CODE - UNHEALTHY"
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Total Services: $TOTAL"
echo -e "${GREEN}Healthy (200):${NC} $HEALTHY"
echo -e "${YELLOW}Auth Required (403):${NC} $AUTH_REQUIRED"
echo -e "${RED}Unhealthy:${NC} $UNHEALTHY"
echo ""

OPERATIONAL=$((HEALTHY + AUTH_REQUIRED))
PERCENTAGE=$((OPERATIONAL * 100 / TOTAL))

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "OPERATIONAL: ${GREEN}$OPERATIONAL/$TOTAL${NC} (${PERCENTAGE}%)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Detailed Results
if [ ${#RESULTS_HEALTHY[@]} -gt 0 ]; then
  echo -e "${GREEN}HEALTHY SERVICES:${NC}"
  for result in "${RESULTS_HEALTHY[@]}"; do
    IFS=':' read -r name host code <<< "$result"
    echo "  ✅ $name - https://$host"
  done
  echo ""
fi

if [ ${#RESULTS_AUTH[@]} -gt 0 ]; then
  echo -e "${YELLOW}AUTH-REQUIRED SERVICES (Deployed, working):${NC}"
  for result in "${RESULTS_AUTH[@]}"; do
    IFS=':' read -r name host code <<< "$result"
    echo "  🔒 $name - https://$host"
  done
  echo ""
fi

if [ ${#RESULTS_UNHEALTHY[@]} -gt 0 ]; then
  echo -e "${RED}UNHEALTHY SERVICES:${NC}"
  for result in "${RESULTS_UNHEALTHY[@]}"; do
    IFS=':' read -r name host code <<< "$result"
    echo "  ❌ $name - https://$host (HTTP $code)"
  done
  echo ""
fi

# Test MCP Integration
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "MCP INTEGRATION TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test MCP agents endpoint
MCP_CODE=$(curl -s -o /dev/null -w '%{http_code}' "https://mcp.chitty.cc/agents" 2>/dev/null)
if [ "$MCP_CODE" = "200" ] || [ "$MCP_CODE" = "403" ]; then
  echo -e "${GREEN}✅${NC} MCP Agents Endpoint - HTTP $MCP_CODE"
else
  echo -e "${RED}❌${NC} MCP Agents Endpoint - HTTP $MCP_CODE"
fi

# Test LangChain integration
LANG_AGENTS=$(curl -s "https://langchain.chitty.cc/agents" 2>/dev/null | jq -r '.agents | length' 2>/dev/null)
if [ "$LANG_AGENTS" -gt 0 ]; then
  echo -e "${GREEN}✅${NC} LangChain Agents - $LANG_AGENTS models available"
else
  echo -e "${RED}❌${NC} LangChain Agents - Unable to fetch"
fi

# Test AI Gateway
AI_CODE=$(curl -s -o /dev/null -w '%{http_code}' "https://ai.chitty.cc/health" 2>/dev/null)
if [ "$AI_CODE" = "200" ]; then
  echo -e "${GREEN}✅${NC} AI Gateway - HTTP $AI_CODE"
else
  echo -e "${YELLOW}⚠️${NC}  AI Gateway - HTTP $AI_CODE"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "VALIDATION COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Exit code based on results
if [ $UNHEALTHY -gt 0 ]; then
  exit 1
else
  exit 0
fi
