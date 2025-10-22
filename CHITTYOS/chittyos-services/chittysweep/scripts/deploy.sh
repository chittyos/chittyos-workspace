#!/bin/bash
# ChittySweep deployment script

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "🧹 ChittySweep Deployment"
echo "========================="
echo ""

# Environment selection
ENVIRONMENT="${1:-production}"
echo "Environment: $ENVIRONMENT"
echo ""

# Pre-deployment checks
echo "🔍 Pre-deployment checks..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler not found. Install with: npm install -g wrangler"
    exit 1
fi
echo "✅ Wrangler installed"

# Check if logged in
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not logged in to Cloudflare. Run: wrangler login"
    exit 1
fi
echo "✅ Cloudflare authenticated"

# Check if KV namespaces exist
echo ""
echo "🗄️  Checking KV namespaces..."
wrangler kv:namespace list | grep -q "SWEEP_STATE" || echo "⚠️  SWEEP_STATE namespace may not exist"
wrangler kv:namespace list | grep -q "SWEEP_DISCOVERIES" || echo "⚠️  SWEEP_DISCOVERIES namespace may not exist"
wrangler kv:namespace list | grep -q "SWEEP_METRICS" || echo "⚠️  SWEEP_METRICS namespace may not exist"

# Check if R2 bucket exists
echo ""
echo "🪣 Checking R2 buckets..."
wrangler r2 bucket list | grep -q "chittysweep-logs" || echo "⚠️  chittysweep-logs bucket may not exist"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Run tests (if available)
if [ -f "test.js" ]; then
    echo ""
    echo "🧪 Running tests..."
    npm test || echo "⚠️  Some tests failed"
fi

# Deploy
echo ""
echo "🚀 Deploying to $ENVIRONMENT..."

if [ "$ENVIRONMENT" = "staging" ]; then
    wrangler deploy --env staging
elif [ "$ENVIRONMENT" = "production" ]; then
    wrangler deploy --env production
else
    wrangler deploy
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Service endpoints:"
echo "  - Health: https://sweep.chitty.cc/health"
echo "  - Status: https://sweep.chitty.cc/api/agents/status"
echo "  - Dashboard: https://sweep.chitty.cc/"
echo ""
echo "📝 View logs:"
echo "  npm run tail"
echo ""
echo "🎉 ChittySweep is now active!"
