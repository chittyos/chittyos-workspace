# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ChittySync Hub** - Git-like omnidirectional todo synchronization service for the ChittyOS ecosystem. Enables distributed todo management across Claude Code, ChatGPT, Claude Desktop, and other AI platforms with sophisticated conflict resolution, vector clock causality tracking, and three-way merge algorithms.

**Location**: `/Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittysync`
**Deployment**: `https://gateway.chitty.cc/api/todos` (via ChittyGateway routing)
**Version**: 2.0.0
**Architecture**: Monorepo with worker, CLI tools, and platform integrations

---

## Repository Structure

```
chittysync/
├── worker/                    # Cloudflare Worker (main API)
│   ├── src/
│   │   ├── index.ts          # Main entry point & routing
│   │   ├── auth.ts           # Bearer token authentication
│   │   ├── chittyid-client.ts # ChittyID integration
│   │   ├── types.ts          # TypeScript interfaces
│   │   ├── vector-clock.ts   # Causality tracking
│   │   ├── merge-engine.ts   # Three-way merge algorithm
│   │   ├── memory-sync.ts    # Agent memory orchestration
│   │   ├── sessions/         # Session management (Tier 1)
│   │   │   ├── session-registry.ts
│   │   │   └── session-sync.ts
│   │   ├── projects/         # Project-level sync (Tier 2)
│   │   │   ├── project-sync.ts
│   │   │   ├── git-integration.ts
│   │   │   └── file-watcher.ts
│   │   ├── topics/           # Topic organization (Tier 3)
│   │   │   ├── topic-detector.ts
│   │   │   ├── topic-registry.ts
│   │   │   ├── topic-routes.ts
│   │   │   └── cross-project-tracker.ts
│   │   ├── integrations/     # Platform-specific handlers
│   │   │   ├── claude-code.ts
│   │   │   ├── cloudflare.ts
│   │   │   ├── github.ts
│   │   │   ├── google.ts
│   │   │   └── mcp.ts
│   │   └── docs/             # OpenAPI specs
│   ├── migrations/           # D1 database migrations
│   ├── tests/               # Test suites
│   ├── wrangler.toml        # Cloudflare Workers config
│   └── client/              # Client-side libraries
│
├── tools/                    # Universal orchestration hub
│   ├── integrations/        # Platform sync modules
│   │   ├── google/          # Gmail, Chat, Calendar, Sheets
│   │   ├── cloudflare/      # Workers, KV, D1, R2, DNS
│   │   ├── neon/            # Postgres databases
│   │   ├── github/          # Issues, PRs, Actions
│   │   ├── mcp/             # MCP server orchestration
│   │   └── docs/            # Documentation sync
│   ├── workflows/           # Orchestration workers
│   │   ├── sync-orchestrator.js
│   │   ├── health-monitor.js
│   │   ├── deployment-manager.js
│   │   └── alert-router.js
│   ├── cli/                 # Command-line interface
│   │   ├── chittysync.js
│   │   └── commands/
│   ├── session/             # Session metadata generation
│   └── legacy/              # Archived code
│
├── notion-sync/             # Notion integration (legacy)
├── package.json             # Root workspace config
└── CLAUDE.md               # This file
```

---

## Development Commands

### Root-Level Commands (Orchestration)

These commands run from the repository root and coordinate across the entire monorepo:

```bash
# Development
npm run dev                   # Start worker dev server (delegates to worker/)
npm run test                  # Run all tests
npm run setup                 # Install all dependencies + CLI + migrations

# Deployment
npm run deploy                # Deploy worker to development
npm run deploy:all            # Deploy all services via CLI

# Database
npm run db:migrate            # Run migrations (development)
npm run db:migrate:production # Run migrations (production)

# Tools & CLI
npm run cli:install           # Install chittysync CLI globally
npm run cli:uninstall         # Uninstall CLI

# Workflows (Cloudflare Workers orchestration)
npm run workflows:deploy      # Deploy all orchestration workers
npm run workflows:dev         # Dev server for workflows
npm run workflows:tail        # View workflow logs

# Platform sync (requires CLI installed)
npm run sync:all              # Sync all platforms
npm run sync:google           # Sync Google Workspace
npm run sync:cloudflare       # Sync Cloudflare services
npm run sync:github           # Sync GitHub issues/PRs

# Utilities
npm run status                # Check all service status
npm run health                # Health check all services
npm run clean                 # Remove all node_modules
```

### Worker Commands

