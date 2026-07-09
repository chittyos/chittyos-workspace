# ChittyEvidence Development Guide

This file provides guidance to Claude Code when working with this repository.

## Project Overview

ChittyEvidence is a Cloudflare Workers service for legal evidence processing. See CHARTER.md for scope and governance.

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: D1 (SQLite)
- **Storage**: R2
- **Search**: Vectorize
- **AI**: Workers AI (@cf/meta/llama-3.1-70b-instruct)
- **Durable Objects**: DuplicateHunterDO, AccuracyGuardianDO
- **Workflows**: DocumentProcessingWorkflow

## Directory Structure

```
src/
├── index.ts              # Main API routes (Hono)
├── types/index.ts        # TypeScript definitions
├── utils/index.ts        # Helpers (generateId, safeJsonParse)
├── services/
│   ├── chitty-context.ts      # ChittyID/sessions/provenance
│   ├── chitty-connect.ts      # Service-to-service auth
│   ├── knowledge-gaps.ts      # Gap detection/resolution
│   └── legal-constitution.ts  # Evidentiary rules enforcement
├── durable-objects/
│   ├── duplicate-hunter.ts    # Corpus-wide deduplication
│   └── accuracy-guardian.ts   # Correction rules engine
├── workflows/
│   └── document-processing.ts # 8-step durable pipeline
└── workers/
    └── gatekeeper.ts          # Pre-workflow dedup check
migrations/
├── 0001_initial.sql           # Core tables
├── 0002_chitty_context.sql    # ChittyID tables
└── 0003_legal_constitution.sql # Legal rules tables
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Run locally
pnpm dev

# Type check
pnpm typecheck

# Deploy to production
wrangler deploy

# Apply migrations
wrangler d1 migrations apply chitty-evidence-db --remote

# Tail logs
wrangler tail chittyevidence
```

## Key Patterns

### Knowledge Gaps
When AI cannot confidently extract information, create a gap:
```typescript
// Creates placeholder like {{GAP:gap_abc123}}
await gapsService.registerGap({
  type: 'missing_date',
  context: 'lease start date unclear',
  documentId: doc.id,
  fieldPath: 'terms.startDate'
});
```

### Provenance Tracking
Every state change must be recorded:
```typescript
await contextService.recordProvenance({
  entityType: 'document',
  entityId: doc.id,
  action: 'metadata_updated',
  chittyId: actor.id,
  previousState: oldMetadata,
  newState: newMetadata
});
```

### Legal Constitution Check
Before accepting claims, validate evidence:
```typescript
const result = await legalService.checkCompliance({
  claimType: 'financial_claim',
  supportingDocuments: [bankStatement.id, invoice.id]
});
if (!result.compliant) {
  // Handle missing evidence
}
```

## Environment Variables

| Variable | Dev Default | Prod Default |
|----------|-------------|--------------|
| ENVIRONMENT | development | production |
| AUTO_RESOLVE_CONFIDENCE_THRESHOLD | 0.99 | 0.95 |
| DUPLICATE_AUTO_MERGE_THRESHOLD | 0.98 | 0.98 |
| MAX_OCR_TIMEOUT_MS | 300000 | 300000 |

## Testing Locally

```bash
# Start dev server
pnpm dev

# Test health
curl http://localhost:8787/health

# Test info
curl http://localhost:8787/

# Upload document
curl -X POST http://localhost:8787/documents \
  -F "file=@test.pdf" \
  -F "metadata={\"type\":\"lease\"}"
```

## Cron Jobs

Crons run automatically in production. To trigger locally:
```bash
curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*"
```

## Common Issues

### "Vectorize Index bindings do not support local development"
Expected - Vectorize only works in remote mode. Use `wrangler dev --remote` for full testing.

### Queue consumer conflicts
If deploy fails with queue consumer error, check existing consumers:
```bash
wrangler queues consumer remove <queue-name> <old-worker-name>
```

### DO migration tag mismatch
If DOs were created without migration tags, remove the `[[migrations]]` section from wrangler.toml.

## Integration Points

- **ChittyConnect**: Use `ChittyConnectClient` for authenticated service calls
- **ChittyID**: Use `ChittyContextService` for identity/session management
- **Gateway**: API exposed at `evidence.chitty.cc` via chittyapi gateway

---

## Related Files

| File | Purpose |
|------|---------|
| CHARTER.md | What the service IS (governance, scope, contract) |
| CLAUDE.md | How to WORK with the service (dev guidance) |
| README.md | How to USE the service (user documentation) |
