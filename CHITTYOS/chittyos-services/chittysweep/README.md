# ChittySweep - Intelligent Janitor Agent Group

ChittySweep is a multi-agent cleanup system powered by Cloudflare Workers AI. It coordinates five specialized AI agents to discover, analyze, and optimize system cleanup operations.

## 🤖 Agent Architecture

### Agent Swarm
ChittySweep deploys 5 specialized agents working in coordinated phases:

1. **Scout Agent** 🔍
   - Discovers cleanup opportunities across the system
   - Identifies caches, old artifacts, large logs, duplicates
   - Prioritizes targets based on size and age

2. **Analyzer Agent** 📊
   - Analyzes patterns in discovered data
   - Calculates efficiency scores and optimal cleanup order
   - Identifies low-performing cleanup targets

3. **Context Mapper Agent** 🗺️
   - Maps relationships between files and directories
   - Identifies dependencies and clusters
   - Prevents breaking critical relationships

4. **Role Discoverer Agent** 🎭
   - Identifies the purpose and role of each file
   - Classifies files as temporary, artifacts, dependencies, etc.
   - Assigns confidence scores to classifications

5. **Predictor Agent** 🔮
   - Forecasts future cleanup needs
   - Predicts growth rates and storage trends
   - Recommends optimal sweep schedules

### Orchestration
All agents are coordinated by the **Agent Orchestrator**, which:
- Executes agents in optimal phases
- Synthesizes results using Cloudflare Workers AI
- Makes final cleanup decisions with safety scores
- Ensures safe, automated cleanup operations

## 🚀 Deployment

### Prerequisites
- Cloudflare account (ChittyCorp LLC: `bbf9fcd845e78035b7a135c481e88541`)
- Wrangler CLI installed
- Domain configured: `sweep.chitty.cc`

### Quick Start

```bash
# Install dependencies
npm install

# Setup KV namespaces and R2 buckets
npm run setup:kv
npm run setup:r2

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

### Manual Setup

```bash
# Create KV namespaces
wrangler kv:namespace create "SWEEP_STATE"
wrangler kv:namespace create "SWEEP_DISCOVERIES"
wrangler kv:namespace create "SWEEP_METRICS"

# Create R2 bucket
wrangler r2 bucket create chittysweep-logs

# Update wrangler.toml with namespace IDs

# Deploy
wrangler deploy
```

## 📡 API Endpoints

### Health Check
```bash
GET https://sweep.chitty.cc/health
```

### Agent Status
```bash
GET https://sweep.chitty.cc/api/agents/status
```

### Trigger Sweep
```bash
POST https://sweep.chitty.cc/api/sweep
Content-Type: application/json

{
  "mode": "full",  // or "quick", "targeted"
  "targets": []    // optional specific targets
}
```

### Get Discoveries
```bash
GET https://sweep.chitty.cc/api/discoveries?limit=50&type=cache
```

### Get Metrics
```bash
GET https://sweep.chitty.cc/api/metrics?period=24h
```

## 🎯 Sweep Modes

### Full Sweep
- Runs all 5 agents in complete orchestration
- Comprehensive discovery and analysis
- AI-powered decision synthesis
- Scheduled daily at 2 AM

### Quick Scan
- Rapid scout and analyzer only
- Quick wins and high-priority targets
- Runs every 6 hours

### Metric Collection
- Lightweight metric gathering
- Runs every 15 minutes
- Tracks trends and patterns

## 🧠 AI Decision Making

ChittySweep uses **Cloudflare Workers AI** (Llama 3.1 8B) to synthesize agent outputs into cleanup decisions:

```javascript
{
  "path": "/tmp/.cache",
  "action": "delete",           // delete, archive, compress, skip
  "reason": "Large cache safe to clean",
  "priority": 4,                 // 1-5
  "safetyScore": 90,            // 0-100 (only >= 70 executed)
  "estimatedSavings": "250MB"
}
```

### Safety Features
- Only executes decisions with `safetyScore >= 70`
- Rule-based fallback if AI fails
- Context-aware dependency checking
- Comprehensive audit logging

## 📊 Dashboard

Access the web dashboard at:
```
https://sweep.chitty.cc/
```

Features:
- Real-time agent status
- Sweep history and metrics
- Manual sweep triggers
- Discovery explorer

## ⚙️ Configuration

### Environment Variables
```bash
ENVIRONMENT=production
LOG_LEVEL=info
AGENT_TIMEOUT_MS=30000
MAX_CONCURRENT_AGENTS=5
```

### Cron Schedule
- `0 2 * * *` - Full sweep daily at 2 AM
- `0 */6 * * *` - Quick scan every 6 hours
- `*/15 * * * *` - Metrics every 15 minutes

## 🔧 Development

### Local Development
```bash
# Start dev server
npm run dev

# Access at http://localhost:8787
```

### Testing
```bash
# Run tests
npm run test

# Watch mode
npm run test:watch
```

### Logs
```bash
# Tail production logs
npm run tail

# Pretty format
npm run logs
```

## 📦 Project Structure

```
chittysweep/
├── src/
│   ├── index.js                 # Main worker entry
│   └── agents/
│       └── orchestrator.js      # Agent coordination
├── scripts/
│   ├── setup-kv.js             # KV namespace setup
│   └── setup-r2.js             # R2 bucket setup
├── wrangler.toml               # Worker configuration
├── package.json
└── README.md
```

## 🔗 Integration with ChittyOS

ChittySweep integrates with:
- **ChittyID**: All sweep operations get unique IDs
- **ChittyLedger**: Cleanup operations logged as evidence
- **ChittyRegistry**: Service discovery and health monitoring
- **ChittyGateway**: API routing and authentication

## 📝 Logs & Monitoring

All operations logged to:
- **R2 Bucket**: `chittysweep-logs`
- **KV Metrics**: 90-day retention
- **Durable Object State**: Persistent sweep history

## 🛡️ Security

- Read-only operations by default
- Safety scores prevent accidental deletions
- Audit trail for all actions
- ChittyOS authentication required for sensitive operations

## 📈 Metrics

Track:
- Total bytes cleaned
- Files processed
- Success rate
- Agent performance
- Sweep duration
- Discovery trends

## 🚦 Status

- **Production**: `sweep.chitty.cc`
- **Version**: 1.0.0
- **Status**: Active
- **Uptime**: Monitored via ChittyBeacon

## 🤝 Contributing

ChittySweep is part of the ChittyOS ecosystem. For contributions:
1. Follow ChittyOS structure conventions
2. All changes get ChittyIDs
3. Log to ChittyLedger
4. Update ChittyRegistry

## 📄 License

MIT License - ChittyCorp LLC

---

**ChittySweep** - Keeping ChittyOS clean, one intelligent sweep at a time! 🧹✨
