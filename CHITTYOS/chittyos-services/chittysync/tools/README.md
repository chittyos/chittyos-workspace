# ChittySync Universal Orchestration Hub

**ChittySync Tools** - Comprehensive platform integration and automation framework for the entire ChittyOS ecosystem.

**Location**: `/Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittysync/tools`
**Version**: 2.0.0
**Updated**: 2025-10-19

---

## Overview

ChittySync Tools provides a **universal orchestration layer** that syncs, deploys, and manages integrations across:

- **Google Workspace** (Gmail, Chat, Calendar, Sheets)
- **Cloudflare** (Workers, KV, D1, R2, DNS)
- **Neon** (Postgres databases, schemas, backups)
- **GitHub** (Issues, PRs, Actions, Releases)
- **MCP** (Model Context Protocol servers and tools)
- **Documentation** (Markdown, Notion, auto-generated READMEs)

---

## Architecture

```
chittysync/
├── tools/
│   ├── integrations/          # Platform-specific sync modules
│   │   ├── google/           # Google Workspace integration
│   │   ├── cloudflare/       # Cloudflare Workers & services
│   │   ├── neon/             # Neon database management
│   │   ├── github/           # GitHub automation
│   │   ├── mcp/              # MCP server orchestration
│   │   └── docs/             # Documentation sync
│   │
│   ├── workflows/            # Cloudflare Workers orchestration
│   │   ├── sync-orchestrator.js      # Master coordinator
│   │   ├── health-monitor.js         # Service health checks
│   │   ├── deployment-manager.js     # Batch deployments
│   │   └── alert-router.js           # Unified alerting
│   │
│   ├── cli/                  # Unified command interface
│   │   ├── chittysync.js             # Main CLI
│   │   └── commands/                 # Command handlers
│   │
│   ├── session/              # Session management
│   │   └── generate-session-metadata.sh
│   │
│   └── legacy/               # Deprecated tools (archived)
│
├── worker/                   # ChittySync Hub API
│   └── src/integrations/     # Worker integration handlers
│
└── package.json              # Root orchestration scripts
```

---

## Quick Start

### CLI Installation

```bash
# Install globally
cd tools/cli
npm install
npm link

# Verify installation
chittysync --version
```

### Basic Usage

```bash
# Sync everything
chittysync sync --all

# Sync specific platforms
chittysync sync google cloudflare neon

# Deploy all workers
chittysync deploy --batch

# Check service status
chittysync status --verbose

# Configure credentials
chittysync config set GOOGLE_API_KEY=xxx
```

---

## Integration Modules

### 1. Google Workspace (`integrations/google/`)

**gmail-sync.js** - Email alerts and todo notifications
- Parse emails → Create todos
- Send todo completion alerts
- SLA deadline reminders

**chat-webhook.js** - Google Chat notifications
- Post todo updates to Chat spaces
- Alert on deployment failures
- Service health notifications

**calendar-sync.js** - Calendar integration
- Create events from todos with deadlines
- SLA reminder events
- Meeting agenda sync

**sheets-logger.js** - Incident logging
- Log service incidents to Sheets
- Track deployment history
- Generate status reports

**Usage**:
```bash
# Import module
const { GmailSync } = require('./integrations/google/gmail-sync');

// Sync todos from emails
const sync = new GmailSync({ apiKey: process.env.GOOGLE_API_KEY });
await sync.fetchTodos({ label: 'todos', unreadOnly: true });
```

### 2. Cloudflare (`integrations/cloudflare/`)

**worker-deployer.js** - Batch deploy workers
- Deploy all ChittyOS workers at once
- Rollback on failure
- Blue-green deployments

**kv-sync.js** - KV namespace synchronization
- Sync KV data across environments
- Backup/restore KV namespaces
- Bulk key operations

**d1-migrator.js** - Database migrations
- Run migrations across all D1 databases
- Schema version tracking
- Rollback support

**r2-backup.js** - Object storage sync
- Backup R2 buckets
- Cross-region replication
- Disaster recovery

**dns-manager.js** - DNS record management
- Bulk DNS updates
- CNAME flattening
- SSL certificate renewal

**Usage**:
```bash
# Deploy all workers
const { WorkerDeployer } = require('./integrations/cloudflare/worker-deployer');
const deployer = new WorkerDeployer({ accountId: '...', apiToken: '...' });
await deployer.deployAll({ environment: 'production' });
```

### 3. Neon (`integrations/neon/`)

**database-sync.js** - Postgres synchronization
- Sync schema across databases
- Data replication
- Connection pooling

**schema-deployer.js** - Schema migrations
- Deploy schema changes
- Validate migrations
- Rollback support

