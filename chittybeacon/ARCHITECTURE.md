# ChittyBeacon Architecture

## System Overview

```
                                 ┌─────────────────────┐
                                 │   Cloudflare Edge   │
                                 │   beacon.chitty.cc  │
                                 └──────────┬──────────┘
                                            │
                                            │ HTTP Request
                                            ▼
                         ┌──────────────────────────────────┐
                         │      ChittyBeacon Worker         │
                         │                                  │
                         │  ┌────────────────────────────┐  │
                         │  │   Router (index.ts)        │  │
                         │  │                            │  │
                         │  │  GET  /health             │  │
                         │  │  GET  /status             │  │
                         │  │  GET  /status/:service    │  │
                         │  │  POST /check              │  │
                         │  └──────────┬─────────────────┘  │
                         │             │                    │
                         │             ▼                    │
                         │  ┌────────────────────────────┐  │
                         │  │   Handlers (handlers.ts)   │  │
                         │  └──────────┬─────────────────┘  │
                         │             │                    │
                         └─────────────┼────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
         ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
         │  Health Checker  │  │   Storage    │  │  Cron Task   │
         │  (health-        │  │  (storage.   │  │  (scheduled) │
         │   checker.ts)    │  │   ts)        │  │              │
         └────────┬─────────┘  └──────┬───────┘  └──────┬───────┘
                  │                   │                  │
                  │                   │                  │
                  ▼                   ▼                  │
      ┌───────────────────┐    ┌──────────────┐         │
      │  External Services│    │ Cloudflare   │         │
      │                   │    │      KV      │         │
      │ • schema.chitty.cc│◄───┤  Namespace   │         │
      │ • id.chitty.cc    │    │              │         │
      │ • auth.chitty.cc  │    │  ┌────────┐  │         │
      │ • connect.c...    │    │  │ Latest │  │         │
      │ • finance.c...    │    │  │ Status │  │         │
      │ • registry.c...   │    │  ├────────┤  │         │
      │ • api.chitty.cc   │    │  │History │  │         │
      │ • mcp.chitty.cc   │    │  │  Data  │  │         │
      │ • docs.chitty.cc  │    │  └────────┘  │         │
      │ • git.chitty.cc   │    │              │         │
      │ • get.chitty.cc   │    └──────────────┘         │
      └───────────────────┘                             │
                  ▲                                     │
                  │                                     │
                  └─────────────────────────────────────┘
                         Every 5 minutes (configurable)
```

## Request Flow

### 1. GET /health

```
Client → Worker → handleHealth() → Response {status: "healthy"}
```

### 2. GET /status

```
Client → Worker → handleStatus()
                      │
                      ├─→ Check KV cache (5 min TTL)
                      │   └─→ Return cached if valid
                      │
                      └─→ If expired or missing:
                          ├─→ getServiceStatus() for each service
                          ├─→ Calculate overall status
                          ├─→ Store in KV cache
                          └─→ Return response
```

### 3. GET /status/:service

```
Client → Worker → handleServiceStatus()
                      │
                      ├─→ getLatestStatus() from KV
                      ├─→ getServiceHistory() from KV
                      ├─→ calculateUptime()
                      └─→ Return ServiceStatus
```

### 4. POST /check

```
Client → Worker → handleCheck()
                      │
                      ├─→ checkAllServices()
                      │   └─→ Parallel fetch to all 11 services
                      │       ├─→ schema.chitty.cc/health
                      │       ├─→ id.chitty.cc/health
                      │       ├─→ auth.chitty.cc/health
                      │       └─→ ... (all services)
                      │
                      ├─→ storeHealthCheck() for each result
                      │   ├─→ Store latest status
                      │   └─→ Store in history
                      │
                      └─→ Return summary + results
```

## Data Flow

### Health Check Execution

