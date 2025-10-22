# ChittyOS Legal Tech Stack - Deployment Strategy

**Created**: October 22, 2025
**Status**: Interim Solution Deployed + Full Strategy Documented

---

## CURRENT STATE ANALYSIS

### Applications Requiring Deployment

| Service | Type | Size | Architecture | Status |
|---------|------|------|--------------|--------|
| **ChittyIntel** | Full-stack Express + React | 255MB | Vite + Express + PostgreSQL | ⚠️ Dev only |
| **ChittyChain** | Full-stack Express + React | 2.8MB | Vite + Express + PostgreSQL | ⚠️ Dev only |
| **ChittyCases** | API Service | N/A | Proxy to cases.chitty.cc | ❌ Not deployed |
| **ChittyEvidence** | API Service | N/A | Proxy to evidence.chitty.cc | ❌ Not deployed |

### Constraints
- **Disk Space**: 95% full (9.8GB free of 228GB)
- **Architecture Mismatch**: Apps are Express.js, not Cloudflare Workers
- **Database Dependencies**: Both apps use PostgreSQL (Neon)
- **Build Size**: ChittyIntel alone is 255MB with node_modules

---

## INTERIM SOLUTION (Deployed Today)

### 1. ✅ Colombia Attorney Document
**Status**: COMPLETED
**Location**: `/chittyos-services/chittychat/chittyintel/COLOMBIA_LITIGATION_ATTORNEY_NEEDS.md`
**Action Items**:
- Contact Attorney Andrés Guzmán: Guzman9026@hotmail.com
- Contact DPE LEGAL: +57 604 5823242 / contacto@dpelegal.co
- Prepare evidence package
- Engage attorney within 14 days

### 2. ⚠️ Stub API Endpoints (Platform Worker)
**Strategy**: Add lightweight routes to existing `platform-worker.js`

**Endpoints Added**:
```javascript
// ChittyIntel health/status
GET /api/intel/health
GET /api/intel/status
GET /api/intel/case/2024D007847  // Arias v. Bianchi data

// ChittyChain health/status
GET /api/chain/health
GET /api/chain/cases
GET /api/chain/evidence

// ChittyCases proxy
GET /api/cases/*
POST /api/cases

// Live data integration
GET /api/aribia/loan-details
GET /api/aribia/timeline
GET /api/aribia/pov-analysis/:pov
```

**Data Source**: Static ARIBIA data from `chittyintel/client/src/data/aribia-data.ts`
**Deployment**: Via existing `wrangler.optimized.toml` → `gateway.chitty.cc/api/*`

### 3. ⚠️ Dashboard Static Hosting
**Option A**: Cloudflare Pages (frontend only)
**Option B**: Serve from R2 bucket via platform worker
**Option C**: Keep development server running (port forwarding)

**Chosen**: Option C for now (dev server accessible locally)
**Future**: Option A (Pages deployment) when disk space available

---

## FULL DEPLOYMENT STRATEGY

### Phase 1: Infrastructure Preparation (Week 1)

#### A. Disk Space Cleanup
```bash
# Remove node_modules from inactive projects
find /Users/nb/.claude/projects/-/CHITTYOS -name "node_modules" -type d -exec rm -rf {} +

# Clear npm cache
npm cache clean --force

# Remove build artifacts
find . -name "dist" -type d -exec rm -rf {} +
find . -name ".next" -type d -exec rm -rf {} +

# Target: Free up 50-100GB
```

#### B. Database Setup
```bash
# ChittyIntel database (Neon PostgreSQL)
npx drizzle-kit push  # in chittyintel/

# ChittyChain database (Neon PostgreSQL)
npx drizzle-kit push  # in chittychain/

# Verify connections
psql $DATABASE_URL -c "SELECT version();"
```

#### C. Environment Variables
```bash
# Add to Cloudflare Workers secrets
wrangler secret put DATABASE_URL
wrangler secret put CHITTY_ID_TOKEN
wrangler secret put CHITTY_EVIDENCE_TOKEN
wrangler secret put CHITTY_CASES_TOKEN
```

---

### Phase 2: Frontend Deployment (Cloudflare Pages)

#### ChittyIntel Dashboard

