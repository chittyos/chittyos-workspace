# ChittyRegister Quick Start

Get ChittyRegister up and running in 5 minutes.

## 1. Install Dependencies

```bash
cd /Volumes/chitty/workspace/chittyregister
pnpm install
```

## 2. Setup KV Namespaces

```bash
# Create development namespace
wrangler kv:namespace create "REGISTRY_KV"

# Note the ID and update wrangler.toml if different from:
# id = "chitty-registry-kv"
```

## 3. Start Development Server

```bash
pnpm dev
```

The server will start at `http://localhost:8787`

## 4. Test the API

Open a new terminal and run:

```bash
./test-api.sh
```

Or manually test:

```bash
# Health check
curl http://localhost:8787/health

# Register a service
curl -X POST http://localhost:8787/api/v1/register \
  -H "Content-Type: application/json" \
  -H "X-Chitty-ID: test-user-001" \
  -d @example-register.json

# List services
curl http://localhost:8787/api/v1/services

# Get specific service
curl http://localhost:8787/api/v1/services/myawesomeservice

# Get status
curl http://localhost:8787/api/v1/status
```

## 5. Register Your First Service

```bash
curl -X POST http://localhost:8787/api/v1/register \
  -H "Content-Type: application/json" \
  -H "X-Chitty-ID: YOUR-CHITTY-ID" \
  -d '{
    "name": "myservice",
    "version": "1.0.0",
    "type": "worker",
    "category": "Application",
    "description": "My awesome service that does amazing things for ChittyOS",
    "owner": "yourname",
    "endpoints": {
      "api": "https://myservice.chitty.cc/api",
      "health": "https://myservice.chitty.cc/health"
    }
  }'
```

## Common Tasks

### View Logs
```bash
# In development
# Logs appear in the terminal where you ran `pnpm dev`
```

### List All Services
```bash
curl http://localhost:8787/api/v1/services?limit=50
```

### Filter Services by Type
```bash
curl "http://localhost:8787/api/v1/services?type=worker"
```

### Filter by Category
```bash
curl "http://localhost:8787/api/v1/services?category=Application"
```

### Check Registry Statistics
```bash
curl http://localhost:8787/api/v1/status | jq
```

## Validation Rules

Your service registration must follow these rules:

1. **Name**: lowercase, alphanumeric with hyphens, 3-64 chars, starts with letter
   - Good: `myservice`, `chitty-auth`, `service123`
   - Bad: `MyService`, `_service`, `ab`, `service_name`

2. **Version**: semver format
   - Good: `1.0.0`, `2.1.3-beta`, `0.0.1-alpha`
   - Bad: `1.0`, `v1.0.0`, `1.0.0.0`

3. **Description**: 10-500 characters
   - Good: `A service that handles user authentication`
   - Bad: `Auth svc` (too short)

4. **Type**: one of `worker`, `api`, `mcp`, `package`, `tool`

5. **Category**: one of `Foundation`, `Core`, `Data`, `Platform`, `Domain`, `Sync`, `Application`

## Deployment

When ready to deploy:

### Staging
```bash
pnpm deploy:staging
```
Access at: https://register-staging.chitty.cc

### Production
```bash
pnpm deploy
```
Access at: https://register.chitty.cc

## Troubleshooting

### Port already in use
If port 8787 is busy:
```bash
wrangler dev --port 8788
```

### KV not working
Make sure the namespace binding is correct in wrangler.toml:
```toml
[[kv_namespaces]]
binding = "REGISTRY_KV"
id = "your-namespace-id"
```

### CORS errors
The worker includes CORS headers. If testing from browser, ensure you're sending requests with proper headers.

## What's Next?

- Read the full [README.md](README.md) for detailed documentation
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
- Review [src/index.ts](src/index.ts) to understand the implementation
- Integrate with your services using `@chittyos/core`

---

Need help? Check the ChittyOS documentation at https://docs.chitty.cc
