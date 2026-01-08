# ChittyBeacon - File Index

Quick reference guide to all project files.

## Start Here

1. **SUMMARY.md** - High-level project overview
2. **QUICKSTART.md** - Get running in 5 minutes
3. **README.md** - Complete documentation

## Documentation Files

| File | Purpose | When to Read |
|------|---------|--------------|
| **SUMMARY.md** | Project summary and status | First - understand what this is |
| **QUICKSTART.md** | 5-minute setup guide | Second - get it running |
| **README.md** | Complete documentation | Third - understand all features |
| **DEPLOYMENT.md** | Detailed deployment guide | When deploying to production |
| **EXAMPLES.md** | API usage examples | When integrating or using the API |
| **ARCHITECTURE.md** | System architecture diagrams | When understanding internals |
| **PROJECT_OVERVIEW.md** | Architecture and design details | When modifying or extending |
| **INDEX.md** | This file - navigation guide | When lost or looking for something |

## Source Code Files

| File | Lines | Purpose | Key Functions |
|------|-------|---------|---------------|
| **src/index.ts** | ~70 | Main entry point | fetch(), scheduled() |
| **src/types.ts** | ~40 | TypeScript types | Env, ServiceConfig, HealthCheckResult, ServiceStatus, EcosystemStatus |
| **src/config.ts** | ~90 | Service configuration | SERVICES[], SERVICE_MAP, KV_KEYS |
| **src/health-checker.ts** | ~70 | Health check logic | checkServiceHealth(), checkAllServices() |
| **src/handlers.ts** | ~150 | Request handlers | handleHealth(), handleStatus(), handleServiceStatus(), handleCheck() |
| **src/storage.ts** | ~120 | KV storage ops | storeHealthCheck(), getLatestStatus(), getServiceHistory(), calculateUptime() |

**Total Source Code:** ~540 lines

## Configuration Files

| File | Purpose | Must Edit? |
|------|---------|------------|
| **wrangler.toml** | Cloudflare Worker configuration | YES - Add KV namespace IDs |
| **package.json** | npm dependencies and scripts | No - unless changing deps |
| **tsconfig.json** | TypeScript compiler settings | No - unless changing TS config |
| **.gitignore** | Git ignore patterns | No |
| **.dev.vars.example** | Example environment variables | Optional - copy to .dev.vars |

## Utility Scripts

| File | Purpose | When to Use |
|------|---------|-------------|
| **setup.sh** | Automated setup script | First time setup |
| **test.sh** | API testing script | Testing locally or in production |

## File Statistics

```
Total Project Files: 19
Source Code Files: 6 (TypeScript)
Documentation Files: 8 (Markdown)
Configuration Files: 4 (JSON, TOML, shell)
Utility Scripts: 2 (Shell)

Total Lines: ~2,955
  - Source Code: ~540 lines
  - Documentation: ~2,200 lines
  - Configuration: ~100 lines
  - Scripts: ~115 lines
```

## Directory Structure

```
chittybeacon/
├── Documentation (8 files)
│   ├── ARCHITECTURE.md     - System architecture diagrams
│   ├── DEPLOYMENT.md       - Deployment instructions
│   ├── EXAMPLES.md         - API usage examples
│   ├── INDEX.md            - This file
│   ├── PROJECT_OVERVIEW.md - Architecture details
│   ├── QUICKSTART.md       - Quick start guide
│   ├── README.md           - Main documentation
│   └── SUMMARY.md          - Project summary
│
├── Source Code (6 files)
│   └── src/
│       ├── config.ts           - Service configuration
│       ├── handlers.ts         - Request handlers
│       ├── health-checker.ts   - Health check logic
│       ├── index.ts            - Main entry point
│       ├── storage.ts          - KV operations
│       └── types.ts            - TypeScript types
│
├── Configuration (5 files)
│   ├── .dev.vars.example   - Example env vars
│   ├── .gitignore          - Git ignore rules
│   ├── package.json        - npm configuration
│   ├── tsconfig.json       - TypeScript config
│   └── wrangler.toml       - Worker config (EDIT THIS)
│
└── Utilities (2 files)
    ├── setup.sh            - Setup automation
    └── test.sh             - API testing
```

## Quick Navigation

### I want to...

**Get started quickly**
→ Read: QUICKSTART.md
→ Run: ./setup.sh

**Deploy to production**
→ Read: DEPLOYMENT.md
→ Edit: wrangler.toml (add KV IDs)
→ Run: npm run deploy

**Understand the API**
→ Read: README.md (API section)
→ Read: EXAMPLES.md

**Integrate with my app**
→ Read: EXAMPLES.md (Integration section)