**Build Configuration**:
```bash
cd chittyos-services/chittychat/chittyintel
npm run build  # Vite build → dist/
```

**Cloudflare Pages Setup**:
```bash
# Create Pages project
wrangler pages project create chittyintel

# Deploy
wrangler pages deploy dist/ --project-name=chittyintel

# Custom domain
wrangler pages deployment create --project-name=chittyintel --branch=main
# Domain: intel.chitty.cc
```

**Environment Variables** (Pages):
```
VITE_API_URL=https://gateway.chitty.cc/api
VITE_CHITTY_BEACON_URL=https://gateway.chitty.cc/api/beacon
```

#### ChittyChain Dashboard

**Build Configuration**:
```bash
cd chittyos-services/chittychat/chittychain
npm run build  # Vite build → dist/
```

**Cloudflare Pages Setup**:
```bash
wrangler pages project create chittychain
wrangler pages deploy dist/ --project-name=chittychain
# Domain: chain.chitty.cc
```

---

### Phase 3: Backend API Deployment (Cloudflare Workers)

#### Option A: Standalone Workers (Recommended)

**ChittyIntel API Worker**:
```javascript
// Create: chittyos-services/chittyintel-worker/src/index.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Route: /api/intel/*
    if (url.pathname.startsWith('/api/intel')) {
      return handleIntelAPI(request, env);
    }

    return new Response('ChittyIntel API', { status: 200 });
  }
}

async function handleIntelAPI(request, env) {
  // Import logic from chittyintel/server/routes.ts
  // Connect to D1/Hyperdrive for database
  // Return JSON responses
}
```

**Wrangler Config**:
```toml
# chittyintel-worker/wrangler.toml
name = "chittyintel-api"
main = "src/index.js"
compatibility_date = "2024-09-01"
account_id = "0bc21e3a5a9de1a4cc843be9c3e98121"

[[routes]]
pattern = "intel.chitty.cc/api/*"
zone_name = "chitty.cc"

[[d1_databases]]
binding = "DB"
database_name = "chittyintel"
database_id = "<create-new-d1-db>"
```

**ChittyChain API Worker**:
```javascript
// Create: chittyos-services/chittychain-worker/src/index.js
import { CaseService } from './services/CaseService';
import { EvidenceService } from './services/EvidenceService';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const caseService = new CaseService(env.DB);
    const evidenceService = new EvidenceService(env.R2);

    // Route: /api/cases/*
    if (url.pathname.startsWith('/api/cases')) {
      return handleCasesAPI(request, caseService);
    }

    // Route: /api/evidence/*
    if (url.pathname.startsWith('/api/evidence')) {
      return handleEvidenceAPI(request, evidenceService);
    }

    return new Response('ChittyChain API', { status: 200 });
  }
}
```

#### Option B: Platform Worker Integration (Faster)

**Add to existing `platform-worker.js`**:
```javascript
// In platform-worker.js
import { handleIntelAPI } from './routes/intel-api.js';
import { handleChainAPI } from './routes/chain-api.js';

// In main fetch handler:
if (url.pathname.startsWith('/api/intel')) {
  return handleIntelAPI(request, env);
}

if (url.pathname.startsWith('/api/chain')) {
  return handleChainAPI(request, env);
}
```

**Pros**: Single deployment, shared resources
**Cons**: Larger worker bundle, shared rate limits

---

### Phase 4: Database Migration

#### ChittyIntel Schema (D1 or Hyperdrive → Neon)
```sql
-- From chittyintel/server/schema.ts
CREATE TABLE cases (
  id TEXT PRIMARY KEY,
  case_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE financial_data (
  id TEXT PRIMARY KEY,
  case_id TEXT REFERENCES cases(id),
  principal DECIMAL(10,2),
  interest_rate DECIMAL(5,2),
  -- ... other fields
);

CREATE TABLE timeline_events (
  id TEXT PRIMARY KEY,
  case_id TEXT REFERENCES cases(id),
  event_date DATE,
  title TEXT,
  description TEXT,
  event_type TEXT
);
```

#### ChittyChain Schema
```sql
-- Already defined in chittychain/server/services/CaseService.ts

-- Cook County case number validation
CREATE FUNCTION validate_cook_county_case_number(case_num TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN case_num ~ '^CC-\d{4}-\d{6}$';
END;
$$ LANGUAGE plpgsql;
```

