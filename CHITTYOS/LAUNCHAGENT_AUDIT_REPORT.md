# LaunchAgent Audit Report
**Date**: 2025-10-18
**Generated**: ChittyOS Framework Core
**Session**: session-8c21b5bf

---

## Executive Summary

Critical infrastructure issues discovered in LaunchAgent configuration:
- **27 phantom services** with exit code 78 (configuration errors)
- **Only 1 plist file** exists for ChittyOS services
- **Path case mismatch** in storage-daemon configuration
- **Improper naming conventions** (com.chitty.* instead of cc.chitty.*)

---

## Running Services Analysis

### ✅ Healthy Services (Exit Code 0)
| Service | PID | Status | Notes |
|---------|-----|--------|-------|
| `com.user.storage-daemon` | 84577 | Running | ⚠️ Path mismatch: points to /chittyapps/ |
| `com.chittyos.todo-sync` | 56070 | Running | No plist found |
| `com.chittyos.native-overlay` | - | Loaded | No plist found |
| `com.chittyos.secret-rotation` | - | Loaded | No plist found |
| `com.chittyos.todo-watcher` | - | Loaded | No plist found |

### ⚠️ Running Services (Exit Code 1)
| Service | PID | Status | Notes |
|---------|-----|--------|-------|
| `com.chittyos.drivesync` | 94368 | Running with errors | No plist found |

### ❌ Failed Services (Exit Code 78 - Configuration Error)

All of the following services have **exit code 78** but **NO plist files exist**:

```
com.chittyos.deepscan
com.chitty.chittymonitor
com.chittyos.checkpoint
com.chittyos.system
com.chitty.chittyledger
com.mariekondo.storage
com.chitty.chittycounsel
com.chitty.chittychain
com.claude.cleanup
com.chitty.chittyid
com.chitty.chittycases
com.chittyos.mcp.diagnostics
com.chitty.chittychat
com.chitty.chittyoscore
com.chitty.chittybeacon
com.chittyos.chittychat
com.chitty.chittyfinance
com.chittyos.email
```

**Total phantom services**: 18 with exit code 78

---

## Plist File Inventory

### ~/Library/LaunchAgents
Only **4 plist files** found:
1. ✅ `com.dropbox.dropboxmacupdate.xpcservice.plist` (Dropbox)
2. ⚠️ `com.user.storage-daemon.plist` (ChittyOS - has path issue)
3. ✅ `com.dropbox.DropboxUpdater.wake.plist` (Dropbox)
4. ✅ `com.dropbox.dropboxmacupdate.agent.plist` (Dropbox)

### /Library/LaunchAgents
**No ChittyOS-related plist files found**

### /Library/LaunchDaemons
**No ChittyOS-related plist files found**

### ~/Library/LaunchDaemons
**No ChittyOS-related plist files found**

---

## Critical Issues

### 1. Phantom Services
**Impact**: HIGH
**Severity**: CRITICAL

27 services are loaded in launchctl but have no corresponding plist files:
- Services showing exit code 78 (configuration error)
- No way to manage these services
- Unknown source of registration
- Cannot unload properly without plist

**Likely Cause**: Services were registered programmatically or from removed plist files that are still cached by launchd.

### 2. Path Case Mismatch
**Impact**: MEDIUM
**Severity**: HIGH

`com.user.storage-daemon.plist` points to:
```
/Users/nb/.claude/projects/-/chittyapps/chittycleaner/src/daemon.js
```

But both directories exist:
- `/Users/nb/.claude/projects/-/chittyapps/` (lowercase) ✅
- `/Users/nb/.claude/projects/-/CHITTYAPPS/` (uppercase) ✅

**Current Status**: Service is running (PID 84577) with lowercase path.

### 3. Improper Naming Conventions
**Impact**: LOW
**Severity**: MEDIUM

ChittyOS services use incorrect reverse domain naming:
- ❌ `com.chitty.*` (wrong)
- ❌ `com.chittyos.*` (wrong)
- ❌ `com.user.*` (wrong)
- ❌ `com.mariekondo.*` (wrong - should be part of ChittyOS)
- ❌ `com.claude.*` (wrong)

**Correct format**:
- ✅ `cc.chitty.chittyid`
- ✅ `cc.chitty.chittysync`
- ✅ `cc.chitty.storage-daemon`

---

## ChittyRegistry Integration Analysis

### Services Registered in ChittyRegistry

**36 total services** registered at `https://registry.chitty.cc`:

#### Production Services (Active)
- ai-gateway (ai.chitty.cc)
- langchain (langchain.chitty.cc)
- mcp-agents (mcp.chitty.cc)
- agents (agents.chitty.cc)
- unified (unified.chitty.cc)
- openai-oauth (openai.chitty.cc)
- sync (sync.chitty.cc) ← **ChittySync**
- api (api.chitty.cc)
- beacon (beacon.chitty.cc)
- identity (id.chitty.cc) ← **ChittyID**
- auth (auth.chitty.cc) ← **ChittyAuth**
- registry (registry.chitty.cc) ← **ChittyRegistry**
- canon (canon.chitty.cc)
- chat (chat.chitty.cc)
- schema (schema.chitty.cc)

