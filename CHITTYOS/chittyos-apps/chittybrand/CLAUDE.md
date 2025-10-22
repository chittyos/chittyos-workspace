# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChittyCLI is a unified command-line interface for the ChittyOS enterprise evidence management ecosystem. It combines multiple specialized tools into a single CLI: brand management, evidence processing, AI analysis, Cloudflare infrastructure, blockchain integration, and data orchestration.

## Architecture

### Core Components

1. **ChittyCLI Main (`chitty.js`)** - Primary unified CLI interface with enterprise evidence management
2. **Brand Management System** - Complete brand compliance and asset management tools
3. **Cloudflare Infrastructure** - Advanced edge computing services and CDN management
4. **Universal Router** - Central routing layer for all ChittyOS services
5. **Data Orchestration** - PostgreSQL, blockchain, and multi-service data management
6. **Session Management** - Cross-session synchronization and state management

### Key Integration Points

- **API Base**: `https://api.chittyos.com` (configurable via `CHITTY_API_BASE`)
- **Brand CDN**: `https://brand.chittyos.com`
- **Schema API**: `https://schema.chitty.cc/api`
- **Cloudflare Workers**: Multiple workers for CDN, sync, infrastructure
- **Neon PostgreSQL**: Primary database with blockchain anchoring
- **WebSocket**: Real-time brand updates and monitoring

## Commands

### Primary CLI (`chitty` or `ccli`)
```bash
npm install                    # Install dependencies
npm run cli                    # Run CLI with --yes flag
npm run test                   # Run smoke tests
npm run test:smoke             # Test CLI help command
chmod +x chitty.js            # Make executable (if needed)

# CLI Operations
node chitty.js --help --yes    # Show help without interactive prompts
node chitty.js evidence upload <file> <chittyid>  # Upload evidence
node chitty.js ai analyze <chittyid>              # AI analysis
node chitty.js blockchain verify <chittyid>       # Blockchain verification
```

### Brand Management
```bash
# Brand CLI (standalone)
./brand-cli-tool.js scan --output compliance.json     # Scan ecosystem compliance
./brand-cli-tool.js enforce --programs chittychat     # Enforce brand standards
./brand-cli-tool.js generate --entity PEO --deploy    # Generate entity branding
./brand-cli-tool.js validate --program chittycases    # Validate program compliance
./brand-cli-tool.js deploy                            # Deploy assets to CDN
./brand-cli-tool.js monitor --watch                   # Real-time monitoring
```

### Cloudflare Deployment
```bash
./deploy-cdn.sh               # Deploy brand CDN to Cloudflare
wrangler deploy --env staging # Deploy to staging environment
wrangler deploy --env production # Deploy to production
```

### Session Management
```bash
./session-sync.mjs            # Cross-session synchronization
```

## Development Workflow

### Brand System Integration
The brand system automatically syncs with `schema.chitty.cc` to generate entity-specific branding:
- **PEO** (People): Blue theme, user icons
- **PLACE** (Places): Green theme, location markers
- **PROP** (Properties): Purple theme, asset indicators
- **EVNT** (Events): Orange theme, timeline elements
- **AUTH** (Authorities): Red theme, legal symbols

### Entity-Based Architecture
All services understand ChittyID format: `CHITTY-{ENTITY}-{SEQUENCE}-{CHECKSUM}`
- Automatic entity type detection from ChittyIDs
- Dynamic branding based on entity type
- Blockchain anchoring with entity-specific validation

### Cross-Service Communication
- Universal router handles service discovery and routing
- WebSocket connections for real-time updates
- Shared authentication via Bearer tokens
- Standardized error handling and logging

## Configuration

### Environment Variables
```bash
CHITTY_API_KEY=your_api_key          # API authentication
CHITTY_API_BASE=https://api.chittyos.com  # API base URL
NOTION_API_TOKEN=notion_token        # Notion integration
CLOUDFLARE_API_TOKEN=cf_token        # Cloudflare access
DATABASE_URL=postgresql://...        # Neon PostgreSQL
DEBUG=1                              # Enable debug logging
```

### Cloudflare Configuration
- Workers deployed to multiple environments (staging/production)
- KV namespaces for caching and state management
- R2 buckets for asset storage and evidence files
- Custom domains: `brand.chittyos.com`, `api.chittyos.com`

## File Structure

### Core Files
- `chitty.js` - Main unified CLI (executable)
- `package.json` - Primary package configuration
- `brand-cli-tool.js` - Brand management CLI
- `universal-unified-router.js` - Central routing system
- `cloudflare-worker-cdn.js` - Brand CDN worker
- `schema-sync-worker.js` - Real-time schema synchronization

### Infrastructure
- `cloudflare-infrastructure.js` - Advanced Cloudflare services
- `neon-postgresql-integration.js` - Database operations
- `chittychain-blockchain-interface.js` - Blockchain integration
- `unified-data-orchestration.js` - Multi-service data management

### Deployment
- `deploy-cdn.sh` - Cloudflare deployment script
- `wrangler.toml` - Cloudflare Workers configuration
- `.github/workflows/ci.yml` - CI/CD pipeline

## Testing

The project uses a smoke testing approach focusing on CLI functionality:
- Tests run on Node.js LTS versions (18.x, 20.x, 22.x)
- Primary test: CLI help command execution
- Verification of executable permissions
- Detection of conflicting CLI files

## Brand Compliance

The system enforces brand compliance across all ChittyOS programs:
- Real-time brand token synchronization
- Automatic asset generation for new entity types
- WebSocket-based update propagation
- Compliance scoring and reporting