Navigate to `worker/` directory for worker-specific development:

```bash
cd worker

# Development
wrangler dev                  # Start local dev server (port 8787)
npm run dev                   # Same as wrangler dev

# Testing
npm test                      # Run test suites
node tests/session-sync.test.ts    # Test session sync
node tests/project-sync.test.ts    # Test project sync
node tests/topic-sync.test.ts      # Test topic detection

# Database
wrangler d1 list              # List D1 databases
wrangler d1 execute chittyos-todos --file=./migrations/0002_add_merge_support.sql

# Deployment
wrangler deploy               # Deploy to development
wrangler deploy --env production  # Deploy to production
npm run deploy:production     # Deploy with production config

# Monitoring
wrangler tail                 # View live logs
wrangler tail --env production
```

### CLI Commands

After installing the CLI (`npm run cli:install`):

```bash
# Sync operations
chittysync sync --all                    # Sync all platforms
chittysync sync google cloudflare neon   # Sync specific platforms
chittysync sync --dry-run                # Preview changes

# Deployment
chittysync deploy --batch                # Deploy all workers
chittysync deploy chittychat chittyrouter # Deploy specific services
chittysync deploy --strategy blue-green  # Blue-green deployment

# Status & health
chittysync status                        # Check all services
chittysync status --verbose              # Detailed status
chittysync status --watch                # Watch mode
chittysync health                        # Health check
chittysync health id.chitty.cc           # Check specific service

# Configuration
chittysync config set GOOGLE_API_KEY=xxx
chittysync config get GOOGLE_API_KEY
chittysync config list
```

### Authentication Setup

```bash
# Required for worker deployment
wrangler secret put CHITTY_ID_TOKEN --env production
# When prompted, paste: mcp_auth_9b69455f5f799a73f16484eb268aea50

# For CLI operations
export CHITTY_ID_TOKEN=mcp_auth_9b69455f5f799a73f16484eb268aea50
```

---

## Architecture

ChittySync uses a **Git-like architecture** for distributed todo management:

### Core Concepts

**Vector Clocks**: Causality tracking to detect concurrent edits across platforms
- Each platform maintains a logical clock per todo
- Enables detection of concurrent vs sequential edits
- Resolves "happened-before" relationships

**Three-Way Merge**: Git-style merge algorithm
- **BASE**: Last known common state (common ancestor)
- **LOCAL**: Current platform state
- **REMOTE**: Hub state
- Automatic conflict detection with multiple resolution strategies

**Branches**: Platform/session isolation (like Git branches)
- Each platform creates branches: `claude-code-session-abc123`
- Merge branches back to main hub state
- Enables offline work with later sync

**Event Sourcing**: Immutable commit log of all operations
- Every todo change creates a commit
- Full audit trail with ChittyID verifiable identifiers
- Enables time-travel and rollback

### Three-Tier Sync Model

ChittySync implements a **three-tier organizational model**:

**Tier 1: Sessions** (Temporal) - *When* you're working
- Multiple sessions from same directory sync in real-time
- Git worktree-aware session lifecycle
- Auto-consolidation on session end
- Implementation: `worker/src/sessions/`

**Tier 2: Projects** (Spatial) - *What* codebase you're in
- Maintains singular canonical state across all sessions
- Project-specific `.chitty/` directories
- Auto-commits to Git per project
- Implementation: `worker/src/projects/`

**Tier 3: Topics** (Conceptual) - *Which* aspect/domain you're working on
- Auto-detected from content (e.g., "auth", "music", "routing")
- Organized within projects
- Tracked across projects
- Implementation: `worker/src/topics/`

### Integration Architecture

**Worker Integrations** (`worker/src/integrations/`):
- **claude-code.ts**: Claude Code directions API
- **cloudflare.ts**: Cloudflare Workers & KV sync
- **github.ts**: GitHub issues/PRs automation
- **google.ts**: Google Workspace integration
- **mcp.ts**: MCP server orchestration

