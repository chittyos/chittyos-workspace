# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm start` - Start sync server in production mode
- `npm run dev` - Start server with file watching for development
- `npm run sync` - Perform one-time sync operation
- `npm run health` - Check system health status

### Testing Commands
- `npm test` - Run all test suites
- `npm run test:fast` - Run tests in parallel, skip performance tests
- `npm run test:ci` - Run tests for CI/CD (fail-fast mode)
- `npm run test:qa` - Run QA functional tests only
- `npm run test:security` - Run security validation tests
- `npm run test:integration` - Run integration tests
- `npm run test:perf` - Run performance tests
- `npm run test:pentest` - Run penetration tests

### ChittyChat Integration
- `npm run chittychat` - Sync ChittyChat data to Notion
- `npm run chittychat:dry` - Dry run of ChittyChat sync
- `npm run chittychat:cli` - Access ChittyChat CLI interface
- `npm run chittychat:health` - Check ChittyChat integration health
- `npm run chittychat:list` - List ChittyChat projects
- `npm run chittychat:status` - Show ChittyChat sync status

### Schema Management
- `npm run schema:info` - Display current schema information
- `npm run schema:validate` - Validate schema against Notion
- `npm run schema:update` - Check for schema updates

### Setup and Diagnostics
- `npm run setup-db` - Initialize database configuration
- `npm run diagnostic` - Run system diagnostics
- `npm run example` - Run example sync operation

## Architecture Overview

This is a hardened Notion sync system that transforms ChittyChat sessions and legal evidence into structured AtomicFacts in Notion databases.

### Core Components

**Main Entry Point**: `index.js`
- Provides both CLI interface and HTTP server
- Routes commands to appropriate modules
- Handles ChittyChat integration commands

**Sync Engine**: `sync-worker.js`
- Core NotionSyncWorker class handles all Notion API operations
- Implements retry logic, rate limiting, and error handling
- Manages upsert operations and database synchronization

**ChittyChat Integration**: `chittychat-bridge.js`
- ChittyChatTransformer class converts sessions/projects to AtomicFacts
- Bridges ChittyChat data sources with Notion sync pipeline
- Handles session detection and project mapping

**Schema Management**:
- `schema-validator.js` - Validates and transforms data for Notion
- `notion-sync-config.js` - Defines field mappings and database configurations
- `chitty-schema-loader.js` - Manages versioned schema system

### Data Flow Architecture

1. **Data Sources**: ChittyChat sessions (`/Users/nb/.chittychat/`) or manual AtomicFacts
2. **Transformation**: Data converted to standardized AtomicFacts format
3. **Validation**: Schema validation ensures Notion compatibility
4. **Sync Pipeline**: Hardened sync with retry logic, rate limiting, DLQ handling
5. **Notion Storage**: Data stored in ChittyLedger database with evidence tracking

### Database Configuration

The system uses two main Notion databases:
- **ChittyLedger** (`NOTION_DATABASE_ID_CHITTYLEDGER`) - Main facts database with evidence fields
- **Evidence** (`NOTION_DATABASE_ID_EVIDENCE`) - Supporting evidence database (optional)

Both use the same database ID in the current unified approach where evidence fields are directly in ChittyLedger.

### Testing Infrastructure

Comprehensive test suite includes:
- **QA Functional Tests** (`test/qa-test-suite.js`) - Core functionality validation
- **Security Tests** (`test/security-validation.js`) - Security and input validation
- **Integration Tests** - End-to-end workflow testing
- **Performance Tests** - Load and performance validation
- **Penetration Tests** - Security vulnerability assessment

Tests can be run individually or in parallel with configurable timeouts and failure modes.

## Environment Configuration

Required environment variables in `.env`:
- `NOTION_INTEGRATION_TOKEN` - Notion API token
- `NOTION_DATABASE_ID_CHITTYLEDGER` - Main ChittyLedger database ID
- `PORT` - HTTP server port (default: 3000)
- `LOG_LEVEL` - Logging level (debug, info, warn, error)

## ChittyChat Integration

The system automatically detects ChittyChat installations at `/Users/nb/.chittychat/` and can sync:
- Session data from `sessions/unified-index.json`
- Project-topic synthesis from `project-topic-synthesis.json`
- Integration status from `claude_sync_status.json`

ChittyChat data is transformed into AtomicFacts with proper evidence classification and source attribution.

## Key Files for Modification

- **Field Mappings**: Modify `notion-sync-config.js` for database field mappings
- **Schema Changes**: Update `schema-validator.js` for data validation rules
- **ChittyChat Logic**: Modify `chittychat-bridge.js` for session/project transformation
- **Sync Behavior**: Update `sync-worker.js` for retry logic and rate limiting
- **New Commands**: Add CLI commands in `index.js` main switch statement