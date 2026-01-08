#!/bin/bash

# ChittyBeacon Setup Script
# This script helps set up the ChittyBeacon health monitoring service

set -e

echo "================================"
echo "ChittyBeacon Setup"
echo "================================"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "Error: wrangler is not installed"
    echo "Install it with: npm install -g wrangler"
    exit 1
fi

echo "Step 1: Installing dependencies..."
npm install
echo "Dependencies installed!"
echo ""

echo "Step 2: Creating KV namespaces..."
echo ""

echo "Creating production KV namespace..."
PROD_OUTPUT=$(wrangler kv:namespace create "HEALTH_HISTORY" 2>&1)
echo "$PROD_OUTPUT"
PROD_ID=$(echo "$PROD_OUTPUT" | grep -o 'id = "[^"]*"' | cut -d'"' -f2)

echo ""
echo "Creating preview KV namespace..."
PREVIEW_OUTPUT=$(wrangler kv:namespace create "HEALTH_HISTORY" --preview 2>&1)
echo "$PREVIEW_OUTPUT"
PREVIEW_ID=$(echo "$PREVIEW_OUTPUT" | grep -o 'preview_id = "[^"]*"' | cut -d'"' -f2)

echo ""
echo "================================"
echo "Setup Complete!"
echo "================================"
echo ""
echo "KV Namespace IDs created:"
echo "  Production: $PROD_ID"
echo "  Preview: $PREVIEW_ID"
echo ""
echo "Next steps:"
echo "1. Update wrangler.toml with the KV namespace IDs above"
echo "2. Update the kv_namespaces section to:"
echo ""
echo "   kv_namespaces = ["
echo "     { binding = \"HEALTH_HISTORY\", id = \"$PROD_ID\", preview_id = \"$PREVIEW_ID\" }"
echo "   ]"
echo ""
echo "3. Configure DNS in Cloudflare dashboard:"
echo "   - Add CNAME: beacon -> chittybeacon.workers.dev"
echo ""
echo "4. (Optional) Add scheduled triggers to wrangler.toml:"
echo "   [triggers]"
echo "   crons = [\"*/5 * * * *\"]"
echo ""
echo "5. Run 'npm run dev' to test locally"
echo "6. Run 'npm run deploy' to deploy to production"
echo ""
