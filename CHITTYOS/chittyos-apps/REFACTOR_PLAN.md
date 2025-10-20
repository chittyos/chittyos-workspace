# ChittyConnect Refactor Plan

## Current State Analysis

### What We Have
1. **chittyconnect/** - Basic connector (connect.chitty.cc)
   - 32 API endpoints ✅
   - MCP server ✅
   - GitHub integration ✅
   - PRODUCTION READY

2. **itschitty/** - Consciousness layer (itchitty.com)
   - ContextConsciousness™ engine ✅
   - MemoryCloude client ✅
   - 60% complete

### Issues to Fix
1. **Duplicate OpenAPI spec** - In both root and public/
2. **Missing handler exports** - Some handlers not fully implemented
3. **Documentation spread** - 8+ markdown files
4. **No tests** - 0% coverage
5. **Incomplete itschitty** - Needs main worker

---

## Refactor Strategy

### Phase 1: Clean Up connect.chitty.cc ✅

#### 1.1 Consolidate Files
- [x] Move openapi.json to public/ only
- [x] Create single DEPLOYMENT.md combining all deploy docs
- [x] Archive old docs to docs/ folder

#### 1.2 Optimize Code
- [ ] Combine similar route handlers
- [ ] Extract common middleware
- [ ] Add JSDoc comments
- [ ] Standardize error handling

#### 1.3 Add Critical Missing Pieces
- [x] webhook.js handler export ✅
- [ ] Input validation with Zod
- [ ] Request size limits
- [ ] Better error messages

### Phase 2: Complete itschitty.com 🚧

#### 2.1 Build Missing Components
- [ ] ChittyDNA integration layer
- [ ] Learning engine (simple MVP)
- [ ] Access control wrapper
- [ ] Main worker entry point

#### 2.2 Integration
- [ ] Connect to MemoryCloude service
- [ ] Wrap connect.chitty.cc API
- [ ] Add consciousness middleware
- [ ] Test context switching

### Phase 3: Deployment Prep ⚠️

#### 3.1 Infrastructure
- [ ] Create KV namespaces
- [ ] Set up D1 databases
- [ ] Configure secrets
- [ ] DNS setup

#### 3.2 Testing
- [ ] Smoke tests
- [ ] Load testing
- [ ] Integration testing
- [ ] User acceptance testing

#### 3.3 Documentation
- [ ] Single README per project
- [ ] API reference
- [ ] Quick start guide
- [ ] Troubleshooting guide

---

## Simplified Structure

### connect.chitty.cc (Final)
```
chittyconnect/
├── src/
│   ├── index.js                 # Main entry
│   ├── api/                     # API layer
│   │   ├── router.js
│   │   ├── middleware/
│   │   └── routes/
│   ├── mcp/                     # MCP layer
│   │   └── server.js
│   └── integrations/            # GitHub, etc.
├── public/
│   └── openapi.json
├── scripts/
│   └── generate-api-key.js
├── README.md                    # Single source of truth
├── wrangler.toml
└── package.json
```

### itschitty.com (Final)
```
itschitty/
├── src/
│   ├── index.js                 # Main worker
│   ├── consciousness/
│   │   ├── context-engine.js
│   │   └── memory-client.js
│   ├── chitty-dna/
│   │   └── integration.js
│   └── learning/
│       └── engine.js
├── schema.sql
├── README.md
├── wrangler.toml
└── package.json
```

---

## Priority Actions

### Immediate (Do Now)
1. ✅ Consolidate documentation
2. ✅ Remove duplicate files
3. ✅ Fix critical bugs
4. [ ] Add basic tests
5. [ ] Deploy connect.chitty.cc to staging

### Short-term (This Week)
1. [ ] Complete itschitty.com MVP
2. [ ] Integration testing
3. [ ] Deploy both to production
4. [ ] Monitor and iterate

### Long-term (Next Month)
1. [ ] Add comprehensive tests
2. [ ] Build developer portal
3. [ ] Add monitoring dashboard
4. [ ] Launch premium tier

---

## What to Keep vs Remove

### KEEP
- ✅ All route implementations
- ✅ MCP server
- ✅ Context engine
- ✅ MemoryCloude client
- ✅ Core architecture

### CONSOLIDATE
- 📝 8 markdown docs → 2 READMEs
- 📝 Duplicate OpenAPI specs → 1 in public/
- 📝 Similar handlers → Shared utilities

### REMOVE
- ❌ Redundant documentation
- ❌ Placeholder TODOs
- ❌ Unused imports
- ❌ Debug console.logs

---

## Refactor Checklist

### Code Quality
- [ ] Run linter on all files
- [ ] Remove console.logs
- [ ] Add JSDoc comments
- [ ] Standardize naming
- [ ] Extract constants

### Documentation
- [ ] Single README per project
- [ ] Clear quick start
- [ ] API reference
- [ ] Deployment guide
- [ ] Remove duplicates

### Testing
- [ ] Add vitest config
- [ ] Write smoke tests
- [ ] Add integration tests
- [ ] Mock external services

### Deployment
- [ ] Verify wrangler.toml
- [ ] Test in staging
- [ ] Load test
- [ ] Deploy to production

---

## Timeline

**Total Estimated Time: 6-8 hours**

- Refactor connect.chitty.cc: 2 hours
- Complete itschitty.com: 4 hours
- Testing & deployment: 2 hours

---

## Success Criteria

### Code
- ✅ No duplicate files
- ✅ All handlers exported
- ✅ Consistent error handling
- ✅ Clean directory structure

### Documentation
- ✅ Single README per project
- ✅ Clear deployment steps
- ✅ API reference available

### Deployment
- ✅ Staging works
- ✅ Production deployed
- ✅ Monitoring active
- ✅ Health checks passing

---

**Status**: Refactor plan ready
**Next**: Execute Phase 1 cleanup
