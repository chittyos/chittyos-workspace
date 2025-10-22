# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ChittyConnect** - **itsChitty™: The AI-intelligent spine with ContextConsciousness™, MemoryCloude™, and Cognitive-Coordination™**

ChittyConnect is the central integration hub for the ChittyOS ecosystem, providing:
- **REST API** for custom GPT Actions integration
- **MCP Protocol Server** for Claude integration with 16+ tools
- **GitHub App Integration** for webhook processing and event normalization
- **Third-Party Proxy** for Notion, OpenAI, Google Calendar, Neon, Cloudflare AI
- **ContextConsciousness™** - Ecosystem awareness, anomaly detection, failure prediction
- **MemoryCloude™** - 90-day semantic memory with vector embeddings (Vectorize)
- **Cognitive-Coordination™** - Complex task decomposition and parallel execution

**Location**: `/Users/nb/.claude/projects/-/CHITTYOS/chittyos-apps/chittyconnect`
**Domain**: `connect.chitty.cc`
**Tech Stack**: Hono, Cloudflare Workers, D1, KV, Queues, Workers AI, Vectorize

---

## Commands

### Development
```bash
# Start local development server (port 8787)
npm run dev

# Deploy to staging environment
npm run deploy:staging

# Deploy to production (connect.chitty.cc)
npm run deploy:production

# Run tests
npm test

# Watch mode testing
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format
```

### First-Time Setup
```bash
# 1. Install dependencies
npm install

# 2. Create KV namespaces (if not already created)
wrangler kv:namespace create "IDEMP_KV"
wrangler kv:namespace create "TOKEN_KV"
wrangler kv:namespace create "API_KEYS"
wrangler kv:namespace create "RATE_LIMIT"

# 3. Create D1 database
wrangler d1 create chittyconnect

# 4. Create queue
wrangler queues create github-events

# 5. Update wrangler.toml with the IDs returned

# 6. Initialize D1 schema (run on first deploy)
# Schema is auto-initialized in src/integrations/chittyos-ecosystem.js:initializeDatabase()

# 7. Set secrets (ChittyOS services)
wrangler secret put CHITTY_ID_TOKEN
wrangler secret put CHITTY_AUTH_TOKEN
wrangler secret put CHITTY_CASES_TOKEN
wrangler secret put CHITTY_FINANCE_TOKEN
wrangler secret put CHITTY_EVIDENCE_TOKEN
wrangler secret put CHITTY_SYNC_TOKEN
wrangler secret put CHITTY_CHRONICLE_TOKEN
wrangler secret put CHITTY_CONTEXTUAL_TOKEN
wrangler secret put CHITTY_REGISTRY_TOKEN

# 8. Set third-party secrets
wrangler secret put NOTION_TOKEN
wrangler secret put OPENAI_API_KEY
wrangler secret put GOOGLE_ACCESS_TOKEN
wrangler secret put NEON_DATABASE_URL

# 9. Set GitHub App credentials (optional)
wrangler secret put GITHUB_APP_ID
wrangler secret put GITHUB_APP_PK
wrangler secret put GITHUB_WEBHOOK_SECRET
```

### API Key Management
```bash
# Generate API key for custom GPT
node scripts/generate-api-key.js

# Store API key in KV (manual)
wrangler kv:key put --binding=API_KEYS "key:your-api-key" \
  '{"status":"active","rateLimit":1000,"name":"My GPT"}'
```

---

## Architecture

### Three-Layer Design

