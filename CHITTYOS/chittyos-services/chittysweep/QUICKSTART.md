# ChittySweep Quick Start

Get ChittySweep running in 5 minutes! 🧹✨

## 🎯 What is ChittySweep?

An **AI-powered multi-agent janitor system** that automatically:
- 🔍 Discovers cleanup opportunities
- 📊 Analyzes patterns and efficiency
- 🗺️ Maps dependencies to avoid breaking things
- 🎭 Identifies file roles and purposes
- 🔮 Predicts future storage needs
- 🧠 Makes intelligent cleanup decisions using AI

## ⚡ 5-Minute Deploy

```bash
# 1. Navigate to project
cd /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittysweep

# 2. Login to Cloudflare
wrangler login

# 3. Setup infrastructure
npm run setup:kv
npm run setup:r2

# 4. Update wrangler.toml with generated KV IDs
# (IDs will be printed by setup:kv command)

# 5. Deploy!
npm run deploy:production

# 6. Test
curl https://sweep.chitty.cc/health
```

## 🧪 Test Locally

```bash
# Start dev server
npm run dev

# In another terminal, test it
curl http://localhost:8787/health

# Trigger a test sweep
curl -X POST http://localhost:8787/api/sweep \
  -H "Content-Type: application/json" \
  -d '{"mode":"quick"}'

# View the dashboard
open http://localhost:8787/
```

## 📊 Dashboard

Once deployed, access the web dashboard:
```
https://sweep.chitty.cc/
```

Features:
- Real-time agent status
- Trigger manual sweeps
- View metrics and history
- Explore discoveries

## 🤖 Agent System

### 5 Specialized Agents

1. **Scout** - Finds cleanup targets
2. **Analyzer** - Calculates efficiency
3. **Context Mapper** - Maps relationships
4. **Role Discoverer** - Identifies purposes
5. **Predictor** - Forecasts needs

### Orchestration

All coordinated by the **Agent Orchestrator** using:
- Cloudflare Workers AI (Llama 3.1 8B)
- Durable Objects for state
- KV for discoveries & metrics
- R2 for audit logs

## 📡 API Examples

### Get Agent Status
```bash
curl https://sweep.chitty.cc/api/agents/status
```

### Trigger Full Sweep
```bash
curl -X POST https://sweep.chitty.cc/api/sweep \
  -H "Content-Type: application/json" \
  -d '{"mode":"full"}'
```

### Quick Scan
```bash
curl -X POST https://sweep.chitty.cc/api/sweep \
  -H "Content-Type: application/json" \
  -d '{"mode":"quick"}'
```

### View Discoveries
```bash
curl https://sweep.chitty.cc/api/discoveries?limit=20
```

### Get Metrics
```bash
curl https://sweep.chitty.cc/api/metrics?period=24h
```

## ⏱️ Automated Schedules

ChittySweep runs automatically:

- **2 AM daily** - Full sweep (all agents + AI)
- **Every 6 hours** - Quick scan (Scout + Analyzer)
- **Every 15 minutes** - Metric collection

## 🔧 Configuration

### Sweep Modes

**Full Sweep** (30-60 seconds)
- All 5 agents execute
- AI synthesis of decisions
- Comprehensive cleanup

**Quick Scan** (10-15 seconds)
- Scout + Analyzer only
- High-priority targets
- Fast iteration

**Targeted Sweep**
- Specify specific paths
- Focused cleanup
- Custom execution

### Safety Features

- **Safety Scores**: Only actions with score ≥ 70 execute
- **Dependency Checking**: Won't break critical relationships
- **Audit Logging**: Every action tracked in R2
- **Rule-based Fallback**: If AI fails, safe rules apply

## 📦 What Gets Cleaned?

### Discovered Automatically

✅ Cache directories (`.npm`, `.cache`, etc.)
✅ Old build artifacts (>30 days)
✅ Large log files (>10MB)
✅ Duplicate files
✅ Temporary files

### Actions Available

- **Delete** - Remove completely
- **Archive** - Move to R2 storage
- **Compress** - Gzip to save space
- **Skip** - No action (flagged for review)

## 🎛️ Monitoring

### Logs
```bash
npm run tail
```

### Metrics
```bash
curl https://sweep.chitty.cc/api/metrics?period=7d
```

### Cloudflare Dashboard
- Workers Analytics
- KV Storage usage
- R2 Storage usage
- Durable Objects stats

## 🚨 Troubleshooting

### "Namespace not found"
```bash
npm run setup:kv
# Update wrangler.toml with printed IDs
```

### "AI binding error"
Enable Workers AI in Cloudflare Dashboard:
1. Workers & Pages → AI
2. Enable Workers AI

### "Durable Object not found"
```bash
# Redeploy with migration
npm run deploy:production
```

### Slow Performance
Check Cloudflare plan - free tier has limits:
- Upgrade to Workers Paid ($5/month)
- 10x more CPU time
- Better AI quota

## 🔗 ChittyOS Integration

ChittySweep integrates with:

- **ChittyID** - All sweeps get unique IDs
- **ChittyRegistry** - Service discovery
- **ChittyGateway** - API routing
- **ChittyLedger** - Audit trail

## 📖 Learn More

- **Full Architecture**: See `ARCHITECTURE.md`
- **Deployment Guide**: See `DEPLOYMENT.md`
- **API Docs**: See `README.md`

## 🎉 Success Checklist

After deployment, verify:

- [ ] Health check returns `"healthy"`
- [ ] All 5 agents show `"active"`
- [ ] Dashboard loads successfully
- [ ] Test sweep completes
- [ ] Metrics are collected
- [ ] Cron triggers scheduled

## 💡 Tips

1. **Start with quick scans** to understand your system
2. **Review discoveries** before enabling auto-cleanup
3. **Monitor metrics** to optimize sweep schedules
4. **Use targeted sweeps** for specific directories
5. **Check audit logs** in R2 for compliance

## 🆘 Need Help?

1. Check the logs: `npm run tail`
2. Review Cloudflare Dashboard
3. Read `DEPLOYMENT.md` for detailed setup
4. Check `ARCHITECTURE.md` for system design

---

**ChittySweep** - Your AI-powered cleanup crew! 🧹🤖

Ready to deploy? Run:
```bash
cd /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittysweep
npm run deploy:production
```