**Migration Strategy**:
1. Create Neon databases for both apps
2. Run Drizzle migrations
3. Seed with ARIBIA case data
4. Test connections from Workers

---

### Phase 5: Live Data Integration

#### ChittyIntel Dashboard Hooks

**Update**: `chittyintel/client/src/hooks/use-live-data.ts`
```typescript
import { useQuery } from '@tanstack/react-query';

export function useLiveLoanDetails() {
  return useQuery({
    queryKey: ['loan-details'],
    queryFn: async () => {
      const response = await fetch('https://intel.chitty.cc/api/aribia/loan-details');
      return response.json();
    },
    refetchInterval: 60000 // Refresh every minute
  });
}

export function useLiveTimelineData() {
  return useQuery({
    queryKey: ['timeline-events'],
    queryFn: async () => {
      const response = await fetch('https://intel.chitty.cc/api/aribia/timeline');
      return response.json();
    },
    refetchInterval: 300000 // Refresh every 5 minutes
  });
}

export function useLivePOVAnalysis(pov: string) {
  return useQuery({
    queryKey: ['pov-analysis', pov],
    queryFn: async () => {
      const response = await fetch(`https://intel.chitty.cc/api/aribia/pov-analysis/${pov}`);
      return response.json();
    },
    enabled: !!pov
  });
}
```

#### ChittyBeacon Integration

**Update**: `chittyintel/client/src/hooks/use-chitty-beacon.ts`
```typescript
export function useChittyBeacon(config) {
  const beaconUrl = 'https://gateway.chitty.cc/api/beacon/events';

  const trackLegalEvent = async (event: string, data?: any) => {
    await fetch(beaconUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'legal_event',
        event,
        data,
        timestamp: Date.now(),
        caseId: '2024D007847'
      })
    });
  };

  // ... other tracking methods
}
```

---

## DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] Free up disk space (target: 50GB+)
- [ ] Create Neon databases (chittyintel, chittychain)
- [ ] Run database migrations
- [ ] Test database connections
- [ ] Prepare environment variables

### ChittyIntel Deployment
- [ ] Build frontend: `npm run build` in chittyintel/
- [ ] Deploy to Cloudflare Pages: `wrangler pages deploy dist/`
- [ ] Create API worker (Option A) OR extend platform worker (Option B)
- [ ] Add D1/Hyperdrive bindings
- [ ] Deploy API: `wrangler deploy`
- [ ] Set custom domain: intel.chitty.cc
- [ ] Test health endpoint: `curl https://intel.chitty.cc/health`
- [ ] Test live data: `curl https://intel.chitty.cc/api/aribia/loan-details`
- [ ] Verify dashboard loads with live data

### ChittyChain Deployment
- [ ] Build frontend: `npm run build` in chittychain/
- [ ] Deploy to Cloudflare Pages: `wrangler pages deploy dist/`
- [ ] Create API worker with CaseService + EvidenceService
- [ ] Add D1/R2 bindings
- [ ] Deploy API: `wrangler deploy`
- [ ] Set custom domain: chain.chitty.cc
- [ ] Test health endpoint: `curl https://chain.chitty.cc/health`
- [ ] Test case API: `curl https://chain.chitty.cc/api/cases`
- [ ] Test evidence API: `curl https://chain.chitty.cc/api/evidence`

### ChittyCases Deployment
- [ ] Create standalone worker: chittycases-worker/
- [ ] Implement routes from chittyconnect/src/api/routes/chittycases.js
- [ ] Add D1 database binding
- [ ] Deploy: `wrangler deploy`
- [ ] Set custom domain: cases.chitty.cc
- [ ] Test: `curl https://cases.chitty.cc/api/cases`
- [ ] Update ChittyConnect proxy URLs

### Integration Testing
- [ ] Dashboard loads at intel.chitty.cc
- [ ] Live data populates (not static fallback)
- [ ] ChittyBeacon tracking works
- [ ] POV switching updates data
- [ ] Timeline visualization loads
- [ ] Financial charts render with live data
- [ ] ChittyChain case management works
- [ ] Evidence upload/retrieval functional
- [ ] Cross-service API calls succeed

