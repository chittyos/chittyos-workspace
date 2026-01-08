# ChittyBeacon Project Overview

## Project Structure

```
chittybeacon/
├── src/
│   ├── index.ts              # Main worker entry point and request router
│   ├── types.ts              # TypeScript interfaces and types
│   ├── config.ts             # Service configuration and constants
│   ├── health-checker.ts     # Health check logic
│   ├── handlers.ts           # HTTP request handlers
│   └── storage.ts            # KV storage operations
├── wrangler.toml             # Cloudflare Worker configuration
├── package.json              # Project dependencies
├── tsconfig.json             # TypeScript configuration
├── setup.sh                  # Automated setup script
├── test.sh                   # API testing script
├── README.md                 # Project documentation
├── DEPLOYMENT.md             # Deployment guide
├── EXAMPLES.md               # API usage examples
└── .gitignore                # Git ignore rules
```

## Architecture

### Request Flow

1. **Incoming Request** → `src/index.ts`
   - Routes request based on path and method
   - Handles CORS preflight requests

2. **Handler Functions** → `src/handlers.ts`
   - `handleHealth()` - Returns beacon's own health
   - `handleStatus()` - Returns ecosystem-wide status
   - `handleServiceStatus()` - Returns specific service status
   - `handleCheck()` - Triggers immediate health checks

3. **Health Checking** → `src/health-checker.ts`
   - Performs HTTP requests to service health endpoints
   - Measures response time and status
   - Categorizes as healthy/degraded/unhealthy

4. **Data Storage** → `src/storage.ts`
   - Stores health check results in Cloudflare KV
   - Retrieves historical data
   - Calculates uptime percentages

### Data Flow

```
Service → Health Check → KV Storage → API Response
   ↓           ↓              ↓            ↓
schema.cc   Fetch URL    Latest Status   JSON
id.cc       Measure      History         Status
auth.cc     Categorize   Uptime %        Client
...
```

## Key Features

### 1. Real-time Health Monitoring
- Checks 11 Chitty ecosystem services
- Configurable endpoints and timeouts
- Response time measurement
- Status categorization

### 2. Historical Data Storage
- Stores latest status (24h TTL)
- Maintains history (7 days TTL)
- Calculates 24h uptime
- Recent checks tracking

### 3. RESTful API
- GET /health - Beacon health
- GET /status - Ecosystem status
- GET /status/:service - Service-specific status
- POST /check - Manual health check trigger

### 4. Scheduled Checks
- Automatic periodic health checks via Cron Triggers
- Configurable intervals (e.g., every 5 minutes)
- Background execution

### 5. CORS Support
- All endpoints CORS-enabled
- Public access for monitoring dashboards
- Preflight request handling

## Configuration

### Service Configuration (`src/config.ts`)

Each service has:
- `name` - Display name
- `url` - Base URL
- `healthEndpoint` - Health check path (default: /health)
- `expectedStatus` - Expected HTTP status (default: 200)
- `timeout` - Request timeout in ms (default: 5000)

### Environment Variables (`wrangler.toml`)

- `CHECK_INTERVAL_MS` - Health check interval
- `HISTORY_RETENTION_DAYS` - How long to keep history

### KV Storage Keys

- `status:latest:{service}` - Latest health status
- `history:{service}:{timestamp}` - Historical checks
- `ecosystem:status:latest` - Cached ecosystem status

## Health Status Determination

### Healthy
- Response status matches expected status
- Response time < 1000ms

### Degraded
- Response status matches expected status but slow (≥1000ms)
- OR response is 2xx but not expected status

### Unhealthy
- Non-2xx status code
- Request timeout
- Network error
- Service unreachable

## Deployment Process

1. **Setup**
   ```bash
   ./setup.sh
   ```
   - Installs dependencies
   - Creates KV namespaces
   - Provides configuration IDs

2. **Configuration**
   - Update `wrangler.toml` with KV IDs
   - Configure DNS (beacon.chitty.cc)
   - Add cron triggers (optional)

