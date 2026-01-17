# {{serviceName}}

{{#if description}}
{{description}}
{{/if}}

## Tech Stack

- **Runtime**: {{runtime}}
{{#if framework}}- **Framework**: {{framework}}{{/if}}
{{#if database}}- **Database**: {{database}}{{/if}}
{{#if domain}}- **Domain**: {{domain}}{{/if}}

## Directory Structure

```
src/
├── index.ts              # Main entry point
├── types/                # TypeScript definitions
{{#if hasMcp}}
├── mcp/                  # MCP server implementation
{{/if}}
{{#if hasApi}}
├── api/                  # API routes
{{/if}}
└── lib/                  # Shared utilities
```

## Development Commands

```bash
# Install dependencies
{{packageManager}} install

# Run locally
{{packageManager}} dev

# Build
{{packageManager}} build

# Deploy
{{packageManager}} deploy
```

## Endpoints

{{#if hasHealth}}
- `GET /health` - Health check endpoint
{{/if}}
{{#if hasApi}}
- `GET /api/*` - API endpoints
{{/if}}
{{#if hasMcp}}
- `POST /mcp` - MCP server endpoint
- `GET /mcp/tools` - List available MCP tools
{{/if}}
{{#if hasDocs}}
- `GET /docs` - API documentation
{{/if}}

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ENVIRONMENT` | Deployment environment (production/staging/development) | No |
{{#if hasMcp}}
| `MCP_SECRET` | MCP authentication secret | Yes |
{{/if}}

## Integration with ChittyOS

{{#if integrations}}
Integrates with:
{{#each integrations}}
- {{this}}
{{/each}}
{{else}}
This service integrates with:
- **ChittyRegistry** - Service discovery and registration
- **ChittyConnect** - Context and session management
- **ChittyAuth** - Authentication and authorization
{{/if}}

## Key Patterns

1. **ChittyID Integration**
   - Use ChittyID for all entity identification
   - Format: `VV-G-LLL-SSSS-T-YM-C-X`

2. **Error Handling**
   - Return structured error responses
   - Include ChittyID in error context

3. **Health Checks**
   - Implement `/health` endpoint
   - Return service status and dependencies

4. **Logging**
   - Use structured logging
   - Include request/session context

## Testing

```bash
# Run tests
{{packageManager}} test

# Run tests with coverage
{{packageManager}} test:coverage
```

## Deployment

Deployed to Cloudflare Workers via GitHub Actions.

```bash
# Manual deploy
{{packageManager}} deploy

# View logs
{{packageManager}} tail
```
