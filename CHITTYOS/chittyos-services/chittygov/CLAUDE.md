# CLAUDE.md - ChittyGov Service

## Project Overview

**ChittyGov Service** - Governance and compliance service with evidentiary capabilities for legal defensibility.

**Location**: `/Users/nb/.claude/projects/-/CHITTYOS/chittyos-services/chittygov/`
**Type**: Cloudflare Worker (Hono + D1 + KV)
**Package**: `@chittyfoundation/chittygov-service`

## Purpose

ChittyGov provides governance and compliance enforcement driven by ChittyFoundation standards:
- Compliance checking against ChittyCanon standards
- Evidence collection with ChittyID anchoring
- Immutable audit trails for legal defensibility
- Compliance reports for legal proceedings

## Architecture

```
CHITTYFOUNDATION (Standards)
├── ChittyID → Identity protocol
├── ChittyCanon → Compliance standards
├── ChittyRegister → Service certification
└── ChittyDNA → Entity fingerprinting
         ↓ drives
CHITTYOS/chittyos-services/chittygov/ (THIS SERVICE)
├── ComplianceService
├── EvidenceService
└── AuditService
         ↓ powers
CHITTYAPPS/chittygov/ (Consumer App)
└── Governance dashboard
```

## Key Services

### ComplianceService (`src/services/ComplianceService.ts`)
- Checks entity compliance against standards
- Validates via ChittyID and ChittyCanon
- Generates compliance reports

### EvidenceService (`src/services/EvidenceService.ts`)
- Collects evidence with ChittyID minting
- Links evidence to legal cases
- Immutable evidence storage

### AuditService (`src/services/AuditService.ts`)
- Logs all governance actions
- Maintains chronological audit trail
- Verifies audit integrity

## Development Commands

```bash
# Development
npm run dev              # Wrangler dev (localhost:8787)

# Testing
npm run test            # Vitest
npm run typecheck       # TypeScript validation

# Deployment
npm run deploy          # Deploy to dev
npm run deploy:production

# Compliance
npm run chittycheck     # ChittyOS compliance validation
```

## Environment Variables

```bash
# Required
CHITTY_ID_TOKEN=<token>           # ChittyID API token
CHITTY_CANON_URL=<url>            # ChittyCanon service URL
CHITTY_REGISTER_URL=<url>         # ChittyRegister service URL

# Cloudflare (auto-injected by Wrangler)
CLOUDFLARE_ACCOUNT_ID=<id>
```

## Database Schema

**D1 Database**: `chittygov-compliance`

Tables:
- `compliance_records` - Compliance check history
- `evidence_records` - Evidence collection
- `audit_trail` - Immutable audit log

## API Endpoints

### Compliance
- `POST /api/compliance/check` - Check entity compliance
- `GET /api/compliance/:entityId` - Get compliance status
- `GET /api/reports/compliance/:entityId` - Generate report

### Evidence
- `POST /api/evidence/collect` - Collect evidence
- `GET /api/evidence/:evidenceId` - Retrieve evidence

### Audit
- `POST /api/audit/log` - Log audit entry
- `GET /api/audit/:entityId` - Get audit trail

## ChittyOS Integration

### ChittyID Authority
⚠️ **CRITICAL**: All IDs minted from `https://id.chitty.cc`
- Never generate IDs locally
- Use `CHITTY_ID_TOKEN` for authentication
- Entity types: EVNT (evidence/audit), INFO (reports)

### ChittyCanon Standards
- Validates against canonical compliance standards
- Standards defined by ChittyFoundation

### ChittyRegister Certification
- Service must be registered with registry.chitty.cc
- Compliance validation required

## Use Cases

1. **Corporate Governance**: CHITTYCORP compliance tracking
2. **Legal Evidence**: DERAIL-ME, FURNISHED-CONDOS case evidence
3. **Audit Support**: Immutable audit trails for auditors
4. **Regulatory Compliance**: SOX, GDPR, CCPA enforcement

## Testing

```bash
# Unit tests
npm run test

# Integration tests
npm run test -- tests/integration

# Type checking
npm run typecheck
```

## Deployment

```bash
# Validate compliance first
npm run chittycheck

# Deploy to production
npm run deploy:production

# Verify deployment
curl https://chittygov-service.workers.dev/health
```

## Related Projects

- **Consumer App**: `CHITTYAPPS/chittygov/`
- **Standards**: `CHITTYFOUNDATION/chittycanon/`
- **Identity**: `CHITTYFOUNDATION/chittyid/`
- **Registry**: `CHITTYOS/chittyos-services/chittyregistry/`

## Key Principles

1. **Evidence-First**: All compliance actions generate evidence
2. **Immutability**: Audit trails cannot be modified
3. **ChittyID Authority**: No local ID generation
4. **Standards-Driven**: Compliance rules from ChittyCanon

---

**Service**: ChittyGov Service
**Version**: 1.0.0
**Framework**: ChittyOS v1.0.1
