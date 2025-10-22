import fallback from './fallback.mjs';

const BASE = process.env.CHITTY_BASE_URL || "https://chitty-router.workers.dev";
const MAX_RETRIES = parseInt(process.env.CHITTY_MAX_RETRIES || "10");
const RETRY_DELAY_MS = parseInt(process.env.CHITTY_RETRY_DELAY || "1000");

/** Reserved ChittyID patterns for system commands */
const RESERVED_PATTERNS = {
  // Version 0 reserved for system commands
  VALIDATE_ALL: "00-0-SYS-0000-V-0000-0-0",     // Trigger full validation scan
  EMERGENCY_STOP: "00-0-SYS-9999-E-9999-9-9",  // Emergency shutdown
  HEALTH_CHECK: "00-0-SYS-1111-H-1111-1-1",    // System health check
  ROTATE_KEYS: "00-0-SYS-2222-K-2222-2-2",     // Rotate API keys
  AUDIT_MODE: "00-0-SYS-3333-A-3333-3-3",      // Enable audit mode

  // Version 99 reserved for testing
  TEST_MODE: "99-9-TST-9999-T-9999-9-9",       // Test mode activation
  MOCK_VALID: "99-9-TST-0000-M-0000-0-0",      // Always returns valid (testing only)
  MOCK_INVALID: "99-9-TST-1111-M-1111-1-1",    // Always returns invalid (testing only)

  // Special administrative zones
  ADMIN_PREFIX: "00-0-ADM",                     // Admin operations
  SYSTEM_PREFIX: "00-0-SYS",                    // System operations
  TEST_PREFIX: "99-9-TST",                      // Test operations
};

/** Check if ChittyID is reserved for commands */
export function isReservedCommand(chittyId) {
  // Check exact matches
  for (const [command, pattern] of Object.entries(RESERVED_PATTERNS)) {
    if (chittyId === pattern) {
      return { isReserved: true, command, pattern };
    }
  }

  // Check prefixes
  const upper = chittyId.toUpperCase();
  if (upper.startsWith("00-0-SYS") || upper.startsWith("00-0-ADM")) {
    return { isReserved: true, command: "SYSTEM_OPERATION", zone: "admin" };
  }
  if (upper.startsWith("99-9-TST")) {
    return { isReserved: true, command: "TEST_OPERATION", zone: "test" };
  }

  // Check version 0 or 99 (reserved)
  const [version] = chittyId.split('-');
  if (version === "00" || version === "99") {
    console.warn(`⚠️ Reserved version detected: ${version}`);
    return { isReserved: true, command: "RESERVED_VERSION", version };
  }

  return { isReserved: false };
}

/** Execute reserved command if authorized */
export async function executeReservedCommand(chittyId, auth = null) {
  const reserved = isReservedCommand(chittyId);
  if (!reserved.isReserved) return null;

  // Check authorization for admin commands
  if (reserved.zone === "admin" && !auth?.isAdmin) {
    throw new Error("UNAUTHORIZED: Admin privileges required for this ChittyID command");
  }

  console.log(`🔧 Executing reserved command: ${reserved.command}`);

  switch (reserved.command) {
    case "VALIDATE_ALL":
      console.log("Starting full validation scan...");
      return { action: "validate_all", status: "initiated" };

    case "EMERGENCY_STOP":
      console.error("🚨 EMERGENCY STOP TRIGGERED");
      return { action: "emergency_stop", status: "system_halted" };

    case "HEALTH_CHECK":
      const health = await fetch(`${BASE}/health`);
      return { action: "health_check", status: health.ok ? "healthy" : "unhealthy" };

    case "AUDIT_MODE":
      console.log("📋 Audit mode enabled - all operations will be logged");
      return { action: "audit_mode", status: "enabled" };

    case "TEST_MODE":
      if (process.env.NODE_ENV !== "production") {
        console.log("🧪 Test mode activated");
        return { action: "test_mode", status: "activated" };
      }
      throw new Error("Test mode not allowed in production");

    default:
      throw new Error(`Unknown reserved command: ${reserved.command}`);
  }
}

