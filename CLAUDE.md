# ChittyOS Gateway Workspace

This is the canonical workspace for ChittyOS gateway services and shared packages.

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │         ChittyConnect               │
                    │     (Intelligence Hub)              │
                    │  connect.chitty.cc                  │
                    │  ContextConsciousness + MemoryCloude│
                    └─────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   chittyapi   │         │    chittymcp    │         │   chittydocs    │
│ api.chitty.cc │         │  mcp.chitty.cc  │         │ docs.chitty.cc  │
│  API Gateway  │         │   MCP Gateway   │         │  Docs Gateway   │
└───────────────┘         └─────────────────┘         └─────────────────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │       registry.chitty.cc      │
                    │    (Dynamic Route Discovery)  │
                    └───────────────────────────────┘
```

## Packages

### Gateway Workers (Cloudflare Workers)

| Package | Domain | Description |
|---------|--------|-------------|
| `chittyapi` | api.chitty.cc | REST API gateway - routes to `{service}.chitty.cc/api/*` |
| `chittymcp` | mcp.chitty.cc | MCP gateway - aggregates tools from all services |
| `chittydocs` | docs.chitty.cc | Documentation gateway - service docs index |
| `gitchitty` | git.chitty.cc | Package registry - `curl git.chitty.cc/{pkg}/install \| bash` |
| `getchitty` | get.chitty.cc | Discovery & onboarding wizard |

### Shared Libraries

| Package | Description |
|---------|-------------|
| `chittycore` (`@chittyos/core`) | Shared types, registry client, routing utilities, ChittyID |
| `packages/crypto` (`@chittyos/crypto`) | Ed25519 signing, RFC 8785 JCS, Base64 utilities |

### CLI

| Package | Commands | Description |
|---------|----------|-------------|
| `cli` (`@chittyos/cli`) | `chitty`, `chittyos` | Developer CLI for ecosystem management |

## Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Deploy gateways
pnpm deploy:api      # api.chitty.cc
pnpm deploy:mcp      # mcp.chitty.cc
pnpm deploy:docs     # docs.chitty.cc
pnpm deploy:git      # git.chitty.cc
pnpm deploy:get      # get.chitty.cc

# Deploy all
pnpm deploy
```

## Directory Structure

```
workspace/
├── chittyapi/          # API gateway worker
│   ├── src/index.ts
│   └── wrangler.toml
├── chittymcp/          # MCP gateway worker
│   ├── src/index.ts
│   └── wrangler.toml
├── chittydocs/         # Docs gateway worker
│   ├── src/index.ts
│   └── wrangler.toml
├── gitchitty/          # Package registry worker
│   ├── src/index.ts
│   └── wrangler.toml
├── getchitty/          # Discovery worker
│   ├── src/index.ts
│   └── wrangler.toml
├── chittycore/         # Shared core library
│   └── src/
│       ├── index.ts
│       ├── types.ts
│       ├── registry.ts
│       ├── routing.ts
│       └── chittyid.ts
├── cli/                # Developer CLI
│   └── src/
│       ├── index.ts
│       └── commands/
├── packages/
│   └── crypto/         # Crypto primitives
│       └── src/
│           ├── ed25519.ts
│           ├── jcs.ts
│           └── base64.ts
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Gateway Behavior

All gateways query `registry.chitty.cc` for dynamic service discovery:

1. **API Gateway** (`api.chitty.cc/{service}/*`)
   - Routes requests to `{service}.chitty.cc/api/*`
   - Caches routes for 1 minute
   - Adds `X-Gateway: chittyapi` header

2. **MCP Gateway** (`mcp.chitty.cc/{service}/*`)
   - Routes MCP requests to `{service}.chitty.cc/mcp/*`
   - Aggregates tools from all services at `/tools`

3. **Docs Gateway** (`docs.chitty.cc/{service}/*`)
   - Routes to `{service}.chitty.cc/docs/*`
   - Provides documentation index at root

## Related Repositories

- **ChittyConnect** (`github.com/CHITTYOS/chittyconnect`) - Central intelligence hub
- **ChittyRegistry** (`github.com/CHITTYOS/chittyregistry`) - Service registry
- **ChittyAgent** (`github.com/CHITTYOS/chittyagent`) - Agent orchestrator