```
┌─────────────────────────────────────────────────────────┐
│ 1. Trigger (Manual POST or Scheduled Cron)             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. checkAllServices() - Parallel Execution              │
│                                                          │
│   Promise.all([                                         │
│     checkServiceHealth(schema.chitty.cc),               │
│     checkServiceHealth(id.chitty.cc),                   │
│     checkServiceHealth(auth.chitty.cc),                 │
│     ... (all 11 services)                               │
│   ])                                                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. For Each Service:                                    │
│                                                          │
│   a. HTTP Request with timeout (5000ms)                │
│   b. Measure response time                              │
│   c. Check status code                                  │
│   d. Determine health status:                           │
│      • healthy: correct status, < 1000ms                │
│      • degraded: correct but slow, or unexpected 2xx    │
│      • unhealthy: error, timeout, or unreachable       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Store Results in KV                                  │
│                                                          │
│   For each result:                                      │
│   • KV.put("status:latest:schema", data, TTL=24h)      │
│   • KV.put("history:schema:2026-01-08...", data, TTL=7d)│
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Return Results                                        │
│                                                          │
│   {                                                     │
│     timestamp: "...",                                   │
│     summary: { total, healthy, degraded, unhealthy },   │
│     results: [...]                                      │
│   }                                                     │
└─────────────────────────────────────────────────────────┘
```

## Storage Schema

### KV Keys Structure

```
HEALTH_HISTORY (KV Namespace)
│
├── status:latest:schema          (TTL: 24h)
│   └── {service, url, status, statusCode, responseTime, timestamp}
│
├── status:latest:id              (TTL: 24h)
├── status:latest:auth            (TTL: 24h)
├── ... (one per service)
│
├── history:schema:2026-01-08T12:00:00.000Z   (TTL: 7 days)
│   └── {service, url, status, statusCode, responseTime, timestamp}
│
├── history:schema:2026-01-08T12:05:00.000Z   (TTL: 7 days)
├── history:schema:2026-01-08T12:10:00.000Z   (TTL: 7 days)
├── ... (one per check, per service)
│
└── ecosystem:status:latest       (TTL: 1h, Cache: 5min)
    └── {overall, timestamp, services[], summary}
```

## Component Architecture

### Core Modules

```
┌─────────────────────────────────────────────────────────┐
│ types.ts                                                 │
│ • Env interface (KV binding, env vars)                  │
│ • ServiceConfig (service definitions)                   │
│ • HealthCheckResult (check result structure)            │
│ • ServiceStatus (service status with history)           │
│ • EcosystemStatus (overall status)                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ config.ts                                                │
│ • SERVICES[] - Array of 11 service configurations       │
│ • SERVICE_MAP - Map for quick service lookup            │
│ • KV_KEYS - Key naming functions                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ health-checker.ts                                        │
│ • checkServiceHealth() - Single service check           │
│ • checkAllServices() - Parallel check all services      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ storage.ts                                               │
│ • storeHealthCheck() - Save check result                │
│ • getLatestStatus() - Get current status                │
│ • getServiceHistory() - Get historical checks           │
│ • calculateUptime() - Calculate uptime percentage       │
│ • getServiceStatus() - Get full service status          │
│ • storeEcosystemStatus() - Cache ecosystem status       │
│ • getEcosystemStatus() - Get cached ecosystem status    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ handlers.ts                                              │
│ • handleHealth() - GET /health                          │
│ • handleStatus() - GET /status                          │
│ • handleServiceStatus() - GET /status/:service          │
│ • handleCheck() - POST /check                           │
│ • handleOptions() - CORS preflight                      │
│ • handleNotFound() - 404 handler                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ index.ts                                                 │
│ • fetch() - Main request handler                        │
│   ├─→ Route matching                                    │
│   ├─→ Method validation                                 │
│   ├─→ Handler delegation                                │
│   └─→ Error handling                                    │
│ • scheduled() - Cron trigger handler                    │
│   └─→ Automatic health checks                           │
└─────────────────────────────────────────────────────────┘
```

