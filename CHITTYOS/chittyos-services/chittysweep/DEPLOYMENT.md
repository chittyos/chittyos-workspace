# ChittySweep Deployment Guide

Complete deployment guide for ChittySweep to Cloudflare Workers.

## 🚀 Quick Deploy

```bash
# 1. Navigate to ChittySweep directory
cd /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittysweep

# 2. Install dependencies
npm install

# 3. Setup infrastructure
npm run setup:kv
npm run setup:r2

# 4. Deploy
npm run deploy:production
```

## 📋 Prerequisites

### Required
- **Cloudflare Account**: ChittyCorp LLC (ID: `bbf9fcd845e78035b7a135c481e88541`)
- **Wrangler CLI**: `npm install -g wrangler`
- **Node.js**: >= 18.x
- **Domain**: `sweep.chitty.cc` configured in Cloudflare DNS

### Cloudflare Resources Needed
- Workers AI (included in paid plan)
- KV Namespaces (3 total)
- Durable Objects (2 classes)
- R2 Bucket (1 bucket)
- Workers Standard plan ($5/month minimum)

## 🔧 Initial Setup

### 1. Authenticate with Cloudflare

```bash
wrangler login
```

Verify authentication:
```bash
wrangler whoami
```

Expected output should show account: ChittyCorp LLC

### 2. Create KV Namespaces

```bash
npm run setup:kv
```

Or manually:
```bash
wrangler kv:namespace create "SWEEP_STATE"
wrangler kv:namespace create "SWEEP_DISCOVERIES"
wrangler kv:namespace create "SWEEP_METRICS"
```

**Update `wrangler.toml`** with the generated IDs:
```toml
[[kv_namespaces]]
binding = "SWEEP_STATE"
id = "your_generated_id_here"  # Replace this
```

### 3. Create R2 Bucket

```bash
npm run setup:r2
```

Or manually:
```bash
wrangler r2 bucket create chittysweep-logs
```

### 4. Configure DNS

In Cloudflare Dashboard:
1. Go to DNS settings for `chitty.cc`
2. Add CNAME record:
   - **Name**: `sweep`
   - **Target**: `chittysweep.workers.dev` (or your workers subdomain)
   - **Proxied**: Yes (orange cloud)

### 5. Deploy Durable Objects

Durable Objects are defined in `wrangler.toml` and will be created on first deploy:
- `AgentOrchestrator`
- `AgentState`

## 📦 Deployment

### Deploy to Staging

```bash
npm run deploy:staging
```

Verify:
```bash
curl https://sweep-staging.chitty.cc/health
```

### Deploy to Production

```bash
npm run deploy:production
```

Verify:
```bash
curl https://sweep.chitty.cc/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "ChittySweep",
  "version": "1.0.0",
  "agents": {
    "scout": "active",
    "analyzer": "active",
    "predictor": "active",
    "contextMapper": "active",
    "roleDiscoverer": "active"
  }
}
```

### Deploy with Custom Script

```bash
./scripts/deploy.sh production
```

## 🔐 Secrets Management

Set sensitive environment variables as secrets:

```bash
# ChittyOS integration
wrangler secret put CHITTYID_API_KEY
wrangler secret put CHITTYOS_AUTH_TOKEN

# Optional third-party integrations
wrangler secret put SLACK_WEBHOOK_URL
wrangler secret put DISCORD_WEBHOOK_URL
```

## 🤖 CI/CD Pipeline

### GitHub Actions Setup

1. **Add Secrets to GitHub**:
   - `CLOUDFLARE_API_TOKEN`: Create at https://dash.cloudflare.com/profile/api-tokens
   - `CLOUDFLARE_ACCOUNT_ID`: `bbf9fcd845e78035b7a135c481e88541`

2. **Required Permissions** for API token:
   - Account > Workers Scripts > Edit
   - Account > Workers KV Storage > Edit
   - Account > Workers R2 Storage > Edit
   - Zone > Workers Routes > Edit

3. **Workflow Triggers**:
   - Push to `main` → Production
   - Push to `staging` → Staging
   - Manual workflow dispatch → Choose environment

### Automatic Deployment Flow

```
Git Push → GitHub Actions → Build → Test → Deploy → Health Check
```

## 🧪 Testing Deployment

### 1. Health Check
```bash
curl https://sweep.chitty.cc/health
```

### 2. Agent Status
```bash
curl https://sweep.chitty.cc/api/agents/status
```