#### Development Services
- verify (verify.chitty.cc)
- vectorize (vectorize.chitty.cc)
- hyperdrive (hyperdrive.chitty.cc)
- workflows (workflows.chitty.cc)
- email (email.chitty.cc)
- viewer (viewer.chitty.cc)
- audit (audit.chitty.cc)
- assets (assets.chitty.cc)
- cdn (cdn.chitty.cc)
- docs (docs.chitty.cc)
- www (www.chitty.cc)

#### Staging/Dev Environments
- staging (staging.chitty.cc)
- staging-ai (staging-ai.chitty.cc)
- staging-api (staging-api.chitty.cc)
- staging-auth (staging-auth.chitty.cc)
- staging-id (staging-id.chitty.cc)
- staging-sync (staging-sync.chitty.cc)
- dev (dev.chitty.cc)
- dev-ai (dev-ai.chitty.cc)
- dev-api (dev-api.chitty.cc)
- dev-id (dev-id.chitty.cc)

### Registry Usage in Codebase

**140 files** reference ChittyRegistry:

**Key Integration Points**:
1. **ChittyChat Platform** (`chittyos-services/chittychat/`)
   - `src/platform-worker.js` - Registry client integration
   - `server/services/registry-client.ts` - Service discovery
   - `server/services/enhanced-registry-client.ts` - Smart recommendations

2. **ChittyRouter** (`chittyos-services/chittyrouter/`)
   - `src/routing/unified-service-router.js` - Service routing
   - `src/utils/service-discovery.js` - Dynamic service discovery
   - `src/utils/registry.js` - Registry client

3. **ChittyRegistry** (Self)
   - `src/universal-registry-worker.js` - Main worker
   - `src/worker.js` - Legacy worker
   - Cloudflare Workers deployment at registry.chitty.cc

4. **ChittyCheck**
   - Validates registry service health
   - Checks service connectivity

---

## Recommended Actions

### Priority 1: Unload Phantom Services
```bash
# Create unload script
for service in \
  com.chittyos.deepscan \
  com.chitty.chittymonitor \
  com.chittyos.checkpoint \
  com.chittyos.system \
  com.chitty.chittyledger \
  com.mariekondo.storage \
  com.chitty.chittycounsel \
  com.chitty.chittychain \
  com.claude.cleanup \
  com.chitty.chittyid \
  com.chitty.chittycases \
  com.chittyos.mcp.diagnostics \
  com.chitty.chittychat \
  com.chitty.chittyoscore \
  com.chitty.chittybeacon \
  com.chittyos.chittychat \
  com.chitty.chittyfinance \
  com.chittyos.email
do
  echo "Unloading: $service"
  launchctl bootout gui/$(id -u)/$service 2>/dev/null || true
done
```

### Priority 2: Fix storage-daemon Path
**Option A**: Keep lowercase (current working state)
```bash
# No action needed - service is working
```

**Option B**: Migrate to uppercase
```bash
# 1. Unload current service
launchctl bootout gui/$(id -u)/com.user.storage-daemon

# 2. Update plist path
# Change: /chittyapps/ → /CHITTYAPPS/

# 3. Reload
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.user.storage-daemon.plist
```

### Priority 3: Standardize Naming Conventions
Create new plists with proper naming:
```
cc.chitty.storage-daemon
cc.chitty.todo-sync
cc.chitty.todo-watcher
cc.chitty.secret-rotation
cc.chitty.native-overlay
cc.chitty.drivesync
```

### Priority 4: Document Active Services
Create service inventory with:
- Service name (proper cc.chitty.* format)
- Purpose
- Dependencies
- Health checks
- Registry integration

---

## Questions for User

1. **Phantom services source**: Where are these services being registered from?
2. **Path preference**: Keep /chittyapps/ (lowercase) or migrate to /CHITTYAPPS/?
3. **.claude.json.lock prevention**: Where is this mechanism implemented?
4. **Service consolidation**: Should these be managed through ChittyRegistry instead?
5. **Naming migration**: Approve batch rename from com.* to cc.chitty.*?

---

## Next Steps

1. ✅ Audit completed
2. ⏭️ Await user decision on phantom services
3. ⏭️ Fix storage-daemon path (once decision made)
4. ⏭️ Create proper plist files with cc.chitty.* naming
5. ⏭️ Register services in ChittyRegistry
6. ⏭️ Search for .claude.json.lock prevention code

---

**Report Status**: DRAFT
**Requires**: User approval for remediation actions