**backup-manager.js** - Database backups
- Automated backups
- Point-in-time recovery
- Cross-region backups

**Usage**:
```bash
# Run schema migration
const { SchemaDeployer } = require('./integrations/neon/schema-deployer');
const deployer = new SchemaDeployer({ connectionString: '...' });
await deployer.migrate({ file: './migrations/001_init.sql' });
```

### 4. GitHub (`integrations/github/`)

**issue-sync.js** - Issues → Todos synchronization
- Import GitHub issues as todos
- Update issue status from todos
- Label-based filtering

**pr-metadata.js** - Pull request automation
- Auto-label PRs
- Generate PR descriptions
- Link PRs to todos

**actions-trigger.js** - Workflow dispatch
- Trigger GitHub Actions
- Monitor workflow status
- Parallel workflow execution

**release-publisher.js** - Release management
- Create releases from tags
- Generate changelogs
- Publish release notes

**Usage**:
```bash
# Sync issues to todos
const { IssueSync } = require('./integrations/github/issue-sync');
const sync = new IssueSync({ repo: 'chittyos/chittyos', token: '...' });
await sync.importIssues({ labels: ['todo', 'bug'] });
```

### 5. MCP (`integrations/mcp/`)

**server-registry.js** - MCP server catalog
- Register MCP servers
- Version tracking
- Health monitoring

**context-sync.js** - Cross-agent context sharing
- Sync context between Claude Code, Desktop, ChatGPT
- Session state management
- Memory persistence

**tool-deployer.js** - MCP tool updates
- Deploy MCP tool updates
- Version management
- Rollback support

**Usage**:
```bash
# Register MCP server
const { ServerRegistry } = require('./integrations/mcp/server-registry');
const registry = new ServerRegistry({ endpoint: 'https://registry.chitty.cc' });
await registry.register({ name: 'chittyid', version: '2.1.0', url: '...' });
```

### 6. Documentation (`integrations/docs/`)

**markdown-sync.js** - Document propagation
- Sync CLAUDE.md across services
- Update documentation versions
- Generate cross-references

**notion-bridge.js** - Notion integration
- Sync Notion pages to Markdown
- Update Notion from Git
- Bi-directional sync

**readme-generator.js** - Auto-generate READMEs
- Generate READMEs from code
- Extract API documentation
- Update package descriptions

**Usage**:
```bash
# Sync CLAUDE.md files
const { MarkdownSync } = require('./integrations/docs/markdown-sync');
const sync = new MarkdownSync({ baseDir: '/Users/nb/.claude/projects/-' });
await sync.propagate({ file: 'CLAUDE.md', pattern: '**/CLAUDE.md' });
```

---

## Workflow Orchestration

### Cloudflare Workers (`workflows/`)

The orchestration layer runs as Cloudflare Workers, providing:
- **24/7 availability**
- **Global edge deployment**
- **Durable Object coordination**
- **Automatic scaling**

### sync-orchestrator.js

**Master coordinator** using Durable Objects to manage all syncs.

```javascript
// Durable Object that coordinates syncs
export class SyncOrchestrator {
  async sync(platforms = ['all']) {
    const results = await Promise.allSettled([
      this.syncGoogle(),
      this.syncCloudflare(),
      this.syncNeon(),
      this.syncGitHub(),
      this.syncMCP(),
      this.syncDocs()
    ]);
    return { synced: results.filter(r => r.status === 'fulfilled').length };
  }
}
```

**API**:
```bash
# Trigger sync
POST https://gateway.chitty.cc/api/sync/orchestrate
Body: {"platforms": ["google", "cloudflare"]}

# Get sync status
GET https://gateway.chitty.cc/api/sync/status
```

### health-monitor.js

**Continuous service monitoring** with alerting.

```javascript
export class HealthMonitor {
  async checkAll() {
    const services = [
      'id.chitty.cc',
      'gateway.chitty.cc',
      'registry.chitty.cc',
      // ... all ChittyOS services
    ];

    const results = await Promise.all(
      services.map(s => this.checkService(s))
    );

    // Alert on failures
    const failures = results.filter(r => !r.healthy);
    if (failures.length > 0) {
      await this.alert(failures);
    }
  }
}
```

**API**:
```bash
# Get health status
GET https://gateway.chitty.cc/api/health/all

# Get specific service
GET https://gateway.chitty.cc/api/health/id.chitty.cc
```

### deployment-manager.js

**Batch deployment** for all ChittyOS workers.