### 3. Trigger Test Sweep
```bash
curl -X POST https://sweep.chitty.cc/api/sweep \
  -H "Content-Type: application/json" \
  -d '{"mode":"quick"}'
```

### 4. View Dashboard
```
https://sweep.chitty.cc/
```

### 5. Check Metrics
```bash
curl https://sweep.chitty.cc/api/metrics?period=1h
```

## 📊 Monitoring

### View Logs
```bash
npm run tail
```

With pretty formatting:
```bash
npm run logs
```

### Cloudflare Dashboard
- Workers Analytics: https://dash.cloudflare.com/workers/analytics
- KV Storage: https://dash.cloudflare.com/kv
- R2 Storage: https://dash.cloudflare.com/r2
- Durable Objects: https://dash.cloudflare.com/durable-objects

### Health Monitoring
ChittySweep integrates with ChittyBeacon for monitoring:
- Uptime checks every 60 seconds
- Agent health status
- Sweep completion metrics
- Error rate tracking

## 🔄 Updates & Rollbacks

### Deploy Update
```bash
git pull
npm install
npm run deploy:production
```

### Rollback
```bash
# List deployments
wrangler deployments list

# Rollback to specific deployment
wrangler rollback [deployment-id]
```

### Version Verification
```bash
curl https://sweep.chitty.cc/health | jq '.version'
```

## 🐛 Troubleshooting

### "Namespace not found"
```bash
# Re-create KV namespaces
npm run setup:kv
# Update wrangler.toml with new IDs
```

### "R2 bucket does not exist"
```bash
# Create bucket
npm run setup:r2
```

### "Durable Object class not found"
```bash
# Deploy with migration
wrangler deploy --env production
```

### "AI binding error"
Ensure Workers AI is enabled on your account:
1. Go to Cloudflare Dashboard
2. Workers & Pages → AI
3. Enable Workers AI

### DNS not resolving
```bash
# Check DNS propagation
dig sweep.chitty.cc

# Verify CNAME record in Cloudflare DNS settings
```

## 📈 Scaling

### Free Tier Limits
- 100,000 requests/day
- 10ms CPU time per request
- Workers AI: Limited requests/day

### Paid Plan ($5/month minimum)
- 10 million requests/month
- 50ms CPU time per request
- Workers AI: Increased limits
- KV: 1GB storage included
- R2: 10GB storage included
- Durable Objects: 1GB storage included

### Optimization Tips
1. Use KV for frequently accessed data
2. Cache AI responses when possible
3. Batch discoveries to reduce Durable Object writes
4. Use scheduled sweeps during off-peak hours

## 🔗 ChittyOS Integration

ChittySweep integrates with:

1. **ChittyID** (`id.chitty.cc`)
   - All sweeps get unique ChittyIDs
   - Format: `CT-SWEEP-{timestamp}-{uuid}`

2. **ChittyRegistry** (`registry.chitty.cc`)
   - Service registration
   - Health reporting
   - Discovery by other services

3. **ChittyGateway** (`gateway.chitty.cc`)
   - API routing
   - Authentication
   - Rate limiting

4. **ChittyLedger** (Evidence tracking)
   - Cleanup operations logged as evidence
   - Immutable audit trail

## 📝 Deployment Checklist

- [ ] Cloudflare account authenticated
- [ ] KV namespaces created and IDs updated in `wrangler.toml`
- [ ] R2 bucket created
- [ ] DNS record configured
- [ ] GitHub secrets added (for CI/CD)
- [ ] Secrets set with `wrangler secret put`
- [ ] Initial deployment successful
- [ ] Health check passing
- [ ] Agent status verified
- [ ] Test sweep executed successfully
- [ ] Dashboard accessible
- [ ] Logs monitoring setup
- [ ] ChittyRegistry registration confirmed

## 🎉 Success Criteria

Deployment is successful when:
1. ✅ `/health` returns `"status": "healthy"`
2. ✅ All 5 agents show `"active"` status
3. ✅ Test sweep completes without errors
4. ✅ Dashboard loads and displays metrics
5. ✅ Cron triggers are scheduled
6. ✅ Logs are accessible via `wrangler tail`

## 🆘 Support

For deployment issues:
1. Check logs: `npm run tail`
2. Verify Cloudflare Dashboard for resource status
3. Review ChittyOS documentation
4. Check GitHub Actions logs (for CI/CD)

---

**ChittySweep Deployment** - Part of the ChittyOS ecosystem
