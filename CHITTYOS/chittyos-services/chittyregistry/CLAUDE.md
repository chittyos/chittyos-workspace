# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ChittyRegistry Universal System** - Service registry and discovery platform for the ChittyOS ecosystem. This service enables universal tool/script registration, intelligent search, and ChittyChat integration for AI-driven development workflows.

**Location**: `/Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittyregistry`
**Version**: 2.0.0
**Primary Domain**: `registry.chitty.cc`
**Deployment**: Cloudflare Workers

---

## Development Commands

### Local Development
```bash
# Start development server
npm run dev                  # Wrangler dev server (default port)

# Deploy
npm run deploy               # Deploy to production
npm run deploy:staging       # Deploy to staging environment
npm run deploy:production    # Deploy to production environment

# Monitoring
npm run tail                 # Tail worker logs

# Validation
npm run validate             # Wrangler configuration validation
npm test                     # Run test suite
```

### Cloudflare Workers Commands
```bash
# Deploy with wrangler directly
wrangler deploy

# Environment-specific deployment
wrangler deploy --env staging
wrangler deploy --env production

# Tail logs
wrangler tail
wrangler tail --format pretty

# KV namespace operations
wrangler kv:namespace list
wrangler kv:key list --binding REGISTRY_STORE
```

---

## Architecture

### Worker Structure
The registry runs as a Cloudflare Worker with two primary implementations:

1. **`src/universal-registry-worker.js`** (Primary, v2.0.0)
   - Universal registry with intelligent search
   - ChittyChat integration
   - Duplicate detection and prevention
   - AI-driven recommendations

2. **`src/worker.js`** (Legacy, v1.0.0)
   - Basic service discovery
   - Health check endpoint
   - Canonical services

### Core Functionality

**Service Registry**:
- Universal tool/script registration
- Multi-dimensional search (query, category, capability)
- Intelligent recommendations based on intent
- Duplicate detection across the ecosystem

**ChittyChat Integration**:
- Contextual recommendations for AI sessions
- Duplication prevention during development
- Session-aware tool discovery

**Storage**:
- Cloudflare KV for persistence
- `REGISTRY_CACHE` - Query result caching
- `REGISTRY_STORE` - Tool/script metadata storage

### API Endpoints

**Health & Status**:
```
GET  /health                      # Health check
GET  /api/v1/stats                # Registry statistics
```

**Search & Discovery**:
```
GET  /api/v1/search               # Search registry (q, category, capability, limit)
GET  /api/v1/recommendations      # Intelligent recommendations (intent, description, capabilities)
GET  /api/v1/duplicates           # Find duplicate tools
GET  /api/v1/categories           # List all categories
```

**Tool Management**:
```
GET  /api/v1/tools                # List tools (optional: category filter)
POST /api/v1/tools                # Register new tool (requires auth)
GET  /api/v1/tools/{toolId}       # Get specific tool
```

**ChittyChat Integration**:
```
POST /api/v1/chittychat/recommendations        # Get session-aware recommendations
POST /api/v1/chittychat/prevent-duplication    # Check for existing tools
```

**Maintenance**:
```
POST /api/v1/sync                 # Trigger registry scan (requires auth)
```

### Authentication
- **Read Operations**: No authentication required
- **Write Operations**: Requires `Authorization` or `X-ChittyID-Token` header containing "chitty"
- Future: Full ChittyID integration with token validation

---

## Configuration

### Environment Variables (wrangler.toml)
```toml
SERVICE_NAME = "chittyregistry-universal"
SERVICE_VERSION = "2.0.0"
CHITTYOS_ENVIRONMENT = "production"
REGISTRY_BASE_PATH = "/Users/nb/.claude/projects/-"
CHITTYCHAT_INTEGRATION = "enabled"
```

### KV Namespaces
- **REGISTRY_CACHE**: `58649f33726646d8b8c44befd4140947`
- **REGISTRY_STORE**: `b4518a6db20640ea990099f6e8497771`

### Cloudflare Account
- **Account ID**: `0bc21e3a5a9de1a4cc843be9c3e98121`
- **Production Route**: `registry.chitty.cc/*` on zone `chitty.cc`

---

## Development Workflow

### Making Changes
```bash
# 1. Modify source files in src/
# 2. Test locally
npm run dev

# 3. Validate configuration
npm run validate

# 4. Deploy to staging first
npm run deploy:staging

# 5. Test staging deployment
curl https://chittyregistry-staging.chitty.workers.dev/health

# 6. Deploy to production
npm run deploy:production
```

### Adding New Endpoints
1. Add route handler in `src/universal-registry-worker.js`
2. Follow existing patterns (CORS, auth checks, error handling)
3. Return `jsonResponse()` with proper status codes
4. Test with `npm run dev`

### Working with KV Storage
```javascript
// Reading from KV
const value = await env.REGISTRY_STORE.get(key);
const parsed = JSON.parse(value);

// Writing to KV
await env.REGISTRY_STORE.put(key, JSON.stringify(data));

// Listing keys
const list = await env.REGISTRY_STORE.list({ prefix: 'tools:' });
```

---

## Integration with ChittyOS Ecosystem

### ChittyID Integration
- Currently basic token check (contains "chitty")
- Future: Full validation against `https://id.chitty.cc`
- Required for write operations (POST, PUT, DELETE)

