# ChittyBeacon Deployment Guide

## Pre-Deployment Setup

### 1. Install Dependencies

```bash
cd /Volumes/chitty/workspace/chittybeacon
npm install
```

### 2. Create KV Namespace

Create the KV namespace for storing health history:

```bash
# Production namespace
wrangler kv:namespace create "HEALTH_HISTORY"

# Preview namespace (for development)
wrangler kv:namespace create "HEALTH_HISTORY" --preview
```

The command will output something like:
```
{ binding = "HEALTH_HISTORY", id = "abc123...", preview_id = "xyz789..." }
```

### 3. Update wrangler.toml

Replace the placeholder values in `wrangler.toml`:

```toml
kv_namespaces = [
  { binding = "HEALTH_HISTORY", id = "YOUR_PRODUCTION_ID", preview_id = "YOUR_PREVIEW_ID" }
]
```

### 4. Configure DNS (if not already done)

In your Cloudflare dashboard:
1. Go to your `chitty.cc` zone
2. Add a CNAME record:
   - Name: `beacon`
   - Target: `chittybeacon.workers.dev` (or your worker URL)
   - Proxy status: Proxied (orange cloud)

### 5. (Optional) Add Scheduled Triggers

To enable automatic health checks every 5 minutes, add to `wrangler.toml`:

```toml
[triggers]
crons = ["*/5 * * * *"]
```

Available cron patterns:
- `*/1 * * * *` - Every minute
- `*/5 * * * *` - Every 5 minutes
- `*/15 * * * *` - Every 15 minutes
- `0 * * * *` - Every hour

## Development

### Local Development

```bash
npm run dev
```

This starts a local development server at `http://localhost:8787`

Test endpoints:
```bash
# Check beacon health
curl http://localhost:8787/health

# Get ecosystem status
curl http://localhost:8787/status

# Get specific service status
curl http://localhost:8787/status/schema

# Trigger health check
curl -X POST http://localhost:8787/check
```

## Deployment

### Deploy to Production

```bash
npm run deploy
```

This will:
1. Build the TypeScript files
2. Upload the worker to Cloudflare
3. Activate the worker on the configured routes

### Verify Deployment

```bash
# Check if worker is running
curl https://beacon.chitty.cc/health

# View live logs
npm run tail
```

## Post-Deployment

### Initial Health Check

Trigger the first health check manually:

```bash
curl -X POST https://beacon.chitty.cc/check
```

### Monitor Logs

Watch real-time logs:

```bash
wrangler tail
```

### Verify All Services

Check the ecosystem status:

```bash
curl https://beacon.chitty.cc/status | jq
```

## Troubleshooting

### Worker Not Responding

1. Check deployment status:
   ```bash
   wrangler deployments list
   ```

2. Check DNS configuration in Cloudflare dashboard

3. Verify route is correctly configured:
   ```bash
   wrangler routes list
   ```

### KV Namespace Issues

1. List KV namespaces:
   ```bash
   wrangler kv:namespace list
   ```

2. Check KV contents:
   ```bash
   wrangler kv:key list --binding=HEALTH_HISTORY
   ```

3. Read specific key:
   ```bash
   wrangler kv:key get --binding=HEALTH_HISTORY "ecosystem:status:latest"
   ```

### Service Not Being Monitored

1. Check `src/config.ts` for service configuration
2. Verify the service URL and health endpoint
3. Test the service directly:
   ```bash
   curl -I https://schema.chitty.cc/health
   ```

### High Response Times

1. Check service timeout values in `src/config.ts`
2. Adjust timeout values if needed (default: 5000ms)
3. Check if services are geographically distributed

## Updating Configuration

### Add New Service

Edit `src/config.ts`:

```typescript
{
  name: 'New Service',
  url: 'https://new.chitty.cc',
  healthEndpoint: '/health',
  expectedStatus: 200,
  timeout: 5000,
}
```

Redeploy:
```bash
npm run deploy
```

### Change Check Interval

Edit `wrangler.toml`:

```toml
[triggers]
crons = ["*/10 * * * *"]  # Change to every 10 minutes
```

Redeploy:
```bash
npm run deploy
```

## Rollback

If you need to rollback to a previous version:

```bash
# List deployments
wrangler deployments list

# Rollback to specific deployment
wrangler rollback [DEPLOYMENT_ID]
```

## Security Notes

- All endpoints are CORS-enabled and publicly accessible
- No authentication is required (health data is non-sensitive)
- Consider adding rate limiting if needed
- KV data has automatic expiration (7 days for history)

## Support

For issues or questions:
1. Check logs with `wrangler tail`
2. Review Cloudflare Worker analytics in dashboard
3. Test individual services manually
4. Check KV namespace data
