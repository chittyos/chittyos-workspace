# ChittyRegistry Universal System

**ChittyRegistry** is a universal tool and script registry for the ChittyOS ecosystem, providing service discovery, intelligent search, and AI-driven recommendations.

## Overview

ChittyRegistry serves as the central registry for:
- 🔍 **Service Discovery**: Universal tool/script registration and lookup
- 🤖 **AI Integration**: Intelligent recommendations powered by ChittyChat
- 🔗 **ChittyOS Services**: Health monitoring and service metadata
- 📊 **Analytics**: Registry statistics and insights
- 🔄 **Notion Sync**: Bidirectional synchronization with Notion databases

## Architecture

The registry consists of two primary components:

### 1. TypeScript Service (Port 3000)
Full-featured registry service with Express.js:
- REST API endpoints for discovery and registration
- Notion integration and webhooks
- Health monitoring and analytics
- Neon database backend
- Redis caching layer

### 2. Cloudflare Worker (registry.chitty.cc)
Edge-optimized registry for global access:
- Lightweight REST API
- Cloudflare KV storage
- ChittyChat integration
- Duplicate detection
- Multi-dimensional search

## Quick Start

### TypeScript Service

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Run development server
npm run dev

# Run tests
npm test
```

### Cloudflare Worker

```bash
# Development
npm run dev

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production

# Tail logs
npm run tail
```

## API Endpoints

### TypeScript Service (localhost:3000)

#### Discovery
- `GET /discovery` - Service discovery
- `GET /discovery/:serviceId` - Get specific service

#### Registration
- `POST /registration` - Register new service
- `PUT /registration/:serviceId` - Update service
- `DELETE /registration/:serviceId` - Remove service

#### Notion Integration
- `POST /notion/webhooks` - Notion webhook handler

### Cloudflare Worker (registry.chitty.cc)

#### Health & Stats
- `GET /health` - Health check
- `GET /api/v1/stats` - Registry statistics

#### Search & Discovery
- `GET /api/v1/search?q=...` - Search registry
- `GET /api/v1/recommendations` - Get intelligent recommendations
- `GET /api/v1/duplicates` - Find duplicate tools
- `GET /api/v1/categories` - List categories

#### Tool Management
- `GET /api/v1/tools` - List tools
- `POST /api/v1/tools` - Register tool (auth required)
- `GET /api/v1/tools/:id` - Get specific tool

#### ChittyChat Integration
- `POST /api/v1/chittychat/recommendations` - Session-aware recommendations
- `POST /api/v1/chittychat/prevent-duplication` - Duplicate prevention

## Configuration

### Environment Variables

```bash
# Service
PORT=3000
NODE_ENV=production

# ChittyID Integration
CHITTYID_URL=https://id.chitty.cc
CHITTYID_CLIENT_ID=chittyregistry
CHITTYID_CLIENT_SECRET=your_secret

# Redis
REDIS_URL=redis://localhost:6379

# Notion Integration
NOTION_TOKEN=your_notion_integration_token
CHITTYREGISTRY_NOTION_DB_ID=your_database_id

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

### Cloudflare Configuration

See `wrangler.jsonc` for Workers configuration:
- Account ID: `0bc21e3a5a9de1a4cc843be9c3e98121`
- KV Namespaces: `REGISTRY_CACHE`, `REGISTRY_STORE`
- Route: `registry.chitty.cc/*`

## Notion Integration

ChittyRegistry can sync with Notion databases for collaborative registry management:

### Setup
```bash
# Connect existing Notion database
npx ts-node scripts/connect-existing-notion-db.ts

# Run migration
npx ts-node scripts/notion-migration.ts

# Start sync daemon
npx ts-node scripts/notion-sync-daemon.ts
```

### Features
- Bidirectional sync (Notion ↔ Registry)
- Webhook-based real-time updates
- Field mapping and validation
- Conflict resolution

## Development

### Project Structure
```
chittyregistry/
├── src/
│   ├── config/           # Configuration
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   ├── middleware/       # Express middleware
│   ├── server.ts         # Main server
│   ├── universal-registry-worker.js  # Cloudflare Worker
│   └── worker.js         # Legacy worker
├── scripts/              # Utility scripts
│   ├── notion-migration.ts
│   ├── notion-sync-daemon.ts
│   └── connect-existing-notion-db.ts
├── packages/cli/         # CLI tool
├── .github/workflows/    # CI/CD pipelines
├── wrangler.jsonc        # Cloudflare config
└── package.json
```

### Running Tests
```bash
# Root tests
npm test

# CLI tests
cd packages/cli && npm test
```

### CI/CD

GitHub Actions workflows:
- **ci.yml**: Build, lint, test on PR/push
- **deploy-worker.yml**: Deploy Cloudflare Worker
- **test-sync-daemon.yml**: Test Notion sync

## Integration with ChittyOS

### ChittyID
All registry operations support ChittyID authentication:
```bash
curl -H "X-ChittyID-Token: your-token" \
  https://registry.chitty.cc/api/v1/tools
```

### ChittyChat
Registry provides AI-driven recommendations during development:
- Suggests existing tools before creating new ones
- Prevents duplicate implementations
- Contextual tool discovery

### ChittyRouter
ChittyRouter routes `registry.chitty.cc` requests to this worker.

## Deployment

### TypeScript Service
```bash
# Build
npm run build

# Deploy with PM2
pm2 start ecosystem.config.js

# Or use Docker
docker build -t chittyregistry .
docker run -p 3000:3000 chittyregistry
```

### Cloudflare Worker
```bash
# Deploy to production
npm run deploy:production

# Verify deployment
curl https://registry.chitty.cc/health
```

## Monitoring

### Health Checks
```bash
# TypeScript service
curl http://localhost:3000/discovery

# Cloudflare Worker
curl https://registry.chitty.cc/health
```

### Logs
```bash
# Worker logs
npm run tail

# Service logs
pm2 logs chittyregistry
```

## Documentation

- **CLAUDE.md**: AI assistant guide and development workflows
- **API Documentation**: See endpoints section above
- **Notion Integration**: See scripts/ directory

## Support

For issues, questions, or contributions:
- ChittyOS Ecosystem: https://chitty.cc
- Documentation: See CLAUDE.md
- GitHub Issues: Create an issue in this repository

## License

ChittyOS Framework - Internal Development

---

**Version**: 2.0.0
**Updated**: October 2025
**ChittyOS Services**: chittyos-services/chittyregistry
