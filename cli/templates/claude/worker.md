# {{serviceName}}

{{#if description}}
{{description}}
{{/if}}

## Tech Stack

- **Runtime**: Cloudflare Workers
{{#if domain}}- **Domain**: {{domain}}{{/if}}

## Directory Structure

```
src/
├── index.ts              # Worker entry point
└── types.ts              # Type definitions
wrangler.toml             # Cloudflare configuration
```

## Development Commands

```bash
# Install dependencies
{{packageManager}} install

# Run locally
{{packageManager}} dev

# Deploy to Cloudflare
{{packageManager}} deploy

# View logs
{{packageManager}} tail
```

## Wrangler Configuration

Update `wrangler.toml` with:
- Custom domain bindings
- Environment variables
- KV/R2/D1 bindings as needed

```toml
name = "{{serviceName}}"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"

# Add routes/custom domains
# routes = [{ pattern = "{{domain}}/*", zone_name = "chitty.cc" }]
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ENVIRONMENT` | production / staging / development |

## Bindings

### KV Namespaces
```toml
[[kv_namespaces]]
binding = "CACHE"
id = "xxx"
```

### D1 Databases
```toml
[[d1_databases]]
binding = "DB"
database_name = "xxx"
database_id = "xxx"
```

### R2 Buckets
```toml
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "xxx"
```

## Deployment

```bash
# Deploy to production
wrangler deploy --env production

# Deploy to staging
wrangler deploy --env staging
```

## Health Check

Implement a health endpoint:

```typescript
if (url.pathname === '/health') {
  return Response.json({
    status: 'ok',
    service: '{{serviceName}}'
  });
}
```
