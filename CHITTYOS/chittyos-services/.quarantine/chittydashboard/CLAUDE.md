# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is the ChittyOS Dashboard - a unified web-based control center for the ChittyOS Framework ecosystem. It provides real-time monitoring, session synchronization, evidence management, and AI workflow coordination across multiple platforms (Claude, GPT, Gemini).

### Core Components

1. **Dashboard Frontend** (`index.html`) - Glassmorphic web interface with real-time metrics and system monitoring
2. **Data Service API** (`data-service.js`) - REST API server providing system status, evidence data, and metrics
3. **Session Sync Engine** (`session-sync.js`) - Cross-platform AI session state synchronization via WebSocket
4. **Notion Integration** (`notion-sync-hardened.js`) - Bidirectional sync with Notion databases for data persistence
5. **Cloudflare Workers** (`src/workers-ai-autorag.js`) - Edge-deployed AI service with RAG capabilities
6. **Service Registry** - Dynamic service discovery and health monitoring system

### Architecture Patterns

**Multi-Platform Session Sync**: The system maintains session continuity across Claude, GPT, and Gemini by synchronizing conversation state, context, and evidence through WebSocket connections and KV storage.

**Evidence-Driven System**: All operations generate structured evidence files that feed into ChittyOS's blockchain validation system and cross-session recovery mechanisms.

**Edge-First Deployment**: Primary deployment target is Cloudflare (Pages + Workers + KV) with local development fallbacks.

**Service-Oriented Design**: Modular services communicate via REST APIs and WebSocket connections, allowing independent scaling and deployment.

## Development Commands

### Local Development

```bash
# Start the full dashboard stack
npm start                    # Runs start-dashboard.sh

# Individual services
npm run data                 # Start data service API (port 3001)
npm run session-sync         # Start session sync service (port 3003)
npm run notion-sync          # Start Notion sync service (port 3002)
npm run registry             # Open service registry dashboard

# Service registration
npm run register-services    # Register all services with discovery
npm run register-workers     # Register Cloudflare Workers
```

### Cloudflare Deployment

```bash
# Deploy to Cloudflare
./deploy-cloudflare.sh       # Full deployment (Pages + Workers)
NODE_OPTIONS="" wrangler deploy              # Deploy Workers only
NODE_OPTIONS="" wrangler deploy --env production    # Production deployment

# KV namespace setup
./setup-kv-namespaces.sh     # Create/configure KV stores
```

### Testing & Validation

```bash
npm test                     # Run test suite (currently placeholder)
NODE_OPTIONS="" npm run build             # Validate deployment configuration

# Manual API testing
curl http://localhost:3001/api/status      # Data service health
curl http://localhost:3003/health          # Session sync health
```

## Environment Configuration

The system uses a comprehensive `.env` file for configuration. Copy `.env.example` to `.env` and configure:

**Required for Local Development**:
- `NODE_ENV` - Environment (development/production)
- `DATA_SERVICE_PORT` - API server port (default: 3001)
- Evidence paths for ChittyOS integration

**Required for Cloudflare Deployment**:
- `CLOUDFLARE_*` variables for KV/Workers configuration
- Domain settings for dashboard.chitty.cc routing

**Optional Integrations**:
- `NOTION_TOKEN` - For Notion database sync
- `REDIS_URL` - For distributed session storage
- Monitoring and alerting configurations

## Service Integration Points

### Data Service API (`localhost:3001`)
- `/api/status` - System health and evidence counts
- `/api/evidence` - Evidence file management
- `/api/activity` - System activity logs
- `/api/metrics` - Performance metrics
- `/api/ai-sessions` - AI session data

### Session Sync (`localhost:3003`)
- WebSocket endpoint for real-time session synchronization
- REST endpoints for session management and recovery
- Cross-platform state persistence

### Cloudflare Edge Services
- `dashboard.chitty.cc` - Production dashboard deployment
- `registry.chitty.cc` - Service registry and discovery
- Workers AI integration for RAG and embeddings

## File Structure Patterns

**Service Scripts**: Executable JavaScript files (`data-service.js`, `session-sync.js`) that run as independent processes
**Deployment Scripts**: Bash scripts (`deploy-cloudflare.sh`, `start-dashboard.sh`) for automation
**Configuration**: JSON files for service registry, session management, and OpenAPI specs
**Static Assets**: HTML dashboards with embedded JavaScript for real-time updates

## Development Workflow

1. **Local Setup**: Run `npm start` to launch the full development stack
2. **Service Development**: Individual services can be started independently for focused development
3. **Integration Testing**: Use the service registry dashboard to monitor cross-service communication
4. **Edge Deployment**: Deploy to Cloudflare using the provided deployment scripts
5. **Evidence Validation**: Check evidence collection in universal intake paths

## Key Dependencies

- **Express.js** - REST API framework
- **WebSocket (ws)** - Real-time session synchronization
- **@notionhq/client** - Notion database integration (optional)
- **Cloudflare Wrangler** - Edge deployment tooling

The system is designed for macOS integration with ChittyOS but can run cross-platform with configuration adjustments.