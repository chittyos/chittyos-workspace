# ChittyBeacon - START HERE

Welcome to ChittyBeacon! This is your health monitoring service for the Chitty ecosystem.

## What You Have

A complete, production-ready Cloudflare Worker that:
- Monitors 11 Chitty services (schema, id, auth, connect, finance, registry, api, mcp, docs, git, get)
- Provides a RESTful API for health status
- Stores health history in Cloudflare KV
- Supports scheduled automatic health checks
- Includes comprehensive documentation and testing tools

## Project Status

✅ **COMPLETE** - All files created and ready
⏳ **NOT DEPLOYED** - You need to deploy it
📝 **CONFIGURATION REQUIRED** - KV namespace IDs needed

## Next Steps (5 Minutes)

### Step 1: Install Dependencies (1 min)
```bash
cd /Volumes/chitty/workspace/chittybeacon
npm install
```

### Step 2: Run Setup Script (2 min)
```bash
./setup.sh
```

This will:
- Create KV namespaces
- Give you the IDs you need

### Step 3: Update Configuration (1 min)
Edit `wrangler.toml` and replace:
```toml
kv_namespaces = [
  { binding = "HEALTH_HISTORY", id = "PASTE_PROD_ID", preview_id = "PASTE_PREVIEW_ID" }
]
```

### Step 4: Deploy (1 min)
```bash
npm run deploy
```

### Step 5: Test
```bash
curl https://beacon.chitty.cc/health
curl -X POST https://beacon.chitty.cc/check
curl https://beacon.chitty.cc/status
```

## Documentation Guide

Read in this order:

1. **This file (START_HERE.md)** ← You are here
2. **QUICKSTART.md** - Detailed setup instructions
3. **README.md** - Complete documentation
4. **EXAMPLES.md** - Usage examples
5. **DEPLOYMENT.md** - Advanced deployment topics

Optional:
- **ARCHITECTURE.md** - System diagrams
- **PROJECT_OVERVIEW.md** - Internal architecture
- **INDEX.md** - File navigation guide
- **SUMMARY.md** - Project summary

## Project Files

```
chittybeacon/
├── START_HERE.md          ← You are here
├── QUICKSTART.md          ← Read this next
├── README.md              ← Then this
├── EXAMPLES.md            
├── DEPLOYMENT.md          
├── ARCHITECTURE.md        
├── PROJECT_OVERVIEW.md    
├── SUMMARY.md             
├── INDEX.md               
│
├── src/                   ← Source code (6 files)
│   ├── index.ts           - Main entry point
│   ├── types.ts           - TypeScript types
│   ├── config.ts          - Service configuration
│   ├── health-checker.ts  - Health check logic
│   ├── handlers.ts        - Request handlers
│   └── storage.ts         - KV operations
│
├── wrangler.toml          ← Edit this (add KV IDs)
├── package.json           
├── tsconfig.json          
├── setup.sh               ← Run this first
└── test.sh                
```

## API Endpoints

Once deployed at `https://beacon.chitty.cc`:

- **GET /health** - Check if beacon is running
- **GET /status** - Get status of all 11 services
- **GET /status/:service** - Get status of specific service (e.g., /status/schema)
- **POST /check** - Trigger immediate health checks

## Monitored Services

✅ schema.chitty.cc - Schema Service
✅ id.chitty.cc - Identity Service
✅ auth.chitty.cc - Auth Service
✅ connect.chitty.cc - Connect Service
✅ finance.chitty.cc - Finance Service
✅ registry.chitty.cc - Registry Service
✅ api.chitty.cc - API Service
✅ mcp.chitty.cc - MCP Service
✅ docs.chitty.cc - Documentation
✅ git.chitty.cc - Git Service
✅ get.chitty.cc - Get Service

## Quick Commands

```bash
# Setup
npm install              # Install dependencies
./setup.sh              # Create KV namespaces

# Development
npm run dev             # Start local dev server
./test.sh               # Test locally

# Deployment
npm run deploy          # Deploy to production
npm run tail            # View live logs

# Testing Production
curl https://beacon.chitty.cc/health
curl -X POST https://beacon.chitty.cc/check
curl https://beacon.chitty.cc/status | jq
./test.sh https://beacon.chitty.cc
```

## Configuration Needed

Before deploying, you MUST update `wrangler.toml`:

1. **KV Namespace IDs** - Get from `./setup.sh` output
2. **(Optional) Cron Triggers** - For automatic checks

Everything else is pre-configured!

## What's Pre-Configured

✅ Cloudflare account ID: 0bc21e3a5a9de1a4cc843be9c3e98121
✅ Worker name: chittybeacon
✅ Route: beacon.chitty.cc/*
✅ All 11 services configured
✅ Health check timeouts: 5 seconds
✅ History retention: 7 days
✅ CORS enabled
✅ TypeScript configured
✅ Complete documentation

## Need Help?

- **Setup issues:** Read QUICKSTART.md or DEPLOYMENT.md
- **API usage:** Read EXAMPLES.md
- **Understanding the code:** Read ARCHITECTURE.md or PROJECT_OVERVIEW.md
- **Navigation:** Read INDEX.md

## Common First-Time Questions

**Q: Do I need to configure DNS?**
A: Yes, but it should already be configured if the route in wrangler.toml works. The worker will use: beacon.chitty.cc

**Q: What do I need to change?**
A: Only the KV namespace IDs in wrangler.toml (run setup.sh to get them)

**Q: How much does this cost?**
A: $0/month - it stays within Cloudflare's free tier

**Q: Can I test it locally first?**
A: Yes! Run `npm run dev` then `./test.sh`

**Q: How often will it check services?**
A: You can configure this with cron triggers (e.g., every 5 minutes)

**Q: Where is the data stored?**
A: In Cloudflare KV (key-value storage) with automatic expiration

## Ready to Start?

1. Read QUICKSTART.md for detailed setup
2. Run `./setup.sh`
3. Update `wrangler.toml`
4. Deploy with `npm run deploy`
5. Test with `curl https://beacon.chitty.cc/health`

---

**Created:** 2026-01-08
**Status:** Ready for deployment
**Next:** Read QUICKSTART.md
