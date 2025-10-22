/**
 * Bearer Token Authentication Middleware
 * Version: 1.0.0
 */

import type { ApiResponse } from "./types";

/**
 * Extract Bearer token from Authorization header
 * @param request - Incoming request
 * @returns Extracted token or null if not found
 */
export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Validate Bearer token
 * For Phase 1, we validate that the token matches CHITTY_ID_TOKEN
 * In future phases, this can be enhanced to validate against id.chitty.cc
 *
 * @param token - Token to validate
 * @param validToken - Expected valid token (from env)
 * @returns true if valid, false otherwise
 */
export function validateBearerToken(
  token: string,
  validToken?: string,
): boolean {
  if (!validToken) {
    // If no valid token configured, reject all requests
    return false;
  }

  // Simple equality check for Phase 1
  // Phase 2+ can add expiration checks, scope validation, etc.
  return token === validToken;
}

/**
 * Middleware: Require authentication
 * Returns 401 Unauthorized if token is missing or invalid
 *
 * @param request - Incoming request
 * @param validToken - Expected valid token
 * @returns null if authorized, Response with 401 if unauthorized
 */
export function requireAuth(
  request: Request,
  validToken?: string,
): Response | null {
  const token = extractBearerToken(request);

  if (!token) {
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error:
          'Unauthorized: Missing Authorization header. Provide "Authorization: Bearer <token>"',
        timestamp: Date.now(),
      },
      401,
    );
  }

  if (!validateBearerToken(token, validToken)) {
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: "Unauthorized: Invalid bearer token",
        timestamp: Date.now(),
      },
      401,
    );
  }

  return null; // Authorized
}

/**
 * Create JSON response with proper headers
 * @param data - Response data
 * @param status - HTTP status code
 * @returns Response object
 */
export function jsonResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*", // Enable CORS
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

/**
 * Handle OPTIONS preflight requests for CORS
 * @returns Response with CORS headers
 */
export function handleCors(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400", // 24 hours
    },
  });
}
