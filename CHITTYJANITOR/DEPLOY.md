# ChittyJanitor Deployment Guide

## Prerequisites

- Cloudflare account
- Node.js 18+
- Wrangler CLI

## Quick Start

```bash
cd /Users/nb/.claude/projects/-/CHITTYJANITOR

# Install dependencies
npm install

# Configure Cloudflare
wrangler login

# Create KV namespace
wrangler kv:namespace create JANITOR_STATE
wrangler kv:namespace create JANITOR_STATE --preview

# Create R2 bucket
wrangler r2 bucket create chitty-janitor-metrics

# Set secrets
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put OPENAI_API_KEY
wrangler secret put GOOGLE_API_KEY
wrangler secret put CHITTY_ID_TOKEN

# Update wrangler.toml with KV namespace IDs

# Deploy
npm run deploy
```

## Configuration

### 1. Update `wrangler.toml`

Replace placeholder IDs with actual values:

```toml
[[kv_namespaces]]
binding = "JANITOR_STATE"
id = "your-kv-namespace-id"  # From wrangler kv:namespace create
preview_id = "your-preview-kv-namespace-id"
```

### 2. Environment Variables

Set via `wrangler secret put`:

- `ANTHROPIC_API_KEY` - Claude API key
- `OPENAI_API_KEY` - GPT-4 API key
- `GOOGLE_API_KEY` - Gemini API key
- `CHITTY_ID_TOKEN` - ChittyID authentication token

### 3. Scheduled Cleanup

Configured in `wrangler.toml`:

```toml
[triggers]
crons = ["0 */6 * * *"]  # Every 6 hours
```

## API Endpoints

Once deployed to `https://chitty-janitor.workers.dev`:

### GET /health
Health check

```bash
curl https://chitty-janitor.workers.dev/health
```

### GET /status
Current intelligence and statistics

```bash
curl https://chitty-janitor.workers.dev/status
```

### GET /predict
Predictive analysis

```bash
curl https://chitty-janitor.workers.dev/predict
```

### POST /cleanup
Trigger manual cleanup

```bash
curl -X POST https://chitty-janitor.workers.dev/cleanup \
  -H "Content-Type: application/json" \
  -d '{"level": "aggressive"}'
```

### GET /insights
UX-friendly insights

```bash
curl https://chitty-janitor.workers.dev/insights
```

### GET /dashboard
Full dashboard data

```bash
curl https://chitty-janitor.workers.dev/dashboard
```

## MCP Integration

ChittyJanitor uses Cloudflare MCP for Workers management.

### Setup MCP

```bash
# Install Cloudflare MCP server
npm install -g @cloudflare/mcp-server-cloudflare

# Configure environment
export CLOUDFLARE_API_TOKEN="your-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
```

### Use with Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cloudflare": {
      "command": "npx",
      "args": ["-y", "@cloudflare/mcp-server-cloudflare"],
      "env": {
        "CLOUDFLARE_API_TOKEN": "your-token",
        "CLOUDFLARE_ACCOUNT_ID": "your-account-id"
      }
    }
  }
}
```

## Testing

```bash
# Local development
npm run dev

# Test endpoints
curl http://localhost:8787/health
```

## Monitoring

```bash
# View logs
wrangler tail

# Check metrics
curl https://chitty-janitor.workers.dev/status
```

## Integration with ChittyOS

ChittyJanitor integrates with ChittyOS via:

1. **ChittyID Authentication**
   - Set `CHITTY_ID_TOKEN` secret
   - All requests validate against `https://id.chitty.cc`

2. **Service Registry**
   - Registers at `https://registry.chitty.cc`
   - Health checks via `/health` endpoint

3. **Event Bus**
   - Publishes cleanup events
   - Subscribes to system events

## Cost Optimization

ChittyJanitor uses multi-model routing to optimize costs:

- **LLaMA**: Fast, cheap operations (~$0.10/1M tokens)
- **Gemini**: Discovery & exploration (~$0.50/1M tokens)
- **Claude**: Analysis & UX (~$3/1M tokens)
- **GPT-4**: Predictions only (~$10/1M tokens)

Expected monthly cost: **$5-20** depending on usage

## Troubleshooting

### KV namespace not found
```bash
wrangler kv:namespace list
# Update wrangler.toml with correct IDs
```

### R2 bucket access denied
```bash
wrangler r2 bucket list
# Verify bucket name matches wrangler.toml
```

### API key errors
```bash
wrangler secret list
# Re-add missing secrets
```

## Updating

```bash
git pull
npm install
npm run deploy
```

---

**Production URL**: `https://chitty-janitor.workers.dev`
**Status**: Ready for deployment
**Version**: 3.0.0