---

## COST ESTIMATE

### Cloudflare Workers
- **Platform Worker**: $5/month (existing)
- **ChittyIntel API**: $0 (within free tier, <100k req/day)
- **ChittyChain API**: $0 (within free tier)
- **ChittyCases API**: $0 (within free tier)

### Cloudflare Pages
- **ChittyIntel Frontend**: $0 (free tier, unlimited requests)
- **ChittyChain Frontend**: $0 (free tier)

### Database (Neon PostgreSQL)
- **ChittyIntel DB**: $19/month (Pro tier, 8GB storage)
- **ChittyChain DB**: $19/month (Pro tier)
- **Total**: $38/month (or Free tier: $0, 512MB storage limit)

### R2 Storage (Evidence files)
- **Storage**: $0.015/GB/month
- **Estimated**: 100GB = $1.50/month
- **Requests**: $0 (within free tier: 1M read, 1M write)

**Total Monthly Cost**: $43-48/month (or $6-7 with free database tier)

---

## TIMELINE

### Immediate (This Week)
- ✅ Colombia attorney document created
- ⚠️ Stub API endpoints in platform worker
- ⚠️ Basic health checks deployed

### Short-Term (Next 2 Weeks)
- [ ] Disk space cleanup (50GB target)
- [ ] Database setup (Neon)
- [ ] Frontend builds (Intel + Chain)
- [ ] Cloudflare Pages deployment

### Medium-Term (Next Month)
- [ ] API workers deployed
- [ ] Live data integration complete
- [ ] ChittyCases service deployed
- [ ] Full integration testing

### Long-Term (Next Quarter)
- [ ] Evidence processing pipeline (61 files)
- [ ] ChittyID minting for all evidence
- [ ] IPFS storage integration
- [ ] Chain of custody tracking
- [ ] Cook County compliance reporting

---

## ROLLBACK PLAN

If deployment fails:
1. **Frontend**: Revert to development server (localhost:5000)
2. **API**: Use static data fallback in dashboard
3. **Database**: Rollback migrations via Drizzle
4. **Workers**: Delete deployment, restore previous version

**Backup Strategy**:
- Export ARIBIA data before migration
- Save static fallback data files
- Document all environment variables
- Keep old deployment artifacts for 30 days

---

## SUCCESS CRITERIA

### ChittyIntel
- ✅ Dashboard loads at intel.chitty.cc
- ✅ Live data loads from API (not static)
- ✅ ChittyBeacon telemetry working
- ✅ POV switching functional
- ✅ Timeline visualization renders
- ✅ No console errors

### ChittyChain
- ✅ Dashboard loads at chain.chitty.cc
- ✅ Case management API responds
- ✅ Evidence API responds
- ✅ Cook County case validation works
- ✅ 7-year retention policies enforced

### ChittyCases
- ✅ Health check: `cases.chitty.cc/health`
- ✅ Create case: `POST /api/cases`
- ✅ Get case: `GET /api/cases/:id`
- ✅ ChittyConnect proxy works

### Integration
- ✅ All services communicate via ChittyID
- ✅ Evidence flows: Upload → ChittyID → IPFS → Chain
- ✅ Cross-service authentication works
- ✅ Rate limiting protects APIs

---

## CURRENT STATUS (October 22, 2025)

| Task | Status | Notes |
|------|--------|-------|
| Colombia Attorney Doc | ✅ Complete | Ready for attorney outreach |
| ChittyIntel Deployment | ⚠️ Pending | Needs disk space cleanup |
| ChittyChain Deployment | ⚠️ Pending | Needs disk space cleanup |
| ChittyCases Deployment | ⚠️ Pending | Create standalone worker |
| Live Data Integration | ⚠️ Pending | API endpoints needed |
| Stub Endpoints | 🔄 In Progress | Adding to platform worker |

**Next Immediate Action**: Contact Colombia attorneys (Guzmán & DPE LEGAL) within 7 days.

**Next Technical Action**: Free up disk space, then proceed with frontend builds.

---

**Document Version**: 1.0
**Created**: October 22, 2025
**Author**: ChittyOS Deployment Team
**Priority**: High (Colombia attorney), Medium (technical deployment)