```
┌─────────────────────────────────────────────────────────┐
│                    ChittyConnect                        │
│       itsChitty™ - The AI-Intelligent Spine             │
│   ContextConsciousness, MemoryCloude, Coordination      │
└─────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
    ┌───▼────┐      ┌─────▼─────┐     ┌─────▼─────┐
    │  API   │      │    MCP    │     │  GitHub   │
    │ Router │      │  Server   │     │   App     │
    └───┬────┘      └─────┬─────┘     └─────┬─────┘
        │                 │                  │
    ┌───▼─────────────────▼──────────────────▼───┐
    │          ChittyOS Services Layer           │
    ├────────────────────────────────────────────┤
    │ ChittyID │ ChittyCases │ ChittyFinance     │
    │ ChittyAuth │ ChittyEvidence │ ChittySync   │
    │ ChittyChronicle │ ChittyContextual         │
    │ ChittyRegistry │ Services Status            │
    └────────────────────────────────────────────┘
                           │
    ┌──────────────────────▼────────────────────┐
    │      Third-Party Integration Layer        │
    ├───────────────────────────────────────────┤
    │ Notion │ Neon │ OpenAI │ Google │ CF AI  │
    └───────────────────────────────────────────┘
```

### Core Components

**`src/index.js`** - Main worker entry point
- Initializes intelligence modules (ContextConsciousness, MemoryCloude, Cognitive-Coordination)
- Mounts API router (`/api/*`), MCP server (`/mcp/*`), GitHub webhooks
- Handles GitHub App installation OAuth flow
- Exports queue consumer for async event processing
- Lazy initialization pattern for ecosystem integration

**`src/api/router.js`** - REST API for custom GPT Actions
- CORS configured for ChatGPT origins
- Authentication middleware on all `/api/*` routes
- 11 route modules for ChittyOS services + third-party + intelligence
- OpenAPI spec endpoint at `/openapi.json`

**`src/mcp/server.js`** - MCP Protocol Server for Claude
- MCP v2024-11-05 protocol implementation
- 16 tools: ChittyOS ecosystem + third-party + intelligence
- 3 resources: service status, registry, ContextConsciousness state
- Tool execution dispatch and error handling

**`src/intelligence/`** - AI Intelligence Modules
- `context-consciousness.js` - Ecosystem monitoring, anomaly detection, failure prediction
- `memory-cloude.js` - 90-day semantic memory with Vectorize embeddings
- `cognitive-coordination.js` - Complex task decomposition, parallel execution, self-learning

**`src/integrations/chittyos-ecosystem.js`** - ChittyOS Integration
- Central orchestration for ChittyID, Registry, Auth, Verify, Certify, DNA
- Database initialization and schema management
- Context lifecycle management (mint → initialize → register → verify → certify)
- Service discovery and caching

**`src/handlers/`** - Event Processing
- `webhook.js` - Fast-ack GitHub webhook handler (verify → queue → respond)
- `queue.js` - Async event consumer with MCP normalization

**`src/api/routes/`** - API Route Handlers
- Each ChittyOS service has dedicated route module
- Proxies requests to backend services with authentication
- Error handling and response normalization
- Routes: chittyid, chittycases, chittyauth, chittyfinance, chittycontextual,
  chittychronicle, chittysync, chittyevidence, registry, services, thirdparty, intelligence

---

## Key Features & Implementation Details

### 1. Intelligence Modules (itsChitty™)

**ContextConsciousness™** (`src/intelligence/context-consciousness.js`)
- Real-time service health monitoring via ChittyRegistry
- Anomaly detection: compares current vs historical metrics
- Failure prediction: pattern analysis on health history
- Captures ecosystem snapshots with service-level detail
- Access via MCP tools: `consciousness_get_awareness`, `consciousness_capture_snapshot`

**MemoryCloude™** (`src/intelligence/memory-cloude.js`)
- 90-day conversational memory retention
- Vector embeddings via Cloudflare Vectorize (if available)
- Semantic search: recall context by similarity
- Session summaries: AI-generated using Workers AI
- Access via MCP tools: `memory_persist_interaction`, `memory_recall_context`, `memory_get_session_summary`

**Cognitive-Coordination™** (`src/intelligence/cognitive-coordination.js`)
- Intelligent task decomposition into subtasks
- Parallel execution engine with configurable concurrency (default: 5)
- Dependency resolution and execution ordering
- Result synthesis: combines parallel results into coherent output
- Self-learning: tracks patterns and improves over time
- Access via MCP tools: `coordination_execute_task`, `coordination_analyze_task`