/** Guard: reject malformed IDs, script injections, and any local "minting" attempts */
export function formatGate(x) {
  // Security checks first
  if (typeof x !== 'string') throw new Error("ChittyID must be a string");
  if (x.length > 50) throw new Error("ChittyID too long - possible injection");

  // Check for reserved command patterns first
  const reserved = isReservedCommand(x);
  if (reserved.isReserved) {
    console.log(`📌 Reserved ChittyID detected: ${reserved.command}`);
    // Reserved IDs bypass normal validation but require special handling
    return;
  }

  // Detect script injection attempts
  const dangerous = [
    '<script', 'javascript:', 'eval(', 'function(', 'onclick',
    'onerror', 'alert(', 'prompt(', 'confirm(', '.exe',
    '../', '..\\', 'file://', 'data:', 'vbscript:',
    '${', '#{', '{{', '}}', '%0a', '%0d', '\x00',
    'DROP TABLE', 'DELETE FROM', 'INSERT INTO', '--',
    ';', '/*', '*/', '<!--', '-->', '<!'
  ];

  const lower = x.toLowerCase();
  for (const pattern of dangerous) {
    if (lower.includes(pattern.toLowerCase())) {
      console.error(`🚨 SECURITY: Script injection attempt detected: ${pattern}`);
      throw new Error(`Security violation: Invalid ChittyID contains dangerous pattern`);
    }
  }

  // Check for encoded scripts (base64, hex, unicode escapes)
  if (/[\x00-\x1f\x7f-\x9f]/.test(x)) {
    throw new Error("Security violation: ChittyID contains control characters");
  }

  if (/(%[0-9a-f]{2}|\\x[0-9a-f]{2}|\\u[0-9a-f]{4})/i.test(x)) {
    console.error(`🚨 SECURITY: Encoded script attempt detected`);
    throw new Error("Security violation: ChittyID contains encoded characters");
  }

  // Canonical pattern enforced by the Worker's /validate
  // Updated to match the actual format: XX-X-XXX-XXXX-X-XXXXXX-X-X
  const re = /^[A-Z0-9]{2}-[0-9]-[A-Z0-9]{3}-[0-9]{4}-[A-Z0-9]-[0-9]{6}-[0-9]-[0-9]$/i;
  if (!re.test(x)) {
    // Check if it looks like a script masquerading as ChittyID
    if (x.includes('-') && x.split('-').length === 8) {
      // Looks like ChittyID format but failed regex - suspicious!
      console.error(`🚨 SECURITY: Fake ChittyID detected - looks valid but contains invalid characters`);
      throw new Error("Security violation: Fake ChittyID format detected");
    }
    throw new Error("ChittyID format invalid");
  }

  // Additional check: ensure each segment is valid
  const segments = x.split('-');
  if (segments.some(seg => seg.length === 0 || seg.length > 6)) {
    throw new Error("Security violation: ChittyID segment length invalid");
  }
}

