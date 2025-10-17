# ChittyOS Framework - Core Context

**Load this file for all conversations. Extended docs loaded on-demand.**

---

## Critical Rules (NEVER violate)

### ChittyID Authority
**ALL ChittyIDs MUST be minted from `https://id.chitty.cc`**
- Service: `https://id.chitty.cc`
- Token: `CHITTY_ID_TOKEN` environment variable
- **NO local generation permitted** - ChittyCheck enforces this
- Format: `CHITTY-{ENTITY}-{SEQUENCE}-{CHECKSUM}`
- Entities: PEO, PLACE, PROP, EVNT, AUTH, INFO, FACT, CONTEXT, ACTOR

### Structure Preservation
- **DO NOT reorganize project structure**
- Read: [AI-ASSISTANTS.md](AI-ASSISTANTS.md), [STRUCTURE-LOCK.md](STRUCTURE-LOCK.md)
- Work within existing directories only

---

## Essential Slash Commands

Execute immediately with Bash tool when user types:

```bash
# Core Validation
/chittycheck    # /Users/nb/.claude/projects/-/chittycheck/chittycheck-enhanced.sh
/health         # ./chittychat/project-health-check.sh
/chittyid       # ./chittychat/chittyid-command.sh

# Project Management
/project        # bash -c 'source ./chittychat/project-orchestrator.sh && project'
/status         # ./chittychat/slash-commands-extended.sh status
/sync           # ./chittychat/slash-commands-extended.sh sync

# Development
/deploy         # ./chittychat/slash-commands-extended.sh deploy
/test           # ./chittychat/slash-commands-extended.sh test
/clean          # ./chittychat/slash-commands-extended.sh clean

# Registry
/registry       # ./chittychat/claude-registry-client.sh
```

**DO NOT describe. Just execute.**

---

## Default Output Style

**Use TOKEN-FRUGAL-MODULE-REFINE by default:**

```
[MODE:EDIT|WRITE] [TOK_EST:~X]

<tool_calls>
Result.
```

**Principles:**
- Surgical edits via Edit tool (not rewrites)
- Parallel tool calls when independent
- Grep → Read → Edit (no manual steps)
- One clarifying question max
- Checkpoint before >300 tokens

---

## Architecture Quick Reference

### Core Services (Production)
- **ChittyChat Platform**: gateway.chitty.cc (34+ unified services)
- **ChittyID Authority**: id.chitty.cc (identity minting)
- **ChittyRouter**: router.chitty.cc (AI gateway)
- **ChittySchema**: schema.chitty.cc (data framework)
- **Registry**: registry.chitty.cc (service catalog)

### Local Structure
```
/Users/nb/.claude/projects/-/
├── chittychat/           # Unified platform worker
├── chittyrouter/         # AI gateway
├── chittyschema/         # Data framework
├── chittycheck/          # Compliance validation
└── CHITTYOS/             # Services ecosystem
```

### Environment (Required)
```bash
CHITTY_ID_TOKEN=...               # ChittyID auth (REQUIRED)
CHITTYOS_ACCOUNT_ID=bbf9fcd845e78035b7a135c481e88541
NEON_DATABASE_URL=postgresql://...
```

---

## Security & Compliance

### Secrets
- Never commit `.env` files (enforced by .gitignore)
- Use 1Password CLI: `op run --env-file=.env.op`
- ChittyID tokens never hardcoded

### ChittyCheck Enforcement
Validates:
- No local ChittyID generation (1189+ blocked patterns)
- Service connectivity to central ChittyOS services
- Git worktree usage
- Environment completeness

---

## Quick Start Workflow

```bash
# 1. Load session
/project

# 2. Validate compliance
/chittycheck

# 3. Check environment
echo $CHITTY_ID_TOKEN  # Must not be empty

# 4. Navigate to component
cd chittychat/ && npm run dev
```

---

## Extended Documentation

For detailed information, see:

- **Development**: [DOCUMENTATION/DEVELOPMENT.md](DOCUMENTATION/DEVELOPMENT.md)
- **Architecture**: [DOCUMENTATION/ARCHITECTURE.md](DOCUMENTATION/ARCHITECTURE.md)
- **Deployment**: [DOCUMENTATION/DEPLOYMENT.md](DOCUMENTATION/DEPLOYMENT.md)
- **Troubleshooting**: [DOCUMENTATION/TROUBLESHOOTING.md](DOCUMENTATION/TROUBLESHOOTING.md)
- **Service Guides**: [DOCUMENTATION/services/](DOCUMENTATION/services/)

Load these on-demand with `/project` or explicit user request.

---

**Version**: 2.0.0 (Token-Optimized)
**Updated**: 2025-10-17
