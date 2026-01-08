# ChittyBeacon Quick Start

Get ChittyBeacon up and running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- Cloudflare account
- Wrangler CLI installed (`npm install -g wrangler`)
- Authenticated with Wrangler (`wrangler login`)

## Installation

### Option 1: Automated Setup (Recommended)

```bash
cd /Volumes/chitty/workspace/chittybeacon

# Run the setup script
./setup.sh
```

The script will:
1. Install dependencies
2. Create KV namespaces
3. Display the configuration IDs you need

### Option 2: Manual Setup

```bash
cd /Volumes/chitty/workspace/chittybeacon

# Install dependencies
npm install

# Create KV namespaces
wrangler kv:namespace create "HEALTH_HISTORY"
wrangler kv:namespace create "HEALTH_HISTORY" --preview
```

## Configuration

### 1. Update wrangler.toml

Edit `wrangler.toml` and replace the placeholder KV namespace IDs:

```toml
kv_namespaces = [
  { binding = "HEALTH_HISTORY", id = "YOUR_PRODUCTION_ID", preview_id = "YOUR_PREVIEW_ID" }
]
```

### 2. (Optional) Add Scheduled Triggers

Add to `wrangler.toml` for automatic health checks:

```toml
[triggers]
crons = ["*/5 * * * *"]  # Every 5 minutes
```

### 3. Configure DNS

In Cloudflare dashboard:
1. Go to your `chitty.cc` zone
2. DNS → Add record
   - Type: CNAME
   - Name: beacon
   - Target: chittybeacon.workers.dev
   - Proxy status: Proxied

## Testing Locally

Start the development server:

```bash
npm run dev
```

Test the endpoints:

```bash
# Health check
curl http://localhost:8787/health

# Trigger initial health check
curl -X POST http://localhost:8787/check

# Get ecosystem status
curl http://localhost:8787/status

# Run full test suite
./test.sh
```

## Deployment

Deploy to production:

```bash
npm run deploy
```

Verify deployment:

```bash
# Check beacon health
curl https://beacon.chitty.cc/health

# Trigger initial health checks
curl -X POST https://beacon.chitty.cc/check

# View ecosystem status
curl https://beacon.chitty.cc/status

# Watch live logs
npm run tail
```

## First Health Check

After deployment, trigger the first health check to populate data:

```bash
curl -X POST https://beacon.chitty.cc/check
```

This will check all 11 services and store the results.

## Verify Everything Works

Run these commands to verify:

```bash
# 1. Check beacon is healthy
curl https://beacon.chitty.cc/health | jq

# 2. Get overall status
curl https://beacon.chitty.cc/status | jq '.summary'

# 3. Check a specific service
curl https://beacon.chitty.cc/status/schema | jq

# 4. View recent checks
curl https://beacon.chitty.cc/status/schema | jq '.recentChecks[0]'
```

Expected output for healthy system:

```json
{
  "total": 11,
  "healthy": 11,
  "degraded": 0,
  "unhealthy": 0
}
```

## Common First-Time Issues

### Issue: Services show as "unhealthy" or "not found"

**Solution:** Run an initial health check to populate data:
```bash
curl -X POST https://beacon.chitty.cc/check
```

### Issue: "KV namespace not found"

**Solution:** Make sure you updated `wrangler.toml` with the correct IDs from setup.sh

### Issue: DNS not resolving

**Solution:** Wait a few minutes for DNS propagation, or use the direct worker URL:
```bash
curl https://chittybeacon.YOUR_ACCOUNT.workers.dev/health
```

### Issue: CORS errors in browser

**Solution:** This shouldn't happen - all endpoints have CORS enabled. Check browser console for actual error.

## Next Steps

1. Set up monitoring dashboard (see EXAMPLES.md)
2. Configure alerts (see EXAMPLES.md for Slack integration)
3. Add to your status page
4. Set up Grafana/Prometheus if needed

## Usage Examples

### Check if all services are healthy

```bash
curl -s https://beacon.chitty.cc/status | jq '.overall'
```

### List unhealthy services

```bash
curl -s https://beacon.chitty.cc/status | jq '.services[] | select(.currentStatus == "unhealthy") | .service'
```

### Get service uptime

```bash
curl -s https://beacon.chitty.cc/status/schema | jq '.uptime24h'
```

### Monitor in real-time

```bash
watch -n 10 'curl -s https://beacon.chitty.cc/status | jq ".summary"'
```

## File Structure Reference

```
chittybeacon/
├── src/
│   ├── index.ts           # Main entry point
│   ├── types.ts           # TypeScript types
│   ├── config.ts          # Service configuration
│   ├── health-checker.ts  # Health check logic
│   ├── handlers.ts        # Request handlers
│   └── storage.ts         # KV operations
├── wrangler.toml          # Worker config (UPDATE THIS)
├── package.json           # Dependencies
├── setup.sh              # Setup script
├── test.sh               # Test script
└── README.md             # Full documentation
```

## Quick Commands Reference

```bash
# Development
npm run dev              # Start local dev server
./test.sh               # Run tests locally

# Deployment
npm run deploy          # Deploy to production
npm run tail            # View live logs

# KV Management
wrangler kv:namespace list                           # List namespaces
wrangler kv:key list --binding=HEALTH_HISTORY        # List keys
wrangler kv:key get --binding=HEALTH_HISTORY "key"   # Get value

# Worker Management
wrangler deployments list    # List deployments
wrangler rollback [ID]       # Rollback deployment
```

## Getting Help

1. Check DEPLOYMENT.md for detailed deployment instructions
2. Check EXAMPLES.md for usage examples and integrations
3. Check PROJECT_OVERVIEW.md for architecture details
4. Check README.md for complete documentation
5. Run `./test.sh` to diagnose issues

## Success Checklist

- [ ] Dependencies installed (`npm install`)
- [ ] KV namespaces created
- [ ] wrangler.toml updated with KV IDs
- [ ] DNS configured (beacon.chitty.cc)
- [ ] Worker deployed (`npm run deploy`)
- [ ] Initial health check run (`POST /check`)
- [ ] All endpoints responding correctly
- [ ] Services showing correct health status

Once all items are checked, ChittyBeacon is ready to use!