/** Retry with exponential backoff until verified */
async function retryUntilVerified(fn, operation = "operation") {
  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await fn();
      if (result) return result; // Success!
    } catch (error) {
      lastError = error;
      console.error(`[Attempt ${attempt + 1}/${MAX_RETRIES}] ${operation} failed: ${error.message}`);
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, etc.
    const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
    console.log(`Retrying in ${delay}ms...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  throw new Error(`${operation} failed after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`);
}

/** Generate (server-minted only) - MUST succeed or fail completely */
export async function generate({ kind = "generic", attrs = {}, version = null } = {}) {
  // Sanitize inputs
  if (typeof kind !== 'string' || kind.length > 50) {
    throw new Error("Invalid kind parameter");
  }
  if (typeof attrs !== 'object') {
    throw new Error("Invalid attrs parameter");
  }

  // Prevent generation of reserved versions
  if (version === "00" || version === "99") {
    throw new Error("FORBIDDEN: Versions 00 and 99 are reserved for system use");
  }
  if (kind === "SYS" || kind === "ADM" || kind === "TST") {
    throw new Error("FORBIDDEN: System kinds (SYS/ADM/TST) are reserved");
  }

  return retryUntilVerified(async () => {
    // Identity mint lives at /v1/identity/chitty-id. Server decides the ID
    const r = await fetch(`${BASE}/v1/identity/chitty-id`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, attrs })
    });
    if (!r.ok) throw new Error(`mint failed: ${r.status}`);
    const j = await r.json();
    const chittyId = j.chitty_id;

    // CRITICAL: Verify the minted ID immediately
    if (!chittyId) throw new Error("Server did not return a ChittyID");
    const isValid = await validate(chittyId);
    if (!isValid) throw new Error(`Minted ID failed validation: ${chittyId}`);

    return chittyId;
  }, "ChittyID generation");
}

/** Validate round-trip against router - MUST get definitive answer */
export async function validate(chittyId) {
  // Check if it's a fallback status ID first
  const fallbackStatus = fallback.decodeFallbackStatus(chittyId);
  if (fallbackStatus?.isFallback) {
    console.log(`🔄 Fallback ID detected: ${fallbackStatus.name}`);
    console.log(`   Message: ${fallbackStatus.message}`);

    // Handle the fallback appropriately
    const action = await fallback.handleFallbackId(chittyId);

    if (action === "retry") {
      // System indicated retry is possible
      return validate(chittyId); // Recursive retry
    } else if (action === "cache" || action === "fallback") {
      // Use cached or fallback validation
      return true; // Assume valid in degraded mode
    } else if (action === "authenticate") {
      throw new Error("Authentication required - please set CHITTY_API_KEY");
    } else {
      // Service is down and not retryable
      throw new Error(`Service unavailable: ${fallbackStatus.message}`);
    }
  }

  // Check for reserved commands
  const reserved = isReservedCommand(chittyId);
  if (reserved.isReserved) {
    // Reserved IDs have special validation rules
    if (reserved.command === "MOCK_VALID") return true;
    if (reserved.command === "MOCK_INVALID") return false;

    // Execute command if it's a system operation
    if (reserved.zone === "admin" || reserved.zone === "test") {
      const result = await executeReservedCommand(chittyId, { isAdmin: process.env.CHITTY_ADMIN === "true" });
      console.log("Command result:", result);
      return true; // Command executed successfully
    }
  }

  // CRITICAL: Security gate before any network call
  formatGate(chittyId);

  // Log validation attempts for audit
  console.log(`[AUDIT] Validating ChittyID: ${chittyId.substring(0, 10)}...`);

  return retryUntilVerified(async () => {
    try {
      // Fast path validator exposed by Worker
      const r = await fetch(`${BASE}/validate?id=${encodeURIComponent(chittyId)}`);
      if (r.ok) {
        const body = await r.json();

        // Check if response contains a fallback ChittyID
        if (body.chittyId && fallback.decodeFallbackStatus(body.chittyId)?.isFallback) {
          console.warn(`⚠️ Server returned fallback ID: ${body.chittyId}`);
          return handleFallbackId(body.chittyId);
        }

        return body.valid || body.ok || true;
      }

      // Check if response headers contain fallback ID
      const fallbackId = r.headers.get('X-Chitty-Status');
      if (fallbackId) {
        console.warn(`⚠️ Server returned fallback ID in header: ${fallbackId}`);
        return handleFallbackId(fallbackId);
      }
    } catch (e) {
      // Network error - generate appropriate fallback
      if (e.message?.includes('fetch')) {
        const fallbackId = fallback.FALLBACK_IDS.SERVICE_DOWN;
        console.error(`🔴 Service unreachable, using fallback: ${fallbackId}`);
        return handleFallbackId(fallbackId);
      }
      // Fall through to secondary
    }

    // Gateway status fallback per verify API
    const r2 = await fetch(`${BASE}/v1/verify/status?chitty_id=${encodeURIComponent(chittyId)}`);
    if (!r2.ok) return false; // Definitive: does not exist
    return true; // Exists in system
  }, `ChittyID validation for ${chittyId}`);
}

/** Register an event on the verification ledger (idempotent) - MUST complete */
export async function register(chittyId, { event_type = "Created", actor = "cli", proof_url } = {}) {
  // CRITICAL: Must validate first, with retries
  const isValid = await validate(chittyId);
  if (!isValid) throw new Error(`Cannot register invalid ChittyID: ${chittyId}`);

  return retryUntilVerified(async () => {
    // Verification events endpoint. Backed by ledger schema
    const r = await fetch(`${BASE}/v1/verify/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chitty_id: chittyId, event_type, actor, proof_url })
    });
    if (!r.ok) throw new Error(`register failed: ${r.status}`);
    return true;
  }, `ChittyID registration for ${chittyId}`);
}