### 2. MCP Protocol Server

**Available Tools** (16 total):
- **ChittyOS Core**: `chittyid_mint`, `chitty_case_create`, `chitty_chronicle_log`, `chitty_evidence_ingest`, `chitty_sync_trigger`, `chitty_services_status`, `chitty_registry_discover`, `chitty_finance_connect_bank`
- **Contextual Analysis**: `chitty_contextual_analyze` - ContextConsciousness-powered analysis
- **Third-Party**: `notion_query`, `openai_chat`
- **Intelligence**: `consciousness_get_awareness`, `consciousness_capture_snapshot`, `memory_persist_interaction`, `memory_recall_context`, `memory_get_session_summary`, `coordination_execute_task`, `coordination_analyze_task`

**Resources**:
- `chitty://services/status` - Real-time service health
- `chitty://registry/services` - Service directory
- `chitty://context/awareness` - ContextConsciousness state

**Endpoints**:
- `GET /mcp/manifest` - Server capabilities
- `GET /mcp/tools/list` - Tool schemas
- `POST /mcp/tools/call` - Execute tool
- `GET /mcp/resources/list` - Available resources
- `GET /mcp/resources/read` - Read resource content

### 3. GitHub App Integration

**Fast-Ack Webhook Processing**:
1. Verify HMAC signature (constant-time comparison)
2. Check idempotency via `IDEMP_KV` (24h TTL)
3. Queue event to `github-events` queue
4. Return 200 OK immediately (< 100ms)

**OAuth Installation Flow** (`/integrations/github/callback`):
1. Fetch installation details from GitHub API
2. Mint ChittyID for installation (entity: CONTEXT)
3. Initialize ChittyDNA record
4. Store in D1 database (`installations` table)
5. Cache installation token in `TOKEN_KV` (1h TTL)
6. Log event to ChittyChronicle
7. Redirect to success page

**Queue Consumer** (`src/handlers/queue.js`):
- Batch processing (max 10 events, 30s timeout)
- MCP event normalization
- Dispatches to appropriate handlers based on event type