### ChittyChat Integration
- Provides AI-driven tool recommendations
- Prevents duplicate tool creation
- Session-aware context understanding

### Registry Base Path
- Points to local ChittyOS projects: `/Users/nb/.claude/projects/-`
- Used for scanning local tools/scripts during sync

---

## Key Implementation Details

### CORS Configuration
All responses include CORS headers:
```javascript
{
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-ChittyID-Token",
  "Access-Control-Max-Age": "86400"
}
```

### Error Handling
- Returns JSON responses with `{ error, code }` structure
- HTTP status codes: 200 (success), 201 (created), 400 (bad request), 401 (unauthorized), 404 (not found), 500 (server error)
- All errors include CORS headers

### Helper Functions
Expected utility functions (implement as needed):
- `getRegistryStats(env)` - Aggregate statistics
- `searchRegistry(env, { query, category, capability, limit })` - Search implementation
- `getIntelligentRecommendations(env, context)` - AI recommendations
- `getDuplicates(env)` - Duplicate detection
- `getCategories(env)` - List categories
- `getTools(env, category)` / `getTool(env, id)` - Tool retrieval
- `registerTool(env, toolData)` - Tool registration
- `getChittyChatRecommendations(env, context)` - ChittyChat integration
- `triggerRegistryScan(env)` - Registry sync

---

## File Structure

```
chittyregistry/
├── src/
│   ├── universal-registry-worker.js    # Primary worker (v2.0.0)
│   ├── worker.js                       # Legacy worker (v1.0.0)
│   └── registry-certificate-integration.js  # Certificate handling
├── dist/                               # Compiled output (TypeScript)
├── scripts/                            # Utility scripts
├── wrangler.toml                       # Cloudflare Workers config
├── package.json                        # Dependencies and scripts
├── .env.example                        # Environment template
└── CLAUDE.md                           # This file
```

---

## Deployment Environments

### Staging
- **Worker Name**: `chittyregistry-staging`
- **Variables**: `SERVICE_VERSION = "2.0.0-staging"`, `CHITTYOS_ENVIRONMENT = "staging"`
- **KV**: Same namespaces as production (shared state)

### Production
- **Worker Name**: `chittyregistry-production`
- **Domain**: `registry.chitty.cc`
- **Route Pattern**: `registry.chitty.cc/*` on zone `chitty.cc`
- **Variables**: `SERVICE_VERSION = "2.0.0"`, `CHITTYOS_ENVIRONMENT = "production"`

---

## Common Tasks

### View Registry Statistics
```bash
curl https://registry.chitty.cc/api/v1/stats
```

### Search for Tools
```bash
curl "https://registry.chitty.cc/api/v1/search?q=email&limit=5"
```

### Register New Tool (requires auth)
```bash
curl -X POST https://registry.chitty.cc/api/v1/tools \
  -H "Authorization: Bearer chitty-token-here" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-tool","category":"utility","capabilities":["file-processing"]}'
```

### Check for Duplicates Before Creating
```bash
curl -X POST https://registry.chitty.cc/api/v1/chittychat/prevent-duplication \
  -H "Content-Type: application/json" \
  -d '{"description":"email routing tool","capabilities":["email","routing"]}'
```

---

## Troubleshooting

### Worker Not Responding
```bash
# Check deployment status
wrangler deployments list

# View recent logs
npm run tail

# Verify health
curl https://registry.chitty.cc/health
```

### KV Storage Issues
```bash
# List keys in namespace
wrangler kv:key list --binding REGISTRY_STORE --env production

# Get specific key
wrangler kv:key get "tools:example" --binding REGISTRY_STORE --env production

# Delete key if corrupted
wrangler kv:key delete "tools:example" --binding REGISTRY_STORE --env production
```

### Authentication Failures
- Ensure `Authorization` or `X-ChittyID-Token` header is present
- Token must contain "chitty" substring (basic validation)
- Write operations (POST, PUT, DELETE) require authentication

---

## Integration Notes

### Used by ChittyChat
ChittyChat queries this registry during AI sessions to:
- Recommend existing tools before creating new ones
- Prevent duplication across development sessions
- Provide context-aware suggestions

### Used by ChittyCheck
ChittyCheck validates that:
- Registry service is healthy and accessible
- Service metadata is correctly registered
- Health endpoint responds with expected format

### Used by ChittyRouter
ChittyRouter routes `registry.chitty.cc` requests to this worker

---

## Dependencies

### Runtime (Cloudflare Workers)
- No external dependencies in worker runtime
- Uses native Cloudflare Workers APIs (KV, fetch)

### Development
- `axios`, `cors`, `dotenv`, `express` (for local testing)
- `jsonwebtoken` (future ChittyID integration)
- `zod` (data validation)
- TypeScript tooling (optional, has compiled dist/)

---

## Notes

- **Primary Implementation**: Use `src/universal-registry-worker.js` for all new development
- **Legacy Worker**: `src/worker.js` maintained for backward compatibility
- **Authentication**: Currently basic; full ChittyID integration planned
- **Storage**: KV namespaces are shared between staging and production
- **CORS**: Fully open (`*`) for development; restrict in production if needed

---

**Document Version**: 1.0
**Created**: October 12, 2025
**ChittyRegistry Version**: 2.0.0
