# SOP: Deployment Tracking & Notion Registry Updates

## Overview

This SOP documents how to track ChittyOS gateway deployments in the Notion Service Registry.

## Prerequisites

### 1. Notion Access
```bash
# Via 1Password CLI (preferred)
op run --env-file=/Volumes/chitty/config/notion.env -- [command]

# Or set token directly
export NOTION_TOKEN="<your-token>"
```

### 2. Database IDs

| Registry | Database ID | Purpose |
|----------|-------------|---------|
| Service Registry | `0036bf44-6768-43d9-b911-aa951fc6289a` | ChittyOS services |
| Domain Registry | `6a5fac97-eb1f-46a0-b2e7-589e94973b76` | Domain configurations |
| Systems Registry | `23dd1850-f8c5-4b45-b4dc-8ba0e20efaff` | Infrastructure |

---

## Gateway Services to Track

### Production Gateways (Deployed 2026-01-07)

| Service | Domain | Type | Status | Worker |
|---------|--------|------|--------|--------|
| getchitty | get.chitty.cc | Platform | Live | getchitty-production |
| chittyapi | api.chitty.cc | Platform | Live | chittyapi-production |
| chittymcp | mcp.chitty.cc | Platform | Live | chittymcp-production |
| chittydocs | docs.chitty.cc | Platform | Live | chittydocs-production |
| gitchitty | git.chitty.cc | Platform | Live | gitchitty-production |

### Service Details

#### getchitty (get.chitty.cc)
- **Description**: NL Gateway + Discovery - Natural language queries and service recommendations
- **Features**: Intent classification, /ask endpoint, /discover, /recommend
- **Routes**: 26 services indexed
- **Workspace**: `/Volumes/chitty/workspace/getchitty`

#### chittyapi (api.chitty.cc)
- **Description**: API Proxy Gateway - Routes to {service}.chitty.cc/api/*
- **Features**: Dynamic route discovery, caching, CORS
- **Routes**: 24 API routes
- **Workspace**: `/Volumes/chitty/workspace/chittyapi`

#### chittymcp (mcp.chitty.cc)
- **Description**: MCP Tool Aggregator - Aggregates MCP tools from all services
- **Features**: /tools endpoint, tool discovery, service routing
- **Workspace**: `/Volumes/chitty/workspace/chittymcp`

#### chittydocs (docs.chitty.cc)
- **Description**: Documentation Index - Service documentation gateway
- **Features**: HTML index, service categorization, doc proxy
- **Workspace**: `/Volumes/chitty/workspace/chittydocs`

#### gitchitty (git.chitty.cc)
- **Description**: Package Registry - Install scripts and package metadata
- **Features**: /install scripts, R2 storage, version management
- **Workspace**: `/Volumes/chitty/workspace/gitchitty`

---

## Registration Procedure

### Step 1: Query Existing Services
```bash
curl -s -X POST "https://api.notion.com/v1/databases/0036bf44-6768-43d9-b911-aa951fc6289a/query" \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '{"filter": {"property": "Category", "select": {"equals": "Platform"}}}' | jq '.results[].properties.Name.title[0].text.content'
```

### Step 2: Create Service Entry
```bash
curl -s -X POST "https://api.notion.com/v1/pages" \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '{
    "parent": {"database_id": "0036bf44-6768-43d9-b911-aa951fc6289a"},
    "properties": {
      "Name": {"title": [{"text": {"content": "getchitty"}}]},
      "Category": {"select": {"name": "Platform"}},
      "Status": {"select": {"name": "Live"}},
      "Domain": {"url": "https://get.chitty.cc"},
      "Description": {"rich_text": [{"text": {"content": "NL Gateway + Discovery"}}]},
      "GitHub": {"url": "https://github.com/CHITTYOS/getchitty"}
    }
  }'
```

### Step 3: Update Deployment Status
```bash
# Get page ID from query, then update
curl -s -X PATCH "https://api.notion.com/v1/pages/{PAGE_ID}" \
  -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '{
    "properties": {
      "Status": {"select": {"name": "Live"}},
      "Last Deployed": {"date": {"start": "2026-01-07"}}
    }
  }'
```

---

## Deployment Checklist

### Before Deployment
- [ ] Code reviewed and tested locally
- [ ] `pnpm build` succeeds in workspace
- [ ] Type checks pass (`npx tsc --noEmit`)

### Deployment Commands
```bash
cd /Volumes/chitty/workspace

# Deploy individual gateway
pnpm --filter getchitty deploy      # Staging
pnpm --filter getchitty deploy:prod # Production

# Or use wrangler directly
cd getchitty && npx wrangler deploy --env production
```

### After Deployment
- [ ] Health check passes (`curl https://{domain}/health`)
- [ ] Functional test passes
- [ ] Update Notion Service Registry status
- [ ] Update deployment log (if tracking)

---

## Automated Sync (Future)

The ChittyHelper agent at `agent.chitty.cc/helper/` syncs with the registry every 6 hours. To trigger manual sync:

```bash
curl -X POST "https://agent.chitty.cc/helper/sync"
```

---

## Quick Reference

### Health Check All Gateways
```bash
for domain in get api mcp docs git; do
  echo -n "$domain.chitty.cc: "
  curl -s "https://$domain.chitty.cc/health" | jq -r '.status // "error"'
done
```

### Workspace Location
```
/Volumes/chitty/workspace/
├── chittycore/    # @chittyos/core shared lib
├── chittyapi/     # api.chitty.cc
├── chittymcp/     # mcp.chitty.cc
├── chittydocs/    # docs.chitty.cc
├── getchitty/     # get.chitty.cc (NL gateway)
└── gitchitty/     # git.chitty.cc
```

### Key Files
- Registry client: `chittycore/src/registry.ts`
- Intent classifier: `getchitty/src/intent.ts`
- Workspace config: `pnpm-workspace.yaml`
- This SOP: `docs/SOP-DEPLOYMENT-TRACKING.md`

---

## Contact

For issues with:
- **Notion API**: Check 1Password connection (`op signin`)
- **Deployments**: Check Cloudflare dashboard
- **Registry sync**: Check ChittyHelper logs

---

*Last updated: 2026-01-07*
*Gateway stack v1.0 deployed*