```javascript
export class DeploymentManager {
  async deployAll({ environment = 'production' }) {
    const workers = [
      'chittychat',
      'chittyrouter',
      'chittyauth',
      'chittyregistry',
      'chittyid',
      // ... all workers
    ];

    // Blue-green deployment
    for (const worker of workers) {
      await this.deployWorker(worker, { environment, strategy: 'blue-green' });
    }
  }
}
```

**API**:
```bash
# Deploy all workers
POST https://gateway.chitty.cc/api/deploy/batch
Body: {"environment": "production", "strategy": "blue-green"}

# Deploy specific workers
POST https://gateway.chitty.cc/api/deploy/workers
Body: {"workers": ["chittychat", "chittyrouter"]}
```

### alert-router.js

**Unified alerting** across Google Chat, Email, Slack, SMS.

```javascript
export class AlertRouter {
  async alert({ severity, message, channels = ['all'] }) {
    const promises = [];

    if (channels.includes('all') || channels.includes('chat')) {
      promises.push(this.sendGoogleChat(message));
    }

    if (channels.includes('all') || channels.includes('email')) {
      promises.push(this.sendEmail(message));
    }

    await Promise.all(promises);
  }
}
```

**API**:
```bash
# Send alert
POST https://gateway.chitty.cc/api/alerts/send
Body: {
  "severity": "critical",
  "message": "ChittyID service down",
  "channels": ["chat", "email"]
}
```

---

## CLI Reference

### Installation

```bash
cd tools/cli
npm install
npm link
```

### Commands

**chittysync sync [platforms...]**
```bash
# Sync all platforms
chittysync sync --all

# Sync specific platforms
chittysync sync google cloudflare

# Dry run
chittysync sync --dry-run
```

**chittysync deploy [services...]**
```bash
# Deploy all workers
chittysync deploy --batch

# Deploy specific services
chittysync deploy chittychat chittyrouter

# Blue-green deployment
chittysync deploy --strategy blue-green
```

**chittysync status**
```bash
# Check all services
chittysync status

# Verbose output
chittysync status --verbose

# Watch mode
chittysync status --watch
```

**chittysync config**
```bash
# Set config value
chittysync config set GOOGLE_API_KEY=xxx

# Get config value
chittysync config get GOOGLE_API_KEY

# List all config
chittysync config list
```

**chittysync health**
```bash
# Check health of all services
chittysync health

# Check specific service
chittysync health id.chitty.cc
```

---

## Worker Integration Handlers

### API Endpoints (`worker/src/integrations/`)

Each platform has dedicated API endpoints in the ChittySync worker:

**Google** (`/api/integrations/google/*`)
- `POST /api/integrations/google/sync` - Sync Gmail, Calendar, Sheets
- `POST /api/integrations/google/alert` - Send Google Chat alert
- `GET /api/integrations/google/status` - Integration status

**Cloudflare** (`/api/integrations/cloudflare/*`)
- `POST /api/integrations/cloudflare/deploy` - Deploy workers
- `GET /api/integrations/cloudflare/workers` - List all workers
- `POST /api/integrations/cloudflare/kv/sync` - Sync KV namespace

**Neon** (`/api/integrations/neon/*`)
- `POST /api/integrations/neon/migrate` - Run migrations
- `POST /api/integrations/neon/backup` - Create backup
- `GET /api/integrations/neon/status` - Database status

**GitHub** (`/api/integrations/github/*`)
- `POST /api/integrations/github/issues/sync` - Sync issues
- `POST /api/integrations/github/webhooks` - Webhook handler
- `POST /api/integrations/github/actions/trigger` - Trigger workflow

**MCP** (`/api/integrations/mcp/*`)
- `POST /api/integrations/mcp/servers/register` - Register server
- `GET /api/integrations/mcp/servers` - List servers
- `POST /api/integrations/mcp/context/sync` - Sync context

---

## Configuration

### Environment Variables

Required for CLI and workflows:

```bash
# Google Workspace
GOOGLE_API_KEY=xxx
GOOGLE_CHAT_WEBHOOK=https://chat.googleapis.com/v1/spaces/...

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=bbf9fcd845e78035b7a135c481e88541
CLOUDFLARE_API_TOKEN=xxx

# Neon
NEON_API_KEY=xxx
NEON_PROJECT_ID=xxx

# GitHub
GITHUB_TOKEN=ghp_xxx
GITHUB_REPO=chittyos/chittyos

# MCP
MCP_REGISTRY_URL=https://registry.chitty.cc

# ChittyID (REQUIRED)
CHITTY_ID_TOKEN=mcp_auth_9b69455f5f799a73f16484eb268aea50
```

### Config File