**D1 Schema**:
```sql
CREATE TABLE installations (
  installation_id INTEGER PRIMARY KEY,
  chittyid TEXT NOT NULL,
  account_id INTEGER,
  account_login TEXT,
  account_type TEXT,
  repository_selection TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

### 4. Authentication & Rate Limiting

**API Key Auth** (`src/api/middleware/auth.js`):
- Header: `X-ChittyOS-API-Key`
- Stored in `API_KEYS` KV namespace
- Per-key metadata: status, rateLimit, name

**Rate Limiting** (`src/middleware/rate-limit.js`):
- Default: 1000 requests/minute per API key
- Configurable per key via KV metadata
- Sliding window implementation using `RATE_LIMIT` KV

### 5. ChittyOS Ecosystem Integration

**Service Proxy Pattern**:
All ChittyOS services are accessed via proxy pattern:
```javascript
const response = await fetch('https://service.chitty.cc/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${env.CHITTY_SERVICE_TOKEN}`
  },
  body: JSON.stringify(args)
});
```

**Context Lifecycle**:
1. **Mint** ChittyID from `id.chitty.cc`
2. **Initialize** ChittyDNA record at `dna.chitty.cc`
3. **Register** with `registry.chitty.cc`
4. **Request** API keys from `auth.chitty.cc`
5. **Verify** context at `verify.chitty.cc`
6. **Certify** via `certify.chitty.cc`

**Initialization** (`src/integrations/chittyos-ecosystem.js:initializeDatabase()`):
- Auto-creates D1 schema on first request
- Creates `installations` table for GitHub App
- Idempotent: safe to run multiple times

---

## Configuration

### Environment Variables

**ChittyOS Service URLs** (defined in `wrangler.toml`):
```toml
CHITTYID_SERVICE_URL = "https://id.chitty.cc"
REGISTRY_SERVICE_URL = "https://registry.chitty.cc"
CHITTYOS_ACCOUNT_ID = "0bc21e3a5a9de1a4cc843be9c3e98121"
CHITTYOS_DOMAIN = "chitty.cc"
ENVIRONMENT = "production|staging"
```

**Secrets** (set via `wrangler secret put`):
- **ChittyOS**: CHITTY_ID_TOKEN, CHITTY_AUTH_TOKEN, CHITTY_CASES_TOKEN, CHITTY_FINANCE_TOKEN, CHITTY_EVIDENCE_TOKEN, CHITTY_SYNC_TOKEN, CHITTY_CHRONICLE_TOKEN, CHITTY_CONTEXTUAL_TOKEN, CHITTY_REGISTRY_TOKEN
- **Third-Party**: NOTION_TOKEN, OPENAI_API_KEY, GOOGLE_ACCESS_TOKEN, NEON_DATABASE_URL
- **GitHub**: GITHUB_APP_ID, GITHUB_APP_PK, GITHUB_WEBHOOK_SECRET

### Cloudflare Bindings

**KV Namespaces**:
- `IDEMP_KV` - Idempotency tracking for webhooks
- `TOKEN_KV` - Cached installation tokens
- `API_KEYS` - API key storage and metadata
- `RATE_LIMIT` - Rate limiting state

**D1 Database**:
- `DB` - Installation mapping and persistence

**Queue**:
- `EVENT_Q` - GitHub event processing queue

**Workers AI**:
- `AI` - Cloudflare Workers AI binding for MemoryCloude and Cognitive-Coordination

**Vectorize** (optional):
- Not configured in `wrangler.toml` - MemoryCloude gracefully degrades without it

---

## Development Patterns

### Adding New ChittyOS Service Integration

1. **Create route handler** in `src/api/routes/`:
```javascript
// src/api/routes/chittynewservice.js
import { Hono } from 'hono';

const chittynewserviceRoutes = new Hono();