**Understand how it works**
→ Read: ARCHITECTURE.md
→ Read: PROJECT_OVERVIEW.md

**Modify or extend it**
→ Read: PROJECT_OVERVIEW.md (Extensibility section)
→ Edit: src/config.ts (add services)
→ Edit: src/handlers.ts (add endpoints)

**Debug issues**
→ Run: ./test.sh
→ Read: DEPLOYMENT.md (Troubleshooting section)
→ Run: wrangler tail

**Add a new service to monitor**
→ Edit: src/config.ts
→ Add to SERVICES array
→ Deploy: npm run deploy

## File Relationships

```
Configuration Flow:
wrangler.toml → Worker Runtime
    ├─→ Routes: beacon.chitty.cc/*
    ├─→ KV Binding: HEALTH_HISTORY
    └─→ Env Vars: CHECK_INTERVAL_MS, HISTORY_RETENTION_DAYS

Code Flow:
index.ts (entry point)
    ├─→ handlers.ts (request routing)
    │   ├─→ health-checker.ts (check services)
    │   │   └─→ config.ts (service list)
    │   └─→ storage.ts (KV operations)
    │       └─→ config.ts (key naming)
    └─→ types.ts (used by all modules)

Build Flow:
tsconfig.json → TypeScript Compiler
    └─→ src/*.ts → Compiled JavaScript
        └─→ wrangler → Bundled Worker
            └─→ Cloudflare Edge
```

## Documentation Reading Order

### For Beginners
1. SUMMARY.md - What is this?
2. QUICKSTART.md - How do I run it?
3. README.md - What can it do?
4. EXAMPLES.md - How do I use it?

### For Deployment
1. QUICKSTART.md - Quick setup
2. DEPLOYMENT.md - Detailed steps
3. Test with: ./test.sh
4. Verify with: curl commands

### For Developers
1. PROJECT_OVERVIEW.md - Architecture
2. ARCHITECTURE.md - Visual diagrams
3. Read source: src/*.ts
4. Extend: Add services/endpoints

### For Integration
1. README.md - API reference
2. EXAMPLES.md - Code examples
3. Test: ./test.sh
4. Integrate: Use examples

## Key Concepts

### Health Status
- **healthy** - Service OK, fast response (< 1s)
- **degraded** - Service OK but slow or unexpected status
- **unhealthy** - Service error, timeout, or unreachable

### Storage
- **Latest Status** - Current status, 24h TTL
- **History** - Past checks, 7 day TTL
- **Ecosystem Status** - Cached summary, 5 min cache

### Endpoints
- **GET /health** - Beacon's own health
- **GET /status** - All services status
- **GET /status/:service** - Single service status
- **POST /check** - Trigger health checks

## Common Tasks

### Add a new service
```bash
# 1. Edit configuration
vim src/config.ts

# 2. Add to SERVICES array
{
  name: 'New Service',
  url: 'https://new.chitty.cc',
  healthEndpoint: '/health',
  expectedStatus: 200,
  timeout: 5000,
}

# 3. Deploy
npm run deploy

# 4. Test
curl https://beacon.chitty.cc/status/new
```

### Change check interval
```bash
# Edit wrangler.toml
[triggers]
crons = ["*/10 * * * *"]  # Every 10 minutes

# Deploy
npm run deploy
```

### View logs
```bash
# Live logs
wrangler tail

# Or
npm run tail
```

### Test locally
```bash
# Start dev server
npm run dev

# In another terminal
./test.sh

# Or manually
curl http://localhost:8787/health
```

## Support Resources

| Need | Resource |
|------|----------|
| Quick answers | QUICKSTART.md, README.md |
| API usage | EXAMPLES.md |
| Deployment help | DEPLOYMENT.md |
| Architecture info | ARCHITECTURE.md, PROJECT_OVERVIEW.md |
| Error debugging | ./test.sh, wrangler tail |
| Configuration | wrangler.toml, src/config.ts |
| Extending | PROJECT_OVERVIEW.md (Extensibility) |

## Version Info

- **Created:** 2026-01-08
- **Version:** 1.0.0
- **Status:** Ready for deployment
- **Dependencies:** Not installed (run `npm install`)
- **KV Namespaces:** Not created (run `./setup.sh`)

## Next Steps

1. Read SUMMARY.md to understand the project
2. Read QUICKSTART.md to get started
3. Run `./setup.sh` to set up
4. Edit `wrangler.toml` with KV IDs
5. Run `npm run deploy` to deploy
6. Read EXAMPLES.md to integrate

---

**Need help?** Start with QUICKSTART.md for setup, or DEPLOYMENT.md for detailed instructions.
