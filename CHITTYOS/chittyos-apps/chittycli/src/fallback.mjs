/**
 * Fallback ChittyIDs - Returned when services are down
 * These look like normal ChittyIDs but encode system status
 */

// Status ChittyIDs that encode system state
export const FALLBACK_IDS = {
  // Service availability codes (00-1-XXX = status codes)
  SERVICE_DOWN: "00-1-ERR-5030-S-0000-0-0",        // 503-0 Service unavailable
  MAINTENANCE: "00-1-MNT-5031-M-0000-0-1",         // 503-1 Maintenance mode
  RATE_LIMITED: "00-1-RTL-4290-R-0000-0-2",        // 429-0 Rate limited
  TIMEOUT: "00-1-TMO-5040-T-0000-0-3",             // 504-0 Gateway timeout
  DATABASE_ERROR: "00-1-DBS-5000-D-0000-0-4",      // 500-0 Database error
  AUTH_REQUIRED: "00-1-ATH-4010-A-0000-0-5",       // 401-0 Authentication required
  FORBIDDEN: "00-1-FBD-4030-F-0000-0-6",           // 403-0 Forbidden
  NOT_FOUND: "00-1-NFD-4040-N-0000-0-7",           // 404-0 Not found

  // Circuit breaker states (00-2-XXX = circuit states)
  CIRCUIT_OPEN: "00-2-CBO-0001-C-0000-1-0",        // Circuit breaker open
  CIRCUIT_HALF: "00-2-CBH-0002-C-0000-2-0",        // Circuit breaker half-open
  CIRCUIT_CLOSED: "00-2-CBC-0003-C-0000-3-0",      // Circuit breaker closed

  // Degraded service modes (00-3-XXX = degraded modes)
  READONLY_MODE: "00-3-ROM-0001-R-0000-1-0",       // Read-only mode
  FALLBACK_MODE: "00-3-FBM-0002-F-0000-2-0",       // Fallback mode active
  CACHE_ONLY: "00-3-CAO-0003-C-0000-3-0",          // Cache-only mode
  LOCAL_ONLY: "00-3-LOC-0004-L-0000-4-0",          // Local validation only

  // Recovery signals (00-4-XXX = recovery)
  RECOVERING: "00-4-RCV-0001-R-0000-1-0",          // System recovering
  RETRY_AFTER: "00-4-RTA-0002-R-0000-2-0",         // Retry after delay
  REDIRECT: "00-4-RDR-0003-R-0000-3-0",            // Redirect to alternate
  FAILOVER: "00-4-FOV-0004-F-0000-4-0",            // Failover active
};

/**
 * Decode status from fallback ChittyID
 */
export function decodeFallbackStatus(chittyId) {
  // Parse the segments
  const segments = chittyId.split('-');
  if (segments.length !== 8) return null;

  const [version, type, code, statusNum] = segments;

  // Check if it's a fallback ID
  if (version !== "00") return null;

  // Decode type
  const typeMap = {
    "1": "error",
    "2": "circuit",
    "3": "degraded",
    "4": "recovery"
  };

  const statusType = typeMap[type];
  if (!statusType) return null;

  // Extract HTTP status if encoded
  const httpStatus = statusNum.match(/(\d{3})\d/)?.[1];

  // Find the matching fallback
  const fallbackName = Object.entries(FALLBACK_IDS)
    .find(([_, id]) => id === chittyId)?.[0];

  return {
    isFallback: true,
    type: statusType,
    code: code,
    httpStatus: httpStatus ? parseInt(httpStatus) : null,
    name: fallbackName || "UNKNOWN",
    action: determineFallbackAction(fallbackName),
    retryable: isRetryable(fallbackName),
    message: getFallbackMessage(fallbackName)
  };
}

/**
 * Determine what action to take for a fallback ID
 */
function determineFallbackAction(fallbackName) {
  const actions = {
    SERVICE_DOWN: "wait_and_retry",
    MAINTENANCE: "show_maintenance_page",
    RATE_LIMITED: "exponential_backoff",
    TIMEOUT: "retry_with_increased_timeout",
    DATABASE_ERROR: "use_cache",
    AUTH_REQUIRED: "prompt_authentication",
    FORBIDDEN: "check_permissions",
    NOT_FOUND: "return_null",
    CIRCUIT_OPEN: "use_fallback",
    CIRCUIT_HALF: "limited_retry",
    READONLY_MODE: "disable_writes",
    FALLBACK_MODE: "use_local_validation",
    CACHE_ONLY: "serve_from_cache",
    RECOVERING: "wait_with_status",
    RETRY_AFTER: "scheduled_retry",
    REDIRECT: "follow_redirect",
    FAILOVER: "use_alternate_endpoint"
  };

  return actions[fallbackName] || "fail";
}

/**
 * Check if the fallback status is retryable
 */
function isRetryable(fallbackName) {
  const nonRetryable = [
    "AUTH_REQUIRED",
    "FORBIDDEN",
    "NOT_FOUND",
    "MAINTENANCE"
  ];

  return !nonRetryable.includes(fallbackName);
}

/**
 * Get human-readable message for fallback
 */
