#!/bin/bash

# Setup Cloudflare KV Namespaces for Email System
# Run this before deploying the email system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ENVIRONMENT=${1:-staging}

echo -e "${BLUE}🗄️  Setting up Cloudflare KV Namespaces${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Please install: npm install -g wrangler${NC}"
    exit 1
fi

# Check if logged into Cloudflare
if ! wrangler whoami &> /dev/null; then
    echo -e "${RED}❌ Not logged into Cloudflare. Please run: wrangler login${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Creating KV namespaces...${NC}"

# Create KV namespaces
declare -A NAMESPACES
NAMESPACES=(
    ["EMAIL_STORE"]="email-store-${ENVIRONMENT}"
    ["FEEDBACK_STORE"]="feedback-store-${ENVIRONMENT}"
    ["METRICS"]="metrics-${ENVIRONMENT}"
    ["DLQ"]="dlq-${ENVIRONMENT}"
    ["DEPLOYMENT_STORE"]="deployment-store-${ENVIRONMENT}"
    ["WORKER_REGISTRY"]="worker-registry-${ENVIRONMENT}"
)

# Store namespace IDs
declare -A NAMESPACE_IDS

for BINDING in "${!NAMESPACES[@]}"; do
    NAMESPACE_NAME="${NAMESPACES[$BINDING]}"

    echo -e "${BLUE}Creating namespace: ${NAMESPACE_NAME}${NC}"

    # Create namespace and capture ID
    OUTPUT=$(wrangler kv:namespace create "${NAMESPACE_NAME}" 2>&1)

    if [[ $OUTPUT == *"already exists"* ]]; then
        echo -e "${YELLOW}⚠️  Namespace ${NAMESPACE_NAME} already exists${NC}"

        # Get existing namespace ID
        NAMESPACE_ID=$(wrangler kv:namespace list | grep "${NAMESPACE_NAME}" | awk '{print $2}' | tr -d '"')
    else
        # Extract ID from creation output
        NAMESPACE_ID=$(echo "$OUTPUT" | grep -o 'id = "[^"]*"' | cut -d'"' -f2)
    fi

    if [ -n "$NAMESPACE_ID" ]; then
        NAMESPACE_IDS["${BINDING}_KV_ID"]="$NAMESPACE_ID"
        echo -e "${GREEN}✅ ${BINDING}: ${NAMESPACE_ID}${NC}"
    else
        echo -e "${RED}❌ Failed to create/get namespace: ${NAMESPACE_NAME}${NC}"
        echo -e "${RED}Output: ${OUTPUT}${NC}"
        exit 1
    fi
done

echo ""
echo -e "${YELLOW}📝 Updating environment file...${NC}"

# Update .env file with namespace IDs
ENV_FILE=".env.${ENVIRONMENT}"

# Create backup
cp "$ENV_FILE" "${ENV_FILE}.backup"

# Update environment file
for BINDING_ID in "${!NAMESPACE_IDS[@]}"; do
    NAMESPACE_ID="${NAMESPACE_IDS[$BINDING_ID]}"

    if grep -q "^${BINDING_ID}=" "$ENV_FILE"; then
        # Update existing line
        sed -i.bak "s/^${BINDING_ID}=.*/${BINDING_ID}=${NAMESPACE_ID}/" "$ENV_FILE"
    else
        # Add new line
        echo "${BINDING_ID}=${NAMESPACE_ID}" >> "$ENV_FILE"
    fi

    echo -e "${GREEN}✅ Updated ${BINDING_ID}=${NAMESPACE_ID}${NC}"
done

# Clean up backup files
rm -f "${ENV_FILE}.bak"

echo ""
echo -e "${GREEN}🎉 KV Namespaces Setup Complete!${NC}"
echo ""
echo -e "${BLUE}📊 Created Namespaces:${NC}"

for BINDING in "${!NAMESPACES[@]}"; do
    NAMESPACE_NAME="${NAMESPACES[$BINDING]}"
    NAMESPACE_ID="${NAMESPACE_IDS["${BINDING}_KV_ID"]}"
    echo -e "${GREEN}✅ ${BINDING}: ${NAMESPACE_NAME} (${NAMESPACE_ID})${NC}"
done

echo ""
echo -e "${BLUE}📝 Environment file updated: ${ENV_FILE}${NC}"
echo -e "${YELLOW}💡 You can now run: ./deploy-email-system.sh ${ENVIRONMENT}${NC}"