3. **Testing**
   ```bash
   npm run dev
   ./test.sh
   ```

4. **Deployment**
   ```bash
   npm run deploy
   ```

5. **Verification**
   ```bash
   curl https://beacon.chitty.cc/health
   npm run tail
   ```

## Monitored Services

| Service | URL | Purpose |
|---------|-----|---------|
| Schema | schema.chitty.cc | Schema registry |
| Identity | id.chitty.cc | Identity service |
| Auth | auth.chitty.cc | Authentication |
| Connect | connect.chitty.cc | Connection service |
| Finance | finance.chitty.cc | Financial operations |
| Registry | registry.chitty.cc | Service registry |
| API | api.chitty.cc | Main API |
| MCP | mcp.chitty.cc | MCP server |
| Docs | docs.chitty.cc | Documentation |
| Git | git.chitty.cc | Git service |
| Get | get.chitty.cc | Download service |

## Performance Considerations

### Request Optimization
- Parallel health checks using Promise.all()
- Timeout enforcement per service
- Response caching for ecosystem status (5 min)

### Storage Optimization
- Automatic KV expiration
- TTL-based data retention
- Efficient key naming scheme

### Edge Deployment
- Cloudflare Workers run at the edge
- Low latency worldwide
- Automatic scaling

## Security

### Public Access
- All endpoints are public
- No sensitive data exposed
- Health data is non-confidential

### Rate Limiting
- Consider Cloudflare rate limiting if needed
- Worker CPU time limits apply
- KV operation limits apply

### CORS Policy
- Allow-Origin: * (all domains)
- Allow-Methods: GET, POST, OPTIONS
- Allow-Headers: Content-Type

## Extensibility

### Adding New Services

Edit `src/config.ts`:
```typescript
{
  name: 'New Service',
  url: 'https://new.chitty.cc',
  healthEndpoint: '/health',
  expectedStatus: 200,
  timeout: 5000,
}
```

### Custom Health Logic

Override in `src/health-checker.ts`:
```typescript
// Add custom validation
if (metadata?.version !== expectedVersion) {
  status = 'degraded';
}
```

### Additional Endpoints

Add to `src/index.ts`:
```typescript
if (path === '/custom' && method === 'GET') {
  return handleCustom(env);
}
```

### Integration with Other Systems

The API can be integrated with:
- Status pages (Uptime Kuma, etc.)
- Monitoring tools (Prometheus, Grafana)
- Alert systems (PagerDuty, Slack)
- Dashboards (React, Vue, etc.)

## Troubleshooting

### Common Issues

1. **KV Namespace Not Found**
   - Run setup.sh again
   - Verify IDs in wrangler.toml

2. **Services Showing Unhealthy**
   - Check if services are actually up
   - Verify health endpoints exist
   - Check timeout values

3. **No Historical Data**
   - Run POST /check to populate data
   - Wait for scheduled checks to run
   - Verify KV storage is working

4. **Slow Response Times**
   - Check service performance
   - Adjust timeout values
   - Consider geographic distribution

## Future Enhancements

Potential improvements:
- [ ] D1 database option for richer queries
- [ ] WebSocket support for real-time updates
- [ ] Alert notifications (email, Slack, etc.)
- [ ] Detailed metrics export (Prometheus format)
- [ ] Service dependency mapping
- [ ] Custom health check intervals per service
- [ ] Authentication for write operations
- [ ] Admin dashboard
- [ ] Historical trend analysis
- [ ] SLA tracking and reporting

## Support and Maintenance

### Monitoring
- Check Cloudflare dashboard for worker analytics
- Use `wrangler tail` for live logs
- Monitor KV usage and costs

### Updates
- Keep dependencies updated
- Monitor Cloudflare Workers changelog
- Test changes in preview environment

### Costs
- Workers: Free tier includes 100k requests/day
- KV: Free tier includes 100k reads/day, 1k writes/day
- Typical usage should stay within free tier

## License

MIT License - See LICENSE file for details