chittynewserviceRoutes.post('/endpoint', async (c) => {
  const response = await fetch('https://newservice.chitty.cc/api/endpoint', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${c.env.CHITTY_NEWSERVICE_TOKEN}`
    },
    body: await c.req.raw.clone().arrayBuffer()
  });
  return c.json(await response.json());
});

export { chittynewserviceRoutes };
```

2. **Mount in router** (`src/api/router.js`):
```javascript
import { chittynewserviceRoutes } from './routes/chittynewservice.js';
api.route('/api/chittynewservice', chittynewserviceRoutes);
```

3. **Add MCP tool** (if needed) in `src/mcp/server.js`:
```javascript
// In tools/list endpoint
{
  name: 'chitty_newservice_action',
  description: 'Perform action on new service',
  inputSchema: { /* JSON schema */ }
}

// In tools/call endpoint
case 'chitty_newservice_action':
  result = await performNewServiceAction(args, c.env);
  break;
```

4. **Add secret** to `wrangler.toml` comments and set:
```bash
wrangler secret put CHITTY_NEWSERVICE_TOKEN
```

### Adding Intelligence Capabilities

Intelligence modules are injected into Hono context during initialization:

```javascript
// Access in route handlers
app.get('/some-endpoint', async (c) => {
  const consciousness = c.get('consciousness');
  const memory = c.get('memory');
  const coordinator = c.get('coordinator');

  // Use intelligence modules
  const snapshot = await consciousness.captureEcosystemSnapshot();
  await memory.persistInteraction(sessionId, interaction);
  const result = await coordinator.executeComplex(task);

  return c.json({ snapshot, result });
});
```

### Error Handling Pattern

All routes and tools follow consistent error handling:

```javascript
try {
  const result = await performOperation();
  return c.json(result);
} catch (error) {
  console.error('[Component] Error:', error);
  return c.json({ error: error.message }, 500);
}
```

---

## Testing

### Running Tests
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

### Test Files
- `src/api/__tests__/validation.test.js` - API validation tests
- `src/integrations/__tests__/chittycanon.test.js` - ChittyCanon integration tests

### Manual Testing

**Health Check**:
```bash
curl https://connect.chitty.cc/health
curl https://connect.chitty.cc/api/health
curl https://connect.chitty.cc/intelligence/health
```

**MCP Protocol**:
```bash
# Get manifest
curl https://connect.chitty.cc/mcp/manifest

# List tools
curl https://connect.chitty.cc/mcp/tools/list

# Call tool (requires API key)
curl -X POST https://connect.chitty.cc/mcp/tools/call \
  -H "X-ChittyOS-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"name":"chitty_services_status","arguments":{}}'
```

**GitHub Webhook** (local testing):
```bash
# Requires valid HMAC signature
# Use GitHub's webhook redelivery for testing
```

---

## ChittyID Compliance

⚠️ **CRITICAL**: ChittyConnect adheres to ChittyOS ChittyID policies:

- **NO local ID generation** - All ChittyIDs minted from `id.chitty.cc`
- **Token requirement**: `CHITTY_ID_TOKEN` secret must be set
- **Validation**: ChittyCheck scans for rogue ID patterns
- **Format**: `CHITTY-{ENTITY}-{SEQUENCE}-{CHECKSUM}`
- **Entities**: PEO, PLACE, PROP, EVNT, AUTH, INFO, FACT, CONTEXT, ACTOR

---

## Common Issues & Solutions

### Deployment Fails
- **Issue**: Missing KV/D1/Queue bindings
- **Solution**: Verify all resource IDs in `wrangler.toml` match created resources

### Intelligence Modules Unavailable
- **Issue**: `consciousness`, `memory`, or `coordinator` is null
- **Solution**: Check initialization errors in logs - modules gracefully degrade on failure

### API Key Authentication Fails
- **Issue**: `X-ChittyOS-API-Key` header rejected
- **Solution**: Verify key exists in `API_KEYS` KV with `{"status":"active"}`

### GitHub Webhook 401 Unauthorized
- **Issue**: HMAC signature verification fails
- **Solution**: Verify `GITHUB_WEBHOOK_SECRET` matches GitHub App configuration

### Service Proxy Errors
- **Issue**: Backend ChittyOS service returns 401/403
- **Solution**: Check corresponding `CHITTY_*_TOKEN` secret is set correctly

---

## Documentation

- **README.md** - User-facing documentation and API reference
- **ARCHITECTURE_ANALYSIS.md** - Comprehensive architectural review
- **INNOVATION_ROADMAP.md** - ContextConsciousness and MemoryCloude vision
- **QUICK_START.md** - 30-minute setup guide
- **INTELLIGENCE_GUIDE.md** - Deep dive into intelligence modules
- **VALIDATION_REPORT.md** - Test results and validation
- **docs/MCP_CLIENT_SETUP.md** - MCP client configuration
- **docs/GITHUB_APP_SETUP.md** - GitHub App registration

---

## Related ChittyOS Services

ChittyConnect integrates with all ChittyOS services:

- **ChittyID** (`id.chitty.cc`) - Identity authority
- **ChittyAuth** (`auth.chitty.cc`) - Authentication
- **ChittyRegistry** (`registry.chitty.cc`) - Service discovery
- **ChittyCases** (`cases.chitty.cc`) - Legal case management
- **ChittyFinance** (`finance.chitty.cc`) - Banking integration
- **ChittyEvidence** (`evidence.chitty.cc`) - Evidence ingestion
- **ChittySync** (`sync.chitty.cc`) - Data synchronization
- **ChittyChronicle** (`chronicle.chitty.cc`) - Event logging
- **ChittyContextual** (`contextual.chitty.cc`) - Contextual analysis

---

**Version**: 1.0.0
**ChittyOS Framework**: v1.0.1
**MCP Protocol**: v2024-11-05
**Last Updated**: October 22, 2025