**Tools Integrations** (`tools/integrations/`):
- **google/**: Gmail, Chat, Calendar, Sheets sync
- **cloudflare/**: Worker deployment, KV/D1/R2 sync, DNS
- **neon/**: Postgres database sync & migrations
- **github/**: Issue sync, PR automation, Actions triggers
- **mcp/**: MCP server registry & context sync
- **docs/**: Markdown sync, Notion bridge, README generation

---

## Code Architecture

### Entry Point: `worker/src/index.ts`

Main request router with CORS handling and authentication. Routes to:
- Health checks (no auth)
- Documentation endpoints (no auth)
- Todo CRUD operations (authenticated)
- Session/project/topic APIs (authenticated)
- Integration endpoints (authenticated)
- Memory sync (authenticated)

**Key route patterns**:
```typescript
/api/todos/*           // Todo CRUD
/api/todos/merge       // Three-way merge
/api/todos/conflicts   // Conflict resolution
/api/sessions/*        // Session management
/api/projects/*        // Project sync
/api/topics/*          // Topic organization
/api/memory/*          // Agent memory sync
/api/directions/*      // Claude Code integration
/api/integrations/*    // Platform integrations
```

### Authentication: `worker/src/auth.ts`

Bearer token validation, CORS handling, and JSON response formatting.

**CRITICAL**: Always use `requireAuth()` for protected endpoints.

### ChittyID Integration: `worker/src/chittyid-client.ts`

Client for minting verifiable identifiers from `id.chitty.cc`.

**NEVER generate IDs locally** - always use `ChittyIdClient.mint()`.

```typescript
// ✅ CORRECT
const chittyIdClient = new ChittyIdClient(env.CHITTYID_SERVICE_URL);
const chittyId = await chittyIdClient.mint("todo", "task", metadata, token);

// ❌ WRONG - Never do this
const id = `CHITTY-TODO-${Math.random()}`;
```

### Vector Clocks: `worker/src/vector-clock.ts`

Causality tracking for distributed systems. Compare clocks to detect:
- BEFORE: clock1 < clock2 (causal)
- AFTER: clock1 > clock2 (causal)
- CONCURRENT: incomparable (conflict)

### Merge Engine: `worker/src/merge-engine.ts`

Three-way merge implementation with conflict detection.

**Resolution strategies**:
- `timestamp` - Latest timestamp wins (default)
- `status_priority` - completed > in_progress > pending
- `keep_local` - Always keep local version
- `keep_remote` - Always keep remote version
- `keep_both` - Create two separate todos
- `manual` - User intervention required

### Session Management: `worker/src/sessions/`

**session-registry.ts**: Session registration and tracking
- Register/update sessions
- Track active sessions per project
- Session lifecycle management

**session-sync.ts**: Real-time session synchronization
- Sync between parallel sessions in same project
- Merge todos from multiple sessions
- Conflict resolution

### Project Sync: `worker/src/projects/`

**project-sync.ts**: Project-level orchestration
- Consolidate sessions into canonical project state
- Project-wide todo management
- Multi-session coordination

**git-integration.ts**: Git repository integration
- Auto-commit todos to Git
- Branch detection
- Worktree awareness

**file-watcher.ts**: File system monitoring
- Watch `.chitty/` directories
- Detect external changes
- Auto-sync on file changes

### Topic Organization: `worker/src/topics/`

**topic-detector.ts**: ML-based topic classification
- Auto-detect topics from todo content
- Multi-topic support (one todo can have 8+ topics)
- Keyword extraction and semantic analysis

**topic-registry.ts**: Topic catalog and management
- Register and track topics
- Topic hierarchies
- Cross-project topic tracking

**cross-project-tracker.ts**: Multi-repository topic tracking
- Track topics across multiple projects
- Discover related work across repositories
- Topic-based knowledge graphs

### Memory Sync: `worker/src/memory-sync.ts`

Agent memory orchestration for cross-session context sharing.

### Types: `worker/src/types.ts`

TypeScript interfaces for all API requests/responses, todos, and environment variables.

---

## Database Schema

### Core Tables

**todos**: Main todo storage
- ChittyID primary key from id.chitty.cc
- Soft deletes (deleted_at timestamp)
- Platform attribution (claude-code, chatgpt, desktop, custom)
- Extensible metadata JSON blob

**sync_log**: Audit trail for all sync operations
- Tracks create, update, delete, sync actions
- Conflict detection flags
- Platform attribution

**sessions**: Session registry (Tier 1)
- Session IDs and metadata
- Project associations
- Git branch/commit tracking
- Active/inactive status

**projects**: Project registry (Tier 2)
- Project IDs and paths
- Canonical state tracking
- Last consolidation timestamp

**topics**: Topic registry (Tier 3)
- Topic names and descriptions
- Hierarchical organization
- Cross-project tracking

**branches**: Platform/session branches
- Branch IDs like "claude-code-session-abc123"
- Head commit tracking

**commits**: Event sourcing for all operations
- Immutable todo snapshots
- Parent/merge parent relationships
- Vector clock serialization

**conflicts**: Unresolved and resolved conflicts
- Base/local/remote version snapshots
- Conflict type classification
- Resolution strategy tracking

**vector_clocks**: Causality tracking per todo per platform
- Logical clock values
- Updated on every modification

**agent_memories**: Agent context storage
- Cross-session memory persistence
- Agent-specific context
- Memory snapshots

---

## API Endpoints

All endpoints use Bearer token authentication (except health check and docs).

### Core Todo API

```bash
# Health check (no auth)
GET /api/todos/health

# Documentation (no auth)
GET /docs
GET /docs/openapi.yaml
GET /docs/openapi.json

# Create todo
POST /api/todos
Body: {"content": "Deploy worker", "status": "pending", "platform": "claude-code"}

# List todos (with filters)
GET /api/todos?platform=claude-code&status=pending&limit=100

# Get single todo
GET /api/todos/{id}

# Update todo
PUT /api/todos/{id}
Body: {"status": "completed"}

# Delete todo (soft delete)
DELETE /api/todos/{id}

# Delta sync (get updates since timestamp)
GET /api/todos/since/{timestamp}

# Bulk sync
POST /api/todos/sync
Body: {"todos": [{"content": "...", "status": "pending"}]}
```

### Merge & Conflict Resolution

```bash
# Merge todos from branch to main
POST /api/todos/merge
Body: {"branch_id": "claude-code-session-abc", "target_branch_id": "main", "strategy": "timestamp"}

# List conflicts
GET /api/todos/conflicts?resolved=false&todo_id=CHITTY-TODO-123

# Resolve conflict
POST /api/todos/conflicts/{id}/resolve
Body: {"strategy": "keep_local", "resolved_by": "user@chitty.cc"}

# List branches
GET /api/todos/branches

# Create branch
POST /api/todos/branches
Body: {"name": "claude-code-main", "platform": "claude-code", "session_id": "session-abc"}

# Get commit
GET /api/todos/commits/{id}
```

### Session Sync (Tier 1)

```bash
# Register or update a session
POST /api/sessions/register
Body: {
  "session_id": "session-abc123",
  "project_id": "chittyrouter-hash",
  "project_path": "/Users/nb/.../chittyrouter",
  "git_branch": "main",
  "git_commit": "a6e6448",
  "platform": "claude-code",
  "agent_id": "claude-001"
}

# Sync session to project canonical state
POST /api/sessions/{session_id}/sync
Body: {
  "project_id": "chittyrouter-hash",
  "todos": [{"id": "...", "content": "...", "status": "pending"}],
  "strategy": "timestamp"
}

# Get session details
GET /api/sessions/{session_id}

# End a session
POST /api/sessions/{session_id}/end

# Get all active sessions for a project
GET /api/projects/{project_id}/sessions

# Get project canonical state
GET /api/projects/{project_id}/canonical
```

### Topic Organization (Tier 3)

```bash
# Detect topics from content
POST /api/topics/detect
Body: {"content": "Fix auth middleware and add OAuth"}

# Get topic details
GET /api/topics/{topic_name}

# List all topics
GET /api/topics

# Get todos by topic
GET /api/topics/{topic_name}/todos

# Cross-project topic view
GET /api/topics/{topic_name}/projects
```

### Memory Sync

```bash
# Sync agent memory
POST /api/memory/sync
Body: {"agent_id": "...", "session_id": "...", "memories": [...]}

# Pull agent memory
GET /api/memory/{agent_id}/{session_id}?since={timestamp}
```

### Integration Endpoints

```bash
# Claude Code directions
POST /api/directions/create
POST /api/directions/{id}/claim
POST /api/directions/{id}/complete

# Google Workspace
POST /api/integrations/google/sync
POST /api/integrations/google/alert

# Cloudflare
POST /api/integrations/cloudflare/deploy
POST /api/integrations/cloudflare/kv/sync

# GitHub
POST /api/integrations/github/issues/sync
POST /api/integrations/github/webhooks

# MCP
POST /api/integrations/mcp/servers/register
POST /api/integrations/mcp/context/sync
```

---

## Testing

### Worker Tests

```bash
cd worker

# Unit tests
npm test

# Specific test suites
node tests/session-sync.test.ts
node tests/project-sync.test.ts
node tests/topic-sync.test.ts

# Merge engine tests
node tests/merge-test.cjs
```

### Integration Tests

```bash
cd notion-sync/test

# Performance tests
node performance-load-test.js

# Penetration tests
node penetration-test.js

# QA suite
node qa-test-suite.js
```

---

## ChittyOS Integration

### Environment Variables

Required in `wrangler.toml`:
- `SERVICE_NAME` - Service identifier
- `SERVICE_VERSION` - Version string
- `CHITTYOS_ENVIRONMENT` - development | production
- `CHITTYID_SERVICE_URL` - https://id.chitty.cc/v1
- `GATEWAY_SERVICE_URL` - https://gateway.chitty.cc

Required secrets (set with `wrangler secret put`):
- `CHITTY_ID_TOKEN` - Authentication token for ChittyID service

### Deployment Routing

ChittySync deploys to:
1. **Direct worker**: `chittysync-hub-production.chittycorp-llc.workers.dev`
2. **Via ChittyGateway**: `gateway.chitty.cc/api/todos/*` (recommended)

The gateway route provides unified authentication and routing.

---

## Common Issues

### 401 Unauthorized
**Cause**: Missing or invalid CHITTY_ID_TOKEN
**Fix**: `wrangler secret put CHITTY_ID_TOKEN --env production`

### 500 Internal Server Error on Create
**Cause**: ChittyID service unreachable or token invalid
**Fix**: Verify token with `curl https://id.chitty.cc/v1/health`

### Database not found
**Cause**: D1 database not created or bound
**Fix**: Check `wrangler d1 list` and verify wrangler.toml bindings

### Merge conflicts not auto-resolving
**Cause**: Conflicting strategies or concurrent edits
**Fix**: Use manual resolution via `/api/todos/conflicts/{id}/resolve`

### Workspace installation issues
**Cause**: npm workspaces not properly configured
**Fix**: Run `npm run clean && npm run setup` from root

---

## Implementation Status

### ✅ Phase 1: Hub API (Complete)
- REST endpoints (8)
- ChittyID integration
- Bearer token authentication
- Soft deletes
- Delta sync
- Bulk sync

### ✅ Phase 2.1: Three-Way Merge (Complete)
- Vector clock implementation
- Three-way merge engine
- Conflict detection
- Resolution strategies
- Database schema enhancements
- 5 new API endpoints
- Client-side merge library
- Comprehensive test suite

### ✅ Phase 2.2: Session Sync - Tier 1 (Complete)
- Session registry for tracking active sessions
- Multi-session coordination in same project
- Real-time sync between parallel sessions
- Session-project-todo associations
- Project canonical state management
- Three-way merge integration for session consolidation
- 6 new API endpoints
- Database migration (0003_add_session_sync.sql)
- Comprehensive test suite

### ✅ Phase 2.3: Tools & Orchestration (Complete)
- CLI installation and commands
- Platform integrations (Google, Cloudflare, Neon, GitHub, MCP)
- Workflow orchestration workers
- Health monitoring
- Deployment automation
- Alert routing

### 🔜 Phase 2.4-2.10: Future
- Topic detection & organization (Phase 2.4)
- Operational transformation (Phase 2.5)
- Event sourcing (Phase 2.6)
- WebSocket real-time (Phase 2.7)
- Merge commits (Phase 2.8)
- Conflict resolution UI (Phase 2.9)
- CRDT integration (Phase 2.10)
- Performance optimization & full testing (Phase 2.11)

---

## Core Philosophy: Natural Convergence

ChittySync follows the **Natural Convergence Principle**: the system naturally flows toward simplicity.

**Key Concepts**:
- **1 file per directory** - `{project}/.chitty/current.json` (the "silk version")
- **1 canonical state per project** - merged from all sessions
- **Topic-based alignment** - discover related work without knowing service names

See documentation for complete philosophy details.

---

## Documentation

### Quick Reference
- **Tools README**: `tools/README.md` - Universal orchestration hub guide
- **Architecture Overview**: See three-tier sync model above
- **API Documentation**: `GET /docs` when worker is running

### Design Documents
Refer to the repository for detailed design documents on:
- Three-tier sync architecture
- Parallel session coordination
- Project-aware synchronization
- Topic-based organization
- Natural convergence principles

---

**Document Version**: 2.0.0
**Created**: 2025-10-18
**Updated**: 2025-10-22
**ChittyOS Framework**: v1.0.1
**Service**: ChittySync Hub v2.0.0
