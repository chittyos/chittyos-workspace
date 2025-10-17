# ChittyOS Development Guide

**Quick reference for development commands and workflows.**

---

## Development Commands by Component

### ChittyChat Platform (Unified Worker)
```bash
cd chittychat/
npm install
npm run dev                    # Wrangler dev server (port 8787)
npm run deploy                 # Deploy optimized platform
npm run deploy:production      # Deploy to production
npm test                       # Comprehensive test suite
npm run benchmark              # Platform optimization analysis
```

### ChittyRouter AI Gateway
```bash
cd chittyrouter/
npm run dev                    # AI-enabled dev server
npm run test:all               # All test suites
npm run deploy:production      # Deploy to production
npm run validate               # Lint + test + build
npm run chittyid:generate      # Generate test ChittyIDs
```

### ChittySchema Data Framework
```bash
cd chittyschema/
npm run dev                    # Development server with tsx watch
npm run test:qa                # QA test suite
npm run test:security          # Security audit tests
npm run db:push                # Push schema to PostgreSQL
npm run sync:trigger           # Trigger manual sync
```

### ChittyOS Infrastructure (Makefile)
```bash
cd chittyrouter/
make validate                  # Validate with 1Password CLI
make test                      # Run consolidation tests
make ci-guards                 # ChittyID CI guard validation
make clean                     # Clean up old files
```

---

## Testing Commands

### Comprehensive Testing
```bash
# ChittyChat platform tests
cd chittychat/ && npm run test
cd chittychat/ && node test-real-system.js

# ChittyRouter AI gateway tests
cd chittyrouter/ && npm run test:all
cd chittyrouter/ && npm run test:failure

# ChittySchema security & compliance
cd chittyschema/ && npm run test:security:critical
cd chittyschema/ && npm run test:qa:compliance

# Cross-component validation
/Users/nb/.claude/projects/-/chittycheck/chittycheck-enhanced.sh --qa
```

---

## Working with Sessions

### Starting a Work Session
```bash
# 1. Load session context
/project

# 2. Validate system compliance
/chittycheck

# 3. Check environment
echo $CHITTY_ID_TOKEN  # Ensure not empty

# 4. Navigate to specific project
cd chittychat/
```

### Session Management
```bash
# Load session management
project                          # Initialize session context

# Check session status
/status                          # Session and git status

# Sync across sessions
/sync start                      # Enable cross-session sync
```

---

## Build & Deployment

### Local Development
```bash
# Start dev server for specific component
cd chittychat/ && npm run dev    # Port 8787
cd chittyrouter/ && npm run dev
cd chittyschema/ && npm run dev
```

### Production Deployment
```bash
# Validate before deployment
/chittycheck

# Deploy specific component
cd chittychat/ && npm run deploy:production
cd chittyrouter/ && npm run deploy:production
cd chittyschema/ && npm run deploy

# Verify deployment
curl https://gateway.chitty.cc/health
curl https://router.chitty.cc/health
curl https://schema.chitty.cc/health
```

---

## Common Development Tasks

### Adding New Services
1. Register service in `~/.chittyos/config.json`
2. Add health endpoint following existing patterns
3. Integrate with ChittyID for identity management
4. Update registry via `/registry` command

### Testing Changes
```bash
# Run compliance checks first
/chittycheck

# Component-specific testing
cd chittyrouter/ && npm run test:all
cd chittyschema/ && npm run test:security

# Cross-system validation
/health
```

---

## Environment Setup

### Required Environment Variables
```bash
# ChittyID Authentication (REQUIRED)
CHITTY_ID_TOKEN=your_chittyid_token_here

# ChittyOS Core Services
CHITTYOS_ACCOUNT_ID=bbf9fcd845e78035b7a135c481e88541
REGISTRY_SERVICE=https://registry.chitty.cc
CHITTYID_SERVICE=https://id.chitty.cc
GATEWAY_SERVICE=https://gateway.chitty.cc

# Database & Storage
NEON_DATABASE_URL=postgresql://...
DATABASE_URL=postgresql://...
CLOUDFLARE_ACCOUNT_ID=bbf9fcd845e78035b7a135c481e88541

# AI Services (ChittyRouter)
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
CF_AIG_TOKEN=...

# Notion Integration (ChittySchema)
NOTION_TOKEN=secret_...
NOTION_DATABASE_ID=...
```

### Loading Environment
```bash
# Via .env file
source .env

# Via 1Password (production)
op run --env-file=.env.op -- npm run deploy
```

---

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions.
