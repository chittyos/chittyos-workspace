# ChittyBeacon

Health monitoring service for the Chitty ecosystem, built as a Cloudflare Worker.

## Features

- Real-time health monitoring for all Chitty services
- Historical health data storage in Cloudflare KV
- Automatic scheduled health checks
- RESTful API for querying service status
- CORS-enabled for browser access
- Uptime calculation and reporting

## Monitored Services

- schema.chitty.cc - Schema Service
- id.chitty.cc - Identity Service
- auth.chitty.cc - Auth Service
- connect.chitty.cc - Connect Service
- finance.chitty.cc - Finance Service
- registry.chitty.cc - Registry Service
- api.chitty.cc - API Service
- mcp.chitty.cc - MCP Service
- docs.chitty.cc - Documentation
- git.chitty.cc - Git Service
- get.chitty.cc - Get Service

## API Endpoints

### GET /health
Returns the health status of the beacon service itself.

**Response:**
```json
{
  "status": "healthy",
  "service": "ChittyBeacon",
  "timestamp": "2026-01-08T00:00:00.000Z",
  "version": "1.0.0"
}
```

### GET /status
Returns the overall ecosystem status with all services.

**Response:**
```json
{
  "overall": "healthy",
  "timestamp": "2026-01-08T00:00:00.000Z",
  "services": [...],
  "summary": {
    "total": 11,
    "healthy": 10,
    "degraded": 1,
    "unhealthy": 0
  }
}
```

### GET /status/:service
Returns detailed status for a specific service.

**Example:** `GET /status/schema`

**Response:**
```json
{
  "service": "Schema Service",
  "url": "https://schema.chitty.cc",
  "currentStatus": "healthy",
  "lastCheck": "2026-01-08T00:00:00.000Z",
  "responseTime": 123,
  "uptime24h": 99.5,
  "recentChecks": [...]
}
```

### POST /check
Triggers an immediate health check for all services.

**Response:**
```json
{
  "timestamp": "2026-01-08T00:00:00.000Z",
  "summary": {
    "total": 11,
    "healthy": 10,
    "degraded": 1,
    "unhealthy": 0
  },
  "results": [...]
}
```

## Setup

### Prerequisites

- Node.js 18+ and npm/pnpm
- Cloudflare account
- Wrangler CLI installed

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create KV namespace:
```bash
wrangler kv:namespace create "HEALTH_HISTORY"
wrangler kv:namespace create "HEALTH_HISTORY" --preview
```

3. Update `wrangler.toml` with the KV namespace IDs returned from the previous commands.

4. (Optional) Configure scheduled triggers:
Add this to `wrangler.toml`:
```toml
[triggers]
crons = ["*/5 * * * *"]  # Run every 5 minutes
```

### Development

Run locally:
```bash
npm run dev
```

### Deployment

Deploy to Cloudflare:
```bash
npm run deploy
```

View logs:
```bash
npm run tail
```

## Configuration

Edit `src/config.ts` to:
- Add/remove services to monitor
- Change health check endpoints
- Adjust timeout values
- Modify expected status codes

Edit `wrangler.toml` to:
- Change check interval
- Adjust history retention period
- Configure scheduled triggers

## Health Status Definitions

- **healthy**: Service responds with expected status code in < 1000ms
- **degraded**: Service responds correctly but slowly (>= 1000ms) or with non-expected 2xx status
- **unhealthy**: Service returns error status, times out, or is unreachable

## Storage

Health check results are stored in Cloudflare KV with the following retention:
- Latest status: 24 hours
- Historical data: 7 days (configurable via `HISTORY_RETENTION_DAYS`)

## License

MIT