## Execution Context

### Worker Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│ 1. Worker Initialization                                │
│    • Module loaded at edge location                     │
│    • Types and configs imported                         │
│    • KV namespace bound                                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Request Received                                      │
│    • HTTP request arrives at edge                       │
│    • fetch() handler invoked                            │
│    • Request, Env, Context provided                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Request Processing                                    │
│    • URL parsed                                         │
│    • Route matched                                      │
│    • Handler executed                                   │
│    • KV operations performed                            │
│    • External services called (if needed)               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Response Generated                                    │
│    • JSON serialized                                    │
│    • CORS headers added                                 │
│    • Response returned                                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Worker Idle                                           │
│    • Context persists for next request                  │
│    • Memory may be reused or released                   │
└─────────────────────────────────────────────────────────┘
```

### Scheduled Task Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│ Cron Trigger (Every 5 minutes)                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ scheduled() handler invoked                              │
│   ├─→ Check all 11 services (parallel)                  │
│   ├─→ Store results in KV                               │
│   └─→ Log completion                                    │
└─────────────────────────────────────────────────────────┘
```

## Performance Characteristics

### Latency Breakdown

```
Total Response Time: ~50-200ms

┌─────────────────────────────────────────────┐
│ Component                    Time            │
├─────────────────────────────────────────────┤
│ Edge routing                 ~5-10ms         │
│ Worker execution             ~1-5ms          │
│ KV read (cached)             ~1-2ms          │
│ KV read (uncached)           ~10-50ms        │
│ JSON serialization           ~1-2ms          │
│ Network return               ~5-10ms         │
└─────────────────────────────────────────────┘

POST /check (with health checks):
┌─────────────────────────────────────────────┐
│ Edge routing                 ~5-10ms         │
│ Worker execution             ~1-5ms          │
│ 11 parallel service checks   ~100-1000ms     │
│ KV writes (11 services)      ~50-100ms       │
│ JSON serialization           ~2-5ms          │
│ Network return               ~5-10ms         │
└─────────────────────────────────────────────┘
Total: ~200-1200ms (depends on service response times)
```

### Scalability

```
Concurrent Requests: Unlimited (auto-scaling)
CPU Time Limit: 10ms per request (cached reads)
               50ms per request (health checks)
Memory Limit: 128 MB per worker instance
KV Operations: 1000 writes/sec, 100k reads/sec per namespace
```

## Security Model

```
┌─────────────────────────────────────────────────────────┐
│ Public API (No Authentication)                          │
│                                                          │
│ ✓ Health data is non-sensitive                         │
│ ✓ All endpoints CORS-enabled                           │
│ ✓ No user data or PII                                  │
│ ✓ No write operations that affect system               │
│ ✓ POST /check is idempotent and safe                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Data Protection                                          │
│                                                          │
│ • Automatic TTL expiration (24h - 7d)                   │
│ • No long-term data retention                           │
│ • Cloudflare encryption at rest                         │
│ • TLS 1.3 in transit                                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Potential Rate Limiting (Optional)                      │
│                                                          │
│ • Cloudflare Rate Limiting Rules                        │
│ • Per-IP limits                                         │
│ • POST /check throttling                                │
└─────────────────────────────────────────────────────────┘
```

## Deployment Architecture

```
                     Development
                          │
                          │ npm run dev
                          ▼
                  ┌────────────────┐
                  │ Local Miniflare│
                  │  localhost:8787│
                  └────────────────┘

                     Production
                          │
                          │ npm run deploy
                          ▼
            ┌──────────────────────────┐
            │   Cloudflare Dashboard    │
            │   • Worker uploaded       │
            │   • Routes configured     │
            │   • KV bound              │
            └──────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │  Global Edge Network              │
        │  • 300+ locations worldwide       │
        │  • Automatic geo-routing          │
        │  • beacon.chitty.cc routes here   │
        └──────────────────────────────────┘
```
