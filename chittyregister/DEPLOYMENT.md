# ChittyRegister Deployment Guide

This guide covers deploying ChittyRegister to Cloudflare Workers.

## Prerequisites

1. Cloudflare account with Workers enabled
2. Account ID: `0bc21e3a5a9de1a4cc843be9c3e98121`
3. Domain: `chitty.cc` configured in Cloudflare
4. Wrangler CLI installed (`npm install -g wrangler`)
5. Authenticated with Cloudflare (`wrangler login`)

## KV Namespace Setup

Before deploying, create the required KV namespaces:

### Development/Preview
```bash
wrangler kv:namespace create "REGISTRY_KV"
```
Note the ID and update `wrangler.toml` if needed.

### Staging
```bash
wrangler kv:namespace create "REGISTRY_KV" --env staging
```
Update the staging namespace ID in `wrangler.toml`.

### Production
```bash
wrangler kv:namespace create "REGISTRY_KV" --env production
```
Update the production namespace ID in `wrangler.toml`.

## Installation

```bash
# From the workspace root
cd /Volumes/chitty/workspace/chittyregister

# Install dependencies
pnpm install

# Build the project
pnpm build
```

## Local Development

```bash
# Start local development server
pnpm dev

# The worker will be available at http://localhost:8787
```

Test locally:
```bash
# Health check
curl http://localhost:8787/health

# Register a service
curl -X POST http://localhost:8787/api/v1/register \
  -H "Content-Type: application/json" \
  -d @example-register.json

# List services
curl http://localhost:8787/api/v1/services

# Get registry status
curl http://localhost:8787/api/v1/status
```

## Deployment

### Deploy to Staging

```bash
pnpm deploy:staging
```

This deploys to `register-staging.chitty.cc`

Verify:
```bash
curl https://register-staging.chitty.cc/health
```

### Deploy to Production

```bash
pnpm deploy
```

This deploys to `register.chitty.cc`

Verify:
```bash
curl https://register.chitty.cc/health
```

## DNS Configuration

Ensure the following DNS records exist in Cloudflare:

### Staging
- Type: CNAME or A
- Name: `register-staging`
- Target: Worker route (automatically handled by Cloudflare Workers)

### Production
- Type: CNAME or A
- Name: `register`
- Target: Worker route (automatically handled by Cloudflare Workers)

## Route Configuration

Routes are defined in `wrangler.toml`:

**Production:**
```
{ pattern = "register.chitty.cc/*", zone_name = "chitty.cc" }
```

**Staging:**
```
{ pattern = "register-staging.chitty.cc/*", zone_name = "chitty.cc" }
```

## Post-Deployment Verification

### 1. Health Check
```bash
curl https://register.chitty.cc/health
```
Expected response:
```json
{
  "status": "ok",
  "service": "chittyregister",
  "version": "0.1.0",
  "features": ["registration", "validation", "audit"]
}
```

### 2. Registry Status
```bash
curl https://register.chitty.cc/api/v1/status
```

### 3. Test Registration
```bash
curl -X POST https://register.chitty.cc/api/v1/register \
  -H "Content-Type: application/json" \
  -H "X-Chitty-ID: test-user-001" \
  -d '{
    "name": "testservice",
    "version": "1.0.0",
    "type": "worker",
    "category": "Application",
    "description": "Test service for registration verification",
    "owner": "testuser"
  }'
```

### 4. Verify Listing
```bash
curl https://register.chitty.cc/api/v1/services
```

## Monitoring

### View Logs
```bash
# Production logs
wrangler tail

# Staging logs
wrangler tail --env staging
```

### Check KV Storage
```bash
# List keys in production
wrangler kv:key list --namespace-id="chitty-registry-kv-prod"

# Get specific service
wrangler kv:key get "service:testservice" --namespace-id="chitty-registry-kv-prod"
```

## Rollback

If you need to rollback to a previous deployment:

```bash
# View deployment history
wrangler deployments list

# Rollback to specific deployment
wrangler rollback [DEPLOYMENT_ID]
```

## Environment Variables

No environment variables required. All configuration is in `wrangler.toml`.

## Security Considerations

1. **KV Access**: Only the worker has access to the KV namespaces
2. **CORS**: Configured to handle cross-origin requests safely
3. **Validation**: All inputs are validated before storage
4. **Audit Trail**: All operations are logged via ChittyContext
5. **ChittyID**: User identification tracked in audit logs

## Troubleshooting

### Worker fails to deploy
- Check account ID is correct
- Verify you're authenticated: `wrangler whoami`
- Check KV namespace IDs match in `wrangler.toml`

### Routes not working
- Verify DNS is configured correctly
- Check route patterns in `wrangler.toml`
- Ensure zone_name matches your Cloudflare zone

### KV operations failing
- Verify KV namespace exists and ID is correct
- Check binding name matches in code: `REGISTRY_KV`
- Ensure namespace is attached to the correct environment

## Support

For issues or questions:
- Check logs: `wrangler tail`
- Review audit events in KV
- Contact ChittyOS team

---

Last updated: 2026-01-08
