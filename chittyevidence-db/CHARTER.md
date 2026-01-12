# ChittyEvidence Charter

## Classification
- **Tier**: 4 (Domain - Business Logic)
- **Organization**: CHITTYOS
- **Domain**: evidence.chitty.cc

## Mission
Process, validate, and manage legal evidence with provenance tracking, ensuring evidentiary standards compliance through the Legal Constitution Enforcer.

## Scope

### This Service IS Responsible For:
- Document ingestion and OCR processing
- Entity extraction (parties, dates, amounts, properties)
- Knowledge gap detection and resolution
- Duplicate detection across corpus
- Provenance chain management
- Legal Constitution enforcement (claim → source validation)
- Chain of custody tracking
- Authority graph construction
- Semantic search over evidence corpus

### This Service IS NOT Responsible For:
- Document signing orchestration (→ ChittySign)
- ChittyID minting (→ ChittyMint)
- User authentication (→ ChittyAuth)
- Financial transaction recording (→ ChittyLedger)
- Document storage infrastructure (→ ChittyConnect/R2)
- Cross-service synchronization (→ ChittySync)

## Dependencies

| Direction | Service | Purpose |
|-----------|---------|---------|
| Upstream | ChittyID | Identity resolution for actors |
| Upstream | ChittyConnect | Service authentication |
| Upstream | ChittyAuth | User authentication |
| Downstream | ChittyLedger | Financial cross-reference |
| Downstream | ChittyMint | Document certification |
| Peer | ChittyScore | Trust scoring for evidence weight |

## API Contract

| Endpoint | Purpose |
|----------|---------|
| `POST /documents` | Ingest document into processing pipeline |
| `GET /documents/:id` | Retrieve processed document |
| `POST /search` | Semantic + keyword search |
| `GET /gaps` | List knowledge gaps |
| `POST /gaps/:id/resolve` | Resolve gap with value |
| `GET /duplicates` | List duplicate groups |
| `POST /legal/check` | Validate evidentiary compliance |
| `GET /legal/documents/:id/custody` | Chain of custody |
| `POST /provenance` | Record provenance event |
| `GET /provenance/:type/:id/verify` | Verify provenance chain |
| `GET /health` | Health check |

## Ownership
- **Maintainer**: @chittyos/evidence
- **Escalation**: evidence@chitty.cc

## Compliance

- [x] ChittyID integration required
- [x] ChittyConnect authentication required
- [ ] ChittyChronicle logging required
- [x] Gateway modules (api-evidence/)
- [x] Health endpoint (`/health`)
- [x] Info endpoint (`/`)

---

## Related Files

| File | Purpose |
|------|---------|
| CHARTER.md | What the service IS (governance, scope, contract) |
| CLAUDE.md | How to WORK with the service (dev guidance) |
| README.md | How to USE the service (user documentation) |
