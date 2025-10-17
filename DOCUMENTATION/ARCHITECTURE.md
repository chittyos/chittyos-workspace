# ChittyOS Architecture

**System design and component relationships.**

---

## High-Level Architecture

Hub-and-spoke architecture with centralized identity and distributed services:

```
                🏛️ ChittyOS Central Authority
                    ├── 🆔 id.chitty.cc (ChittyID)
                    ├── 📋 registry.chitty.cc (Registry)
                    ├── ⚖️ canon.chitty.cc (Canon)
                    └── 📊 schema.chitty.cc (Schema)
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
🚪 ChittyChat       🤖 ChittyRouter    📊 ChittySchema
(34+ → 1 Worker)    (AI Gateway)       (Data Framework)
gateway.chitty.cc   router.chitty.cc   schema.chitty.cc
```

---

## Core Design Principles

1. **ChittyID Authority**: All IDs from `id.chitty.cc` - no local generation
2. **Service Orchestration**: Unified workers replace microservice sprawl (85% resource reduction)
3. **Cross-Session Continuity**: Git worktree management with state persistence
4. **Evidence-Based Operations**: All activities generate verifiable evidence
5. **Universal Schema**: Entity-based data model (PEO/PLACE/PROP/EVNT/AUTH)

---

## Major Components

### 1. ChittyChat Platform (`chittychat/`)
**Purpose**: Unified Cloudflare Worker consolidating 34+ microservices

**Key Files**:
- `src/platform-worker.js` - Main worker entry
- `wrangler.optimized.toml` - Production config

**Services**:
- AI Gateway, Auth, Beacon, Canon, Chat
- Registry, Sync, Verify, Evidence

**Metrics**:
- 85% resource reduction
- $500/month cost savings
- Account: ChittyCorp LLC (bbf9fcd845e78035b7a135c481e88541)

### 2. ChittyRouter AI Gateway (`chittyrouter/`)
**Purpose**: AI-powered intelligent routing for legal workflows

**Key Files**:
- `src/ai/intelligent-router.js` - AI routing logic
- `src/ai/agent-orchestrator.js` - Multi-agent coordination

**AI Models**:
- Llama 4, GPT-OSS, Gemma 3
- Automatic fallback chains

**Features**:
- Multi-agent coordination
- Document analysis
- Automated responses

### 3. ChittySchema Data Framework (`chittyschema/`)
**Purpose**: Universal neutralized schema for evidence, facts, cases

**Key Files**:
- `db/schema.ts` - Database schema
- `src/routes/*.ts` - API routes

**Database**:
- PostgreSQL with Neon provider
- Drizzle ORM

**Integration**:
- Notion sync
- macOS extensions
- ChittyOS service registry

### 4. Supporting Infrastructure

**ChittyCheck** (`chittycheck/`):
- Comprehensive compliance validation
- Blocks local ChittyID generation
- Git worktree enforcement

**ChittyID Research** (`chittyid/`):
- Identity system research
- Blockchain integration prototypes

**Legal Tech** (`legal/`):
- Case management
- Document processing

---

## Integration Patterns

### ChittyID Integration
- **Never generate locally** - all from `https://id.chitty.cc/v1/mint`
- **Required**: `CHITTY_ID_TOKEN` environment variable
- **Format**: `CHITTY-{ENTITY}-{SEQUENCE}-{CHECKSUM}`
- **Entities**: PEO, PLACE, PROP, EVNT, AUTH, INFO, FACT, CONTEXT, ACTOR

### Cross-Session Management
- **Git Worktrees**: Isolated branch per session
- **State Persistence**: GitHub repo sync
- **Evidence Collection**: All ops generate blockchain evidence
- **Conflict Prevention**: Automatic boundary detection

### Service Discovery
- **Registry**: `registry.chitty.cc` maintains catalog
- **Auto-Registration**: Projects self-register
- **Health Monitoring**: Continuous availability checks
- **Load Balancing**: Intelligent routing

---

## Production Domains

- `gateway.chitty.cc` - Unified platform entry
- `api.chitty.cc` - API gateway
- `id.chitty.cc` - ChittyID authority
- `registry.chitty.cc` - Service registry
- `schema.chitty.cc` - Data framework
- `router.chitty.cc` - AI gateway

---

## Local Directory Structure

```
/Users/nb/.claude/projects/-/
├── chittychat/           # Unified platform worker
├── chittyrouter/         # AI gateway
├── chittyschema/         # Data framework
├── chittycheck/          # Compliance validation
├── chittyid/             # Identity research
├── legal/                # Legal technology
├── system/               # System integration
└── CHITTYOS/             # Services ecosystem
    ├── chittyos-services/
    │   ├── chittyauth/
    │   ├── chittyregistry/
    │   ├── chittysync/
    │   └── ...
    └── chittyos-apps/
```

---

## Security Architecture

### Secrets Management
- 1Password CLI integration
- Never commit `.env` files
- ChittyID tokens never hardcoded

### Infrastructure Security
- Cloudflare Workers (ChittyCorp LLC account)
- PostgreSQL with Neon (SSL required)
- Bearer token authentication
- Rate limiting

### Session Security
- Isolated git worktrees
- Evidence collection for audit
- Cross-session validation
- Conflict detection

---

For implementation details, see [DEVELOPMENT.md](DEVELOPMENT.md).