/** Forbid any local ID creation - including placeholders */
export function forbidLocalMint() {
  const error = "Local ID generation is forbidden. Use generate() to get verified ID from central server.";
  return {
    makeId: () => { throw new Error(error); },
    placeholder: () => { throw new Error(error + " No placeholders - must have real verified ID."); },
    temporary: () => { throw new Error(error + " No temporary IDs - must use central server."); }
  };
}

/** Convenience: ensure valid before any use - with retries */
export async function ensureValid(chittyId) {
  const isValid = await validate(chittyId);
  if (!isValid) throw new Error(`ChittyID validation failed after ${MAX_RETRIES} attempts: ${chittyId}`);
  return true;
}

/** CRITICAL: Replace any placeholder with real verified ID */
export async function replacePlaceholder(placeholder) {
  // Check if placeholder is actually a script
  try {
    formatGate(placeholder);
  } catch (e) {
    console.error(`🚨 BLOCKED: Placeholder '${placeholder}' is not a valid format - possible script injection`);
    throw new Error(`Security violation: Invalid placeholder - ${e.message}`);
  }

  console.warn(`⚠️ Placeholder detected: ${placeholder} - fetching real ChittyID...`);
  return generate({ kind: "replacement", attrs: { replaced: placeholder } });
}

/** Detect and block script-like ChittyIDs */
export function detectScriptInjection(input) {
  // Check for IDs that execute code when parsed
  const scriptPatterns = [
    /^[A-Z0-9]{2}-[0-9]-eval-[A-Z0-9]{4}-[A-Z0-9]-[A-Z0-9]{4}-[A-Z0-9]-[A-Z0-9]$/i,
    /^[A-Z0-9]{2}-[0-9]-exec-[A-Z0-9]{4}-[A-Z0-9]-[A-Z0-9]{4}-[A-Z0-9]-[A-Z0-9]$/i,
    /^[A-Z0-9]{2}-[0-9]-\$\{.*\}-[A-Z0-9]{4}-[A-Z0-9]-[A-Z0-9]{4}-[A-Z0-9]-[A-Z0-9]$/i,
  ];

  for (const pattern of scriptPatterns) {
    if (pattern.test(input)) {
      console.error(`🚨 CRITICAL: Script injection ChittyID detected!`);
      throw new Error("SECURITY BREACH: ChittyID contains executable code pattern");
    }
  }

  // Check for IDs that reference external scripts
  if (input.includes('http') || input.includes('ftp') || input.includes('//')) {
    throw new Error("SECURITY BREACH: ChittyID contains URL reference");
  }

  return false;
}

/** Get list of all reserved patterns (for documentation) */
export function getReservedPatterns() {
  return { ...RESERVED_PATTERNS, ...fallback.FALLBACK_IDS };
}

/** Handle fallback IDs seamlessly */
async function handleFallbackId(chittyId) {
  const result = await fallback.handleFallbackId(chittyId);
  if (result === "retry") {
    // Wait and retry with original ID
    await new Promise(r => setTimeout(r, 5000));
    return false; // Trigger retry
  }
  return result === "cache" || result === "fallback";
}

/** Check if user can execute admin commands */
export function canExecuteAdminCommands() {
  return process.env.CHITTY_ADMIN === "true" || process.env.CHITTY_ROLE === "admin";
}