**~/.chittysync/config.json**:
```json
{
  "platforms": {
    "google": {
      "enabled": true,
      "apiKey": "xxx",
      "chatWebhook": "https://..."
    },
    "cloudflare": {
      "enabled": true,
      "accountId": "bbf9fcd845e78035b7a135c481e88541",
      "apiToken": "xxx"
    },
    "neon": {
      "enabled": true,
      "apiKey": "xxx",
      "projectId": "xxx"
    },
    "github": {
      "enabled": true,
      "token": "ghp_xxx",
      "repo": "chittyos/chittyos"
    },
    "mcp": {
      "enabled": true,
      "registryUrl": "https://registry.chitty.cc"
    }
  },
  "defaults": {
    "syncInterval": 300000,
    "alertChannels": ["chat", "email"],
    "deployStrategy": "blue-green"
  }
}
```

---

## Session Management

### generate-session-metadata.sh

**Git worktree-aware session lifecycle management**.

Located in `tools/session/`.

**Features**:
- Generates session metadata for ChittySync
- Detects git worktree sessions
- Creates session branches
- Auto-registers with ChittySync Hub

**Usage**:
```bash
cd /Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittychat
../../../tools/session/generate-session-metadata.sh

# Output:
# {
#   "session_id": "session-abc123",
#   "project_id": "chittychat-def456",
#   "git_branch": "session-abc123",
#   "project_path": "/Users/nb/.../chittychat"
# }
```

---

## Legacy Tools

### Archived in `tools/legacy/`

**44 deprecated Notion sync files** have been moved to `tools/legacy/notion-sync/`.

**DO NOT USE** - superseded by `integrations/docs/notion-bridge.js`.

---

## Development

### Adding New Integration

1. Create integration module:
```bash
cd integrations/new-platform
touch sync.js
```

2. Implement standard interface:
```javascript
export class NewPlatformSync {
  async sync() { /* ... */ }
  async push(data) { /* ... */ }
  async pull() { /* ... */ }
  async status() { /* ... */ }
}
```

3. Add CLI command:
```bash
cd cli/commands
touch new-platform.js
```

4. Add worker handler:
```bash
cd worker/src/integrations
touch new-platform.ts
```

5. Update documentation:
```bash
# Add to this README.md
```

### Testing

```bash
# Test integration module
cd integrations/google
npm test

# Test CLI
cd cli
npm test

# Test workflow
cd workflows
wrangler dev
```

---

## Architecture Principles

### 1. Standardized Interfaces

Every integration implements:
- `sync()` - Bi-directional sync
- `push(data)` - Push to platform
- `pull()` - Pull from platform
- `status()` - Health check

### 2. Cloudflare Workers-First

All orchestration runs as Workers:
- **Global edge deployment**
- **Automatic scaling**
- **Durable Objects for state**
- **Zero cold starts**

### 3. ChittyID Authority

ALL IDs minted from `id.chitty.cc` - NO local generation.

### 4. Unified Alerting

All alerts route through `alert-router.js`:
- Google Chat
- Email
- Slack
- SMS

### 5. Configuration Management

Credentials stored in:
1. **Wrangler secrets** (production)
2. **~/.chittysync/config.json** (local CLI)
3. **Environment variables** (CI/CD)

---

## Deployment

### Deploy Workflows

```bash
cd workflows
npm install
npm run deploy
```

### Deploy CLI

```bash
cd cli
npm install
npm link
```

### Update Worker Handlers

```bash
cd worker
npm install
npm run deploy
```

---

## Roadmap

### Phase 1: Core Integrations ✅
- Google Workspace
- Cloudflare Workers
- Neon databases
- GitHub automation

### Phase 2: MCP & Docs (In Progress)
- MCP server registry
- Context sync
- Documentation propagation

### Phase 3: Advanced Orchestration
- Real-time sync (WebSockets)
- Conflict resolution UI
- Advanced deployment strategies
- Multi-region orchestration

### Phase 4: Analytics & Monitoring
- Usage analytics
- Performance monitoring
- Cost optimization
- SLA tracking

---

## Support

### Commands
- `chittysync help` - CLI help
- `chittysync docs` - Open documentation
- `chittysync version` - Version info

### Documentation
- **Integration Guides**: `integrations/*/README.md`
- **Workflow Docs**: `workflows/README.md`
- **CLI Reference**: `cli/README.md`

### Issues
- GitHub: https://github.com/chittyos/chittysync/issues
- ChittyOS Docs: https://docs.chitty.cc

---

**Version**: 2.0.0
**Updated**: 2025-10-19
**ChittyOS Framework**: v1.0.1
**Service**: ChittySync Hub
