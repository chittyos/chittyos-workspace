# ChittyRegister

**Compliance gatekeeper for ChittyOS service registration**

ChittyRegister (`register.chitty.cc`) is the central service registry for the ChittyOS ecosystem. It provides a compliance-focused registration system for all services, workers, packages, and tools in the ChittyOS network.

## Features

- Service registration with validation
- Multi-type support (workers, APIs, MCP servers, packages, tools)
- Category-based organization
- Status tracking (pending, approved, active, deprecated, rejected)
- Full audit trail via ChittyContext
- KV-backed persistent storage
- RESTful API with CORS support

## Endpoints

### Health Check
```
GET /health
```
Returns service health status and features.

### Register a Service
```
POST /api/v1/register
Content-Type: application/json

{
  "name": "myservice",
  "version": "1.0.0",
  "type": "worker",
  "category": "Application",
  "description": "My awesome ChittyOS service",
  "owner": "username",
  "endpoints": {
    "api": "https://myservice.chitty.cc/api",
    "health": "https://myservice.chitty.cc/health"
  },
  "metadata": {
    "repository": "https://github.com/CHITTYOS/myservice",
    "license": "MIT",
    "tags": ["utility", "integration"]
  }
}
```

### List Services
```
GET /api/v1/services?type=worker&category=Application&status=active&limit=50
```
Query parameters:
- `type` - Filter by service type (worker, api, mcp, package, tool)
- `category` - Filter by category (Foundation, Core, Data, Platform, Domain, Sync, Application)
- `status` - Filter by status (pending, approved, active, deprecated, rejected)
- `limit` - Maximum number of results (default: 100)

### Get Service Details
```
GET /api/v1/services/:name
```
Returns detailed information about a specific service.

### Registry Status
```
GET /api/v1/status
```
Returns registry operational status and statistics.

## Validation Rules

### Service Name
- Lowercase alphanumeric with hyphens
- 3-64 characters
- Must start with a letter
- Pattern: `^[a-z][a-z0-9-]{2,63}$`

### Version
- Must follow semver format
- Examples: `1.0.0`, `2.1.3-beta`, `0.0.1-alpha`
- Pattern: `^\d+\.\d+\.\d+(-[a-z0-9]+)?$`

### Description
- Between 10 and 500 characters
- Should clearly describe the service purpose

## Service Types

- `worker` - Cloudflare Worker
- `api` - REST API service
- `mcp` - Model Context Protocol server
- `package` - NPM or language package
- `tool` - CLI tool or utility

## Service Categories

- `Foundation` - Core infrastructure (auth, schema, registry, id)
- `Core` - Essential services (verify, trust, certify, canon, beacon)
- `Data` - Data management (ledger, dna, documint, mint)
- `Platform` - Platform services (connect, entry, router)
- `Domain` - Domain-specific (finance, credit, resolution, brand)
- `Sync` - Synchronization services
- `Application` - End-user applications (chat, flow, force, forge)

## Service Status

- `pending` - Awaiting approval
- `approved` - Approved but not yet active
- `active` - Fully operational
- `deprecated` - No longer recommended
- `rejected` - Registration rejected

## Development

```bash
# Install dependencies
pnpm install

# Run locally
pnpm dev

# Build
pnpm build

# Deploy to staging
pnpm deploy:staging

# Deploy to production
pnpm deploy
```

## Architecture

ChittyRegister is built on:
- **Cloudflare Workers** - Edge compute platform
- **KV Storage** - Persistent service registration data
- **@chittyos/core** - Shared utilities and types
- **ChittyContext** - Audit trail and traceability

## Storage Schema

### Service Records
```
Key: service:{name}
Value: ServiceRegistration (JSON)
```

### Index
```
Key: index:{type}:{name}
Value: { name, registeredAt }
```

## Security

- All registrations require a valid ChittyID
- Full audit logging of all operations
- Context-based trust scoring
- Compliance validation on all inputs
- CORS protection for API endpoints

## Integration

Import from `@chittyos/core` for service discovery:

```typescript
import { getService, listServices } from '@chittyos/core'

// Get service details
const service = await getService('myservice')

// List services by category
const services = await listServices({ category: 'Application' })
```

## License

MIT

---

Part of the ChittyOS ecosystem - https://chitty.cc
