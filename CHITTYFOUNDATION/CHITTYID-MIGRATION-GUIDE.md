# ChittyID Migration Guide - v1.x to v2.0

## 🚨 CRITICAL: SERVICE OR FAIL Principle

**NEVER generate ChittyIDs locally or attempt format conversion!**

- ✅ **ALWAYS** request IDs from `id.chitty.cc` service
- ❌ **NEVER** generate IDs locally (no fallbacks, no conversions)
- ❌ **NEVER** try to convert old format to new format
- ✅ **ALWAYS** use `@chittyos/chittyid-client` package

Old IDs are **deprecated**. To migrate: **request new IDs from service**.

---

## ⚠️ Breaking Changes Summary

### 1. ChittyID Format Change
- **Old Format** (DEPRECATED): `CHITTY-ENTITY-SEQUENCE-CHECKSUM`
- **New Format** (Official): `VV-G-LLL-SSSS-T-YM-C-X`

### 2. SERVICE OR FAIL Enforcement
- **Old Behavior**: Fallback to local generation when service unavailable
- **New Behavior**: Throws error when service unavailable (no fallbacks)

### 3. Terminology Update
- **Old**: `generateChittyID()`, `generator`, `create`
- **New**: `mintChittyID()`, `client`, `request`

---

## Migration Timeline

| Version | Status | Legacy Support | Action Required |
|---------|--------|----------------|-----------------|
| **v1.0** | ✅ Current | ✅ Supported with warnings | Update recommended |
| **v1.5** | Q4 2025 | ⚠️ Deprecated | Must update |
| **v2.0** | Q1 2026 | ❌ Removed | Breaking |

---

## Step-by-Step Migration

### Step 1: Install New Client Package

```bash
npm install @chittyos/chittyid-client@latest
```

### Step 2: Update Import Statements

**Before:**
```javascript
import { generateEmailChittyID } from './utils/chittyid-generator';
```

**After:**
```javascript
import ChittyIDClient from '@chittyos/chittyid-client';

const client = new ChittyIDClient({
  serviceUrl: 'https://id.chitty.cc/v1',
  apiKey: process.env.CHITTY_ID_TOKEN
});
```

### Step 3: Update Function Calls

**Before:**
```javascript
const id = await generateEmailChittyID(message);
```

**After:**
```javascript
const id = await client.mint({
  entity: 'PEO',
  name: message.from,
  metadata: {
    email: message.from,
    subject: message.subject
  }
});
```

### Step 4: Handle Errors (SERVICE OR FAIL)

**Before (with fallback):**
```javascript
try {
  id = await generateChittyID();
} catch (error) {
  // Old code expected fallback ID here
  id = `FALLBACK-${Date.now()}`;
}
```

**After (no fallback):**
```javascript
try {
  id = await client.mint({ entity: 'PEO', name: 'User' });
} catch (error) {
  // SERVICE OR FAIL - handle gracefully
  console.error('ChittyID service unavailable:', error);
  // Return error to user or retry with exponential backoff
  throw new Error('Identity service unavailable - please try again');
}
```

### Step 5: Update Validation Logic

**Before:**
```javascript
const pattern = /^CHITTY-[A-Z]+-[A-Z0-9]+-[A-Z0-9]+$/;
const isValid = pattern.test(chittyId);
```

**After:**
```javascript
import { validateChittyID } from '@chittyos/chittyid-client';

const result = await validateChittyID(chittyId);
if (!result.valid) {
  throw new Error('Invalid ChittyID format');
}
```

---

## Backward Compatibility (v1.x only)

During v1.x, **both formats are accepted** with deprecation warnings:

```javascript
// ✅ Official format - no warning
"AA-B-CCC-1234-D-25-E-F"

// ⚠️ Legacy format - warning logged
"CHITTY-PEO-123-ABC"
// Console: ⚠️ DEPRECATED ChittyID format detected...
```

**Warnings will appear in:**
- Server logs
- Browser console
- Application monitoring tools

---

## Entity Type Mapping

Update entity types when minting:

| Old Format | New Entity Type |
|------------|----------------|
| `CHITTY-PEO-*` | `entity: 'PEO'` |
| `CHITTY-PLACE-*` | `entity: 'PLACE'` |
| `CHITTY-PROP-*` | `entity: 'PROP'` |
| `CHITTY-EVNT-*` | `entity: 'EVNT'` |
| `CHITTY-AUTH-*` | `entity: 'AUTH'` |
| `CHITTY-INFO-*` | `entity: 'INFO'` |
| `CHITTY-FACT-*` | `entity: 'FACT'` |
| `CHITTY-CONTEXT-*` | `entity: 'CONTEXT'` |
| `CHITTY-ACTOR-*` | `entity: 'ACTOR'` |

---

## Testing Your Migration

### 1. Check for Deprecation Warnings

```bash
# Run your app and check logs for warnings
grep "DEPRECATED ChittyID" logs/*.log
```

### 2. Validate All IDs

```javascript
import ChittyIDClient from '@chittyos/chittyid-client';

const client = new ChittyIDClient();

// Test validation
const testIds = [
  'AA-B-CCC-1234-D-25-E-F',  // Should pass
  'CHITTY-PEO-123-ABC'        // Should warn
];

for (const id of testIds) {
  const isValid = client.validateFormat(id);
  console.log(`${id}: ${isValid ? '✅' : '❌'}`);
}
```

### 3. Test Error Handling

```javascript
// Simulate service failure
const client = new ChittyIDClient({
  serviceUrl: 'https://fake-service.invalid',
  timeout: 1000
});

try {
  await client.mint({ entity: 'PEO' });
} catch (error) {
  console.log('✅ Error handling works:', error.message);
}
```

---

## Deployment Strategy

### Recommended Rollout

1. **Week 1**: Update development environments
   - Install `@chittyos/chittyid-client`
   - Update code, test locally
   - Monitor deprecation warnings

2. **Week 2-3**: Deploy to staging
   - Run integration tests
   - Verify error handling
   - Check monitoring/alerts

3. **Week 4**: Production deployment
   - Deploy during low-traffic window
   - Monitor error rates
   - Have rollback plan ready

4. **Ongoing**: Monitor and clean up
   - Track deprecation warnings
   - Update all clients before v2.0
   - Remove legacy code paths

---

## API Changes Reference

### ChittyIDClient Constructor

```typescript
new ChittyIDClient({
  serviceUrl?: string;    // Default: 'https://id.chitty.cc/v1'
  apiKey?: string;        // Optional authentication
  timeout?: number;       // Default: 10000ms
})
```

### Methods

| Old Function | New Method | Notes |
|-------------|------------|-------|
| `generateEmailChittyID()` | `client.mint({ entity: 'PEO' })` | Generic mint method |
| `generateDocumentChittyID()` | `client.mint({ entity: 'PROP' })` | Use appropriate entity |
| `generateCaseChittyID()` | `client.mint({ entity: 'EVNT' })` | Use appropriate entity |
| `validateChittyID()` | `client.validate()` | Returns ValidationResult |
| `batchGenerateChittyIDs()` | `client.mintBatch()` | Batch operations |

---

## Common Issues & Solutions

### Issue: "Invalid ChittyID format" errors

**Cause**: Using old format IDs
**Solution**: **Request new IDs from id.chitty.cc service**

```javascript
// ❌ DO NOT try to convert old IDs
// ❌ DO NOT generate new format locally

// ✅ Request NEW ID from service
const newId = await client.mint({
  entity: 'PEO',
  name: 'User Name',
  metadata: { /* migration context */ }
});

// Deprecate old ID in your database
await db.deprecateId(oldId, newId);
```

### Issue: "ChittyID service unavailable" errors

**Cause**: SERVICE OR FAIL - no fallback
**Solution**: Implement retry logic with exponential backoff:

```javascript
async function mintWithRetry(request, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.mint(request);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000); // Exponential backoff
    }
  }
}
```

### Issue: Console flooded with deprecation warnings

**Cause**: Using legacy format IDs
**Solution**: Update IDs or filter warnings temporarily:

```javascript
// Temporary filter (remove before v2.0)
if (process.env.NODE_ENV === 'production') {
  console.warn = (msg) => {
    if (!msg.includes('DEPRECATED ChittyID')) {
      originalConsoleWarn(msg);
    }
  };
}
```

---

## Need Help?

- **Documentation**: https://docs.chitty.cc/chittyid
- **GitHub Issues**: https://github.com/ChittyOS/chittyid-client/issues
- **Support**: foundation@chitty.cc

---

**Migration Deadline**: Q1 2026 (v2.0 release)
**Current Version**: v1.0.0 (legacy support enabled)