function getFallbackMessage(fallbackName) {
  const messages = {
    SERVICE_DOWN: "Service temporarily unavailable",
    MAINTENANCE: "System undergoing maintenance",
    RATE_LIMITED: "Too many requests, please slow down",
    TIMEOUT: "Request timed out, please try again",
    DATABASE_ERROR: "Database connection error",
    AUTH_REQUIRED: "Authentication required",
    FORBIDDEN: "Access denied",
    NOT_FOUND: "Resource not found",
    CIRCUIT_OPEN: "Service circuit breaker activated",
    CIRCUIT_HALF: "Service partially available",
    READONLY_MODE: "System in read-only mode",
    FALLBACK_MODE: "Using fallback validation",
    CACHE_ONLY: "Serving cached data only",
    RECOVERING: "System recovering, please wait",
    RETRY_AFTER: "Please retry after cooldown",
    REDIRECT: "Redirecting to alternate service",
    FAILOVER: "Using backup service"
  };

  return messages[fallbackName] || "Unknown system status";
}

/**
 * HTML fallback page that returns status ChittyID
 */
export function generateFallbackHTML(status = "SERVICE_DOWN") {
  const fallbackId = FALLBACK_IDS[status];
  const message = getFallbackMessage(status);

  return `<!DOCTYPE html>
<html>
<head>
  <title>ChittyID Service Status</title>
  <meta charset="utf-8">
  <meta name="chitty-status" content="${fallbackId}">
  <style>
    body {
      font-family: -apple-system, system-ui, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .status-card {
      background: white;
      padding: 3rem;
      border-radius: 1rem;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 500px;
      text-align: center;
    }
    .status-id {
      font-family: 'Courier New', monospace;
      background: #f4f4f4;
      padding: 1rem;
      border-radius: 0.5rem;
      margin: 1rem 0;
      word-break: break-all;
      border: 2px dashed #ddd;
    }
    .status-message {
      color: #666;
      margin-top: 1rem;
    }
    .retry-hint {
      color: #999;
      font-size: 0.9rem;
      margin-top: 2rem;
    }
    .status-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
  </style>
  <script>
    // Auto-retry logic
    window.chittyFallback = {
      id: "${fallbackId}",
      status: "${status}",
      retryCount: 0,
      maxRetries: 10,

      async checkStatus() {
        try {
          const response = await fetch('/validate?id=' + this.id);
          if (response.ok) {
            // Service recovered!
            window.location.reload();
          }
        } catch (e) {
          // Still down
        }

        // Exponential backoff
        this.retryCount++;
        if (this.retryCount < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
          setTimeout(() => this.checkStatus(), delay);
        }
      }
    };

    // Start checking after 5 seconds
    setTimeout(() => window.chittyFallback.checkStatus(), 5000);
  </script>
</head>
<body>
  <div class="status-card">
    <div class="status-icon">⚠️</div>
    <h1>Service Status</h1>
    <p class="status-message">${message}</p>
    <div class="status-id" id="chitty-status">${fallbackId}</div>
    <p class="retry-hint">This ChittyID encodes the current system status.<br>Copy it for diagnostic purposes.</p>
  </div>
</body>
</html>`;
}

/**
 * Cloudflare Worker fallback handler
 */
export function handleServiceDown(request, env, error) {
  // Determine the appropriate fallback based on error
  let fallbackType = "SERVICE_DOWN";

  if (error?.message?.includes("timeout")) {
    fallbackType = "TIMEOUT";
  } else if (error?.message?.includes("rate")) {
    fallbackType = "RATE_LIMITED";
  } else if (error?.message?.includes("auth")) {
    fallbackType = "AUTH_REQUIRED";
  } else if (error?.status === 503) {
    fallbackType = "MAINTENANCE";
  }

  const fallbackId = FALLBACK_IDS[fallbackType];

  // Return as JSON for API calls
  if (request.headers.get("Accept")?.includes("application/json")) {
    return new Response(JSON.stringify({
      chittyId: fallbackId,
      status: fallbackType,
      message: getFallbackMessage(fallbackType),
      retryable: isRetryable(fallbackType),
      timestamp: new Date().toISOString()
    }), {
      status: 503,
      headers: {
        "Content-Type": "application/json",
        "X-Chitty-Status": fallbackId,
        "Retry-After": "30"
      }
    });
  }

  // Return HTML for browser requests
  return new Response(generateFallbackHTML(fallbackType), {
    status: 503,
    headers: {
      "Content-Type": "text/html",
      "X-Chitty-Status": fallbackId,
      "Cache-Control": "no-cache",
      "Retry-After": "30"
    }
  });
}

/**
 * Client-side handler for fallback IDs
 */
export async function handleFallbackId(chittyId) {
  const status = decodeFallbackStatus(chittyId);

  if (!status?.isFallback) {
    return null; // Not a fallback ID
  }

  console.log(`📊 System Status: ${status.message}`);
  console.log(`   Type: ${status.type}`);
  console.log(`   Action: ${status.action}`);
  console.log(`   Retryable: ${status.retryable}`);

  // Execute the appropriate action
  switch (status.action) {
    case "wait_and_retry":
      console.log("⏳ Waiting 30 seconds before retry...");
      await new Promise(r => setTimeout(r, 30000));
      return "retry";

    case "exponential_backoff":
      const delay = Math.min(1000 * Math.pow(2, retryCount), 60000);
      console.log(`⏱️ Backing off for ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      return "retry";

    case "use_fallback":
      console.log("🔄 Using fallback validation");
      return "fallback";

    case "use_cache":
      console.log("💾 Using cached validation");
      return "cache";

    case "prompt_authentication":
      console.log("🔐 Authentication required");
      return "authenticate";

    case "fail":
    default:
      console.error("❌ Operation cannot proceed");
      return "fail";
  }
}

// Export for use in main index.mjs
export default {
  FALLBACK_IDS,
  decodeFallbackStatus,
  generateFallbackHTML,
  handleServiceDown,
  handleFallbackId
};