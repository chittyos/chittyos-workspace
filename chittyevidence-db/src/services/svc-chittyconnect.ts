// ============================================
// CHITTYCONNECT INTEGRATION
// Cross-service authentication & zero-trust binding
// ============================================

import { Env } from '../types';
import { generateId, safeJsonParse } from '../utils';

/**
 * ChittyConnect provides:
 * - Service-to-service authentication
 * - Zero-trust request verification
 * - Cross-ecosystem credential management
 * - Session synchronization across services
 */

// ============================================
// TYPES
// ============================================

export interface ServiceCredential {
  serviceId: string;
  serviceName: string;
  publicKey: string;
  permissions: string[];
  issuedAt: string;
  expiresAt?: string;
  revokedAt?: string;
}

export interface ServiceToken {
  token: string;
  serviceId: string;
  chittyId?: string;
  sessionId?: string;
  permissions: string[];
  issuedAt: string;
  expiresAt: string;
}

export interface CrossServiceRequest {
  requestId: string;
  sourceService: string;
  targetService: string;
  chittyId?: string;
  sessionId?: string;
  action: string;
  payload: any;
  signature: string;
  timestamp: string;
}

export interface ServiceBinding {
  id: string;
  sourceServiceId: string;
  targetServiceId: string;
  bindingType: 'full' | 'read_only' | 'event_only';
  allowedActions: string[];
  createdAt: string;
  expiresAt?: string;
}

// ============================================
// CHITTYCONNECT CLIENT
// ============================================

export class ChittyConnectClient {
  private baseUrl: string;
  private serviceId: string;
  private serviceSecret: string;
  private cachedToken?: ServiceToken;

  constructor(config: {
    baseUrl: string;
    serviceId: string;
    serviceSecret: string;
  }) {
    this.baseUrl = config.baseUrl;
    this.serviceId = config.serviceId;
    this.serviceSecret = config.serviceSecret;
  }

  /**
   * Get or refresh service token
   */
  async getServiceToken(): Promise<ServiceToken> {
    if (this.cachedToken && new Date(this.cachedToken.expiresAt) > new Date()) {
      return this.cachedToken;
    }

    const response = await fetch(`${this.baseUrl}/auth/service-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-ID': this.serviceId,
      },
      body: JSON.stringify({
        serviceId: this.serviceId,
        secret: this.serviceSecret,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get service token: ${response.status}`);
    }

    this.cachedToken = await response.json();
    return this.cachedToken!;
  }

  /**
   * Verify incoming request from another service
   */
  async verifyRequest(request: CrossServiceRequest): Promise<{
    valid: boolean;
    sourceService?: ServiceCredential;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/verify-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await this.getServiceToken()).token}`,
        },
        body: JSON.stringify(request),
      });

      return await response.json();
    } catch (error) {
      return { valid: false, error: String(error) };
    }
  }

  /**
   * Make authenticated cross-service request
   */
  async crossServiceRequest<T>(
    targetService: string,
    action: string,
    payload: any,
    options?: {
      chittyId?: string;
      sessionId?: string;
    }
  ): Promise<T> {
    const token = await this.getServiceToken();
    const requestId = generateId();
    const timestamp = new Date().toISOString();

    // Create request signature
    const signaturePayload = `${requestId}:${this.serviceId}:${targetService}:${action}:${timestamp}`;
    const signature = await this.sign(signaturePayload);

    const request: CrossServiceRequest = {
      requestId,
      sourceService: this.serviceId,
      targetService,
      chittyId: options?.chittyId,
      sessionId: options?.sessionId,
      action,
      payload,
      signature,
      timestamp,
    };

    const response = await fetch(`${this.baseUrl}/relay/${targetService}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.token}`,
        'X-Request-ID': requestId,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Cross-service request failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Sync session state to ChittyConnect
   */
  async syncSession(sessionId: string, state: any): Promise<void> {
    const token = await this.getServiceToken();

    await fetch(`${this.baseUrl}/sessions/${sessionId}/sync`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.token}`,
      },
      body: JSON.stringify({
        serviceId: this.serviceId,
        state,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  /**
   * Get session state from ChittyConnect
   */
  async getSessionState(sessionId: string): Promise<any> {
    const token = await this.getServiceToken();

    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${token.token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  }

  /**
   * Register webhook for cross-service events
   */
  async registerWebhook(config: {
    events: string[];
    url: string;
    secret: string;
  }): Promise<{ webhookId: string }> {
    const token = await this.getServiceToken();

    const response = await fetch(`${this.baseUrl}/webhooks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.token}`,
      },
      body: JSON.stringify({
        serviceId: this.serviceId,
        ...config,
      }),
    });

    return response.json();
  }

  private async sign(payload: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.serviceSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

// ============================================
// MIDDLEWARE FOR INCOMING REQUESTS
// ============================================

export interface AuthContext {
  authenticated: boolean;
  chittyId?: string;
  sessionId?: string;
  serviceId?: string;
  permissions: string[];
}

export async function authenticateRequest(
  request: Request,
  env: Env & {
    CHITTY_CONNECT_URL?: string;
    CHITTY_SERVICE_ID?: string;
    CHITTY_SERVICE_SECRET?: string;
  }
): Promise<AuthContext> {
  const authHeader = request.headers.get('Authorization');
  const serviceHeader = request.headers.get('X-Service-ID');

  // No auth header = anonymous
  if (!authHeader) {
    return { authenticated: false, permissions: [] };
  }

  // Service-to-service auth
  if (serviceHeader && authHeader.startsWith('Service ')) {
    return authenticateServiceRequest(request, env);
  }

  // Bearer token (user/ChittyID auth)
  if (authHeader.startsWith('Bearer ')) {
    return authenticateBearerToken(authHeader.slice(7), env);
  }

  return { authenticated: false, permissions: [] };
}

async function authenticateServiceRequest(
  request: Request,
  env: any
): Promise<AuthContext> {
  const serviceId = request.headers.get('X-Service-ID');
  const signature = request.headers.get('X-Service-Signature');
  const timestamp = request.headers.get('X-Timestamp');

  if (!serviceId || !signature || !timestamp) {
    return { authenticated: false, permissions: [] };
  }

  // Verify timestamp is recent (within 5 minutes)
  const requestTime = new Date(timestamp).getTime();
  const now = Date.now();
  if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
    return { authenticated: false, permissions: [] };
  }

  // Look up service in D1
  const service = await env.DB.prepare(
    `SELECT * FROM service_credentials WHERE service_id = ? AND revoked_at IS NULL`
  ).bind(serviceId).first();

  if (!service) {
    return { authenticated: false, permissions: [] };
  }

  // Verify signature (simplified - production would use proper crypto)
  const expectedPayload = `${serviceId}:${timestamp}`;
  const expectedSignature = await computeHmac(expectedPayload, service.secret as string);

  if (signature !== expectedSignature) {
    return { authenticated: false, permissions: [] };
  }

  return {
    authenticated: true,
    serviceId,
    permissions: safeJsonParse<string[]>(service.permissions as string, []),
  };
}

async function authenticateBearerToken(token: string, env: any): Promise<AuthContext> {
  // Verify token with ChittyConnect or local verification
  try {
    // First try local token verification
    const tokenRecord = await env.DB.prepare(
      `SELECT * FROM access_tokens WHERE token = ? AND expires_at > datetime('now')`
    ).bind(token).first();

    if (tokenRecord) {
      return {
        authenticated: true,
        chittyId: tokenRecord.chitty_id as string,
        sessionId: tokenRecord.session_id as string | undefined,
        permissions: safeJsonParse<string[]>(tokenRecord.permissions as string, []),
      };
    }

    // Fall back to ChittyConnect verification
    if (env.CHITTY_CONNECT_URL) {
      const response = await fetch(`${env.CHITTY_CONNECT_URL}/auth/verify-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        const result = await response.json() as any;
        return {
          authenticated: true,
          chittyId: result.chittyId,
          sessionId: result.sessionId,
          permissions: result.permissions || [],
        };
      }
    }

    return { authenticated: false, permissions: [] };
  } catch {
    return { authenticated: false, permissions: [] };
  }
}

async function computeHmac(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================
// PERMISSION CHECKING
// ============================================

export function hasPermission(context: AuthContext, requiredPermission: string): boolean {
  if (!context.authenticated) return false;

  // Wildcard permission
  if (context.permissions.includes('*')) return true;

  // Exact match
  if (context.permissions.includes(requiredPermission)) return true;

  // Prefix match (e.g., "documents:*" matches "documents:read")
  const prefix = requiredPermission.split(':')[0];
  if (context.permissions.includes(`${prefix}:*`)) return true;

  return false;
}

export function requirePermission(context: AuthContext, permission: string): void {
  if (!hasPermission(context, permission)) {
    throw new Error(`Permission denied: ${permission}`);
  }
}

// ============================================
// SCHEMA ADDITIONS
// ============================================

export const CHITTY_CONNECT_SCHEMA = `
-- Service credentials for cross-service auth
CREATE TABLE IF NOT EXISTS service_credentials (
    service_id TEXT PRIMARY KEY,
    service_name TEXT NOT NULL,
    secret TEXT NOT NULL,
    public_key TEXT,
    permissions JSON,
    issued_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    revoked_at TEXT
);

-- Access tokens for users/ChittyIDs
CREATE TABLE IF NOT EXISTS access_tokens (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    chitty_id TEXT REFERENCES chitty_ids(id),
    session_id TEXT,
    permissions JSON,
    issued_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    revoked_at TEXT
);

-- Service bindings (which services can talk to which)
CREATE TABLE IF NOT EXISTS service_bindings (
    id TEXT PRIMARY KEY,
    source_service_id TEXT NOT NULL,
    target_service_id TEXT NOT NULL,
    binding_type TEXT NOT NULL,
    allowed_actions JSON,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    UNIQUE(source_service_id, target_service_id)
);

-- Cross-service request log (for audit)
CREATE TABLE IF NOT EXISTS cross_service_requests (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    source_service TEXT NOT NULL,
    target_service TEXT NOT NULL,
    chitty_id TEXT,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    response_code INTEGER,
    duration_ms INTEGER,
    timestamp TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tokens_chitty ON access_tokens(chitty_id);
CREATE INDEX IF NOT EXISTS idx_tokens_token ON access_tokens(token);
CREATE INDEX IF NOT EXISTS idx_requests_source ON cross_service_requests(source_service);
CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON cross_service_requests(timestamp);
`;
