# CLAUDE.md - ChittyOS Framework Core

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ChittyOS Framework Core Repository** - The central orchestration point for the entire ChittyOS ecosystem. This is the main repository containing all ChittyOS services, foundation components, and infrastructure.

**Location**: `/Users/nb/.claude/projects/-/CHITTYOS`
**Framework Version**: 1.0.1
**Session Branch**: session-8c21b5bf

---

## Repository Structure

```
CHITTYOS/
├── chittyos-core/          # Core infrastructure (terraform, branding)
├── chittyos-data/          # Data services, macOS extensions, telemetry
├── chittyos-services/      # Production services (20+ services)
│   ├── chittychat/         # Unified platform (34+ services → 1)
│   ├── chittyrouter/       # AI-powered routing gateway
│   ├── chittyregistry/     # Service discovery
│   ├── chittymcp/          # MCP server implementations
│   ├── chittyconnect/      # Connection management
│   ├── chittysync/         # Synchronization service
│   └── ...
├── chittyos-apps/          # Application layer
│   └── chittycheck/        # Compliance validation
├── chittyos-integrations/  # Third-party integrations
│   ├── google/             # Google Workspace integration
│   ├── notion/             # Notion integration
│   ├── 1password/          # 1Password integration
│   ├── openphone/          # OpenPhone migration
│   └── 1111/               # 1111 integration
└── .archive/               # Archived/deprecated code
```

---

## Essential Commands

### Validation & Health
```bash
# ChittyCheck compliance validation
/chittycheck
/Users/nb/.claude/projects/-/chittychat/chittycheck-enhanced.sh

# Project health check
/health

# ChittyOS service status
/services
```

### Git & Session Management
```bash
# Current session branch
git branch --show-current  # session-8c21b5bf

# ChittySync handles session management automatically
# See /health for sync status

# Status
git status
```

### Service Development

**ChittyChat Platform**:
```bash
cd chittyos-services/chittychat
npm run dev              # Port 8787
npm run deploy           # Deploy optimized platform
npm test                 # Run tests
```

**ChittyRouter AI Gateway**:
```bash
cd chittyos-services/chittyrouter
npm run dev              # AI-enabled dev
npm run test:all         # All test suites
npm run deploy:production
```

**ChittyAuth**:
```bash
cd chittyos-services/chittyauth
wrangler dev
wrangler deploy
```

**ChittyRegistry**:
```bash
cd chittyos-services/chittyregistry
wrangler dev
wrangler deploy
```

---

## Key Services

### 1. ChittyChat Platform (Unified Worker)
**Path**: `chittyos-services/chittychat/`
**Domain**: gateway.chitty.cc
**Purpose**: Consolidates 34+ microservices into one optimized worker

**Services Included**:
- AI Gateway, Auth, Beacon, Canon, Chat
- Registry, Sync, Verify, Email, Viewer
- LangChain, MCP, Cases, Portal

**Commands**:
```bash
npm run dev               # Wrangler dev (port 8787)
npm run deploy            # Deploy optimized
npm run benchmark         # Optimization analysis
```

### 2. ChittyRouter AI Gateway
**Path**: `chittyos-services/chittyrouter/`
**Domain**: router.chitty.cc
**Purpose**: Unified intelligent routing gateway for ALL ChittyOS services

**Features**:
- 3-tier routing (hostname → path → AI)
- Routes to 20+ services
- AI-powered intelligent routing
- Service bindings optimization

**Commands**:
```bash
npm run dev               # AI-enabled dev
npm run test:all          # Complete test suite
npm run deploy:production # Blue-green deployment
```

### 3. ChittyAuth
**Path**: `chittyos-services/chittyauth/`
**Domain**: auth.chitty.cc
**Purpose**: Authentication & OAuth services

### 4. ChittyRegistry
**Path**: `chittyos-services/chittyregistry/`
**Domain**: registry.chitty.cc
**Purpose**: Service discovery & health monitoring

### 5. ChittyID Service
**Path**: `chittyos-services/chittyid/`
**Domain**: id.chitty.cc
**Purpose**: Central identity authority

**⚠️ CRITICAL**: ALL ChittyIDs MUST be minted from id.chitty.cc - no local generation permitted.

### 6. ChittyCheck
**Path**: `chittyos-apps/chittycheck/`
**Purpose**: Compliance validation for entire ecosystem

**Commands**:
```bash
./chittycheck-enhanced.sh
./chittycheck-enhanced.sh --qa
./chittycheck-enhanced.sh --security
```

---

## ChittyOS Architecture

### Foundation vs Services

**Foundation** (CHITTYFOUNDATION):
- Defines HOW (protocols, schemas, standards)
- chittycanon, chittyschema, chittychain
- chittyid, chittydna protocols
- Validators and registration

**Services** (chittyos-services):
- Implements WHAT (production workloads)
- Full service implementations
- Optimizations and features
- Production deployments

### Service Flow
```
1. Service Development
   ↓
2. ChittyRegister (Registration & ChittyID)
   ↓
3. ChittyVerify (Compliance)
   ↓
4. ChittyCertify (Certification)
   ↓
5. ChittyRegistry (Directory Listing)
```

---

## Critical Integration Patterns

### ChittyID Policy
**ZERO local generation** - All IDs from id.chitty.cc

- Token: `CHITTY_ID_TOKEN` environment variable
- Format: `CHITTY-{ENTITY}-{SEQUENCE}-{CHECKSUM}`
- Entities: PEO, PLACE, PROP, EVNT, AUTH, INFO, FACT, CONTEXT, ACTOR
- Enforcement: ChittyCheck validates with 1189+ pattern detection

### Service Routing
**ChittyRouter is the central gateway** routing to all services:

- Hostname routing: `id.chitty.cc` → ChittyID Service
- Path routing: `/api/*` → API Gateway
- AI routing: Llama 4 analyzes ambiguous requests

### Environment Configuration
```bash
# ChittyID (REQUIRED)
CHITTY_ID_TOKEN=mcp_auth_9b69455f5f799a73f16484eb268aea50

# ChittyOS Core
CHITTYOS_ACCOUNT_ID=bbf9fcd845e78035b7a135c481e88541
CHITTYID_SERVICE=https://id.chitty.cc
GATEWAY_SERVICE=https://gateway.chitty.cc
REGISTRY_SERVICE=https://registry.chitty.cc

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=bbf9fcd845e78035b7a135c481e88541
```

---

## Development Workflow

### Starting Work
```bash
# 1. Validate environment
/chittycheck

# 2. Check session
git branch --show-current

# 3. Navigate to service
cd chittyos-services/chittychat/
# or
cd chittyos-services/chittyrouter/
```

### Testing Changes
```bash
# Service-specific tests
npm test
npm run test:all

# Compliance validation
/chittycheck

# Health check
curl http://localhost:8787/health
```

### Deploying
```bash
# Validate first
/chittycheck

# Deploy service
npm run deploy:production

# Verify
curl https://service.chitty.cc/health
```

---

## Git Session Management

### Current Session
**Branch**: session-8c21b5bf
**Worktree**: `/Users/nb/.claude/projects/-/`

### Session Rules
- Use git worktrees for isolation
- Each session gets unique branch
- Prevents concurrent editing conflicts
- State persists across Claude sessions

### Working with Sessions
```bash
# List worktrees
git worktree list

# Check current branch
git branch --show-current

# Status
git status
```

---

## Service Health Status

### Healthy ✅
- ChittyID (id.chitty.cc) - v2.1.0

### Needs Deployment ⚠️
- ChittyRegistry (registry.chitty.cc)
- ChittyGateway (gateway.chitty.cc)
- Canon (canon.chitty.cc)

### ChittyID Minting
- Endpoint: https://id.chitty.cc/v1/mint
- Status: Returns 404 (needs verification)

---

## Key Files & Documentation

### Repository Documentation
- `README.md` - Repository overview
- `AGENTS.md` - AI agent configurations
- `AI-ASSISTANTS.md` - Universal guide for AI tools
- `ACTUAL-STRUCTURE-INTENT.md` - Structure rationale

### Service-Specific
- Each service has its own `CLAUDE.md`
- `chittyos-services/chittychat/CLAUDE.md`
- `chittyos-services/chittyrouter/CLAUDE.md`
- `chittyos-apps/chittycheck/CLAUDE.md`

### Recent Documentation
- `chittyos-services/chittyrouter/UNIFIED-ROUTING-ARCHITECTURE.md`
- `~/CHITTYOS_SERVICE_ARCHITECTURE.md`
- `~/CHITTYROUTER_UNIFIED_ROUTING_COMPLETE.md`

---

## Recent Changes

### October 3, 2025

**ChittyRouter Unified Routing**:
- Implemented unified service routing for 20+ services
- 3-tier routing strategy (hostname → path → AI)
- AI-powered intelligent routing with Llama 4
- Service bindings optimization
- Files: `src/routing/unified-service-router.js`, `UNIFIED-ROUTING-ARCHITECTURE.md`

**ChittyID Validator**:
- Removed deprecated `validateChecksum` method
- Enforces central ChittyID validation through id.chitty.cc

**Environment Updates**:
- Configured proper ChittyID tokens
- Added all core service URLs

---

## Common Issues & Solutions

### ChittyCheck Failures

**Rogue ID Patterns**:
- Usually in build artifacts (`dist/`)
- Check source files, not compiled builds
- Remove local ID generation code

**Missing Services**:
- Deploy services to Cloudflare
- Update DNS records
- Verify wrangler.toml configuration

**Missing CLAUDE.md**:
- Copy from similar service
- Follow structure in this file

### Service Deployment

**ChittyChat**:
```bash
cd chittyos-services/chittychat
npm run deploy
```

**ChittyRouter**:
```bash
cd chittyos-services/chittyrouter
npm run deploy:production
```

**ChittyAuth/Registry**:
```bash
cd chittyos-services/chittyauth
wrangler deploy
```

---

## Security & Compliance

### ChittyCheck Validation
- Validates ChittyID compliance
- Detects 1189+ rogue ID patterns
- Checks service connectivity
- Validates environment configuration
- Enforces session boundaries

### Secrets Management
- Never commit `.env` files
- Use 1Password CLI: `op run --env-file=.env.op`
- ChittyID tokens never hardcoded
- Wrangler secrets: `wrangler secret put`

### Permissions
- Full Disk Access (Evidence-Intake)
- Accessibility (automation scripts)
- Network (ChittyOS service communication)

---

## Support & Resources

### Commands
- `/help` - Get help with Claude Code
- `/chittycheck` - Run compliance validation
- `/health` - System health check
- `/services` - List ChittyOS services

### Documentation
- ChittyOS Docs: https://docs.chitty.cc
- GitHub Issues: https://github.com/chittyos
- Foundation: CHITTYFOUNDATION/

### Key Metrics
- Original Workers: 34+
- Optimized Workers: 5
- Resource Reduction: 85%
- Cost Savings: $500/month
- Services Routed: 20+

---

## Summary

This is the **ChittyOS Framework Core Repository** containing:
- ✅ 20+ production services
- ✅ Unified platform consolidation
- ✅ AI-powered intelligent routing
- ✅ Foundation standards integration
- ✅ Compliance validation tools

**Always run `/chittycheck` before committing changes.**

---

**Document Version**: 1.0
**Created**: October 3, 2025
**ChittyOS Framework**: v1.0.1
**Session**: session-8c21b5bf
