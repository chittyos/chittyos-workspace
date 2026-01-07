/**
 * ChittyContext - Context management and audit logging
 * Provides traceability for all ChittyOS interactions
 */

import type {
  ChittyContext,
  ContextType,
  ContextGrade,
  ContextStatus,
  AuditEvent,
  ContextEnv
} from './types'

/**
 * Calculate grade from trust score
 */
export function scoreToGrade(score: number): ContextGrade {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

/**
 * Create a new context tied to a ChittyID
 */
export function createContext(
  chittyId: string,
  type: ContextType,
  options?: Partial<ChittyContext>
): ChittyContext {
  const now = new Date().toISOString()
  const trustScore = options?.trustScore ?? 70

  return {
    id: crypto.randomUUID(),
    chittyId,
    type,
    status: 'active',
    grade: scoreToGrade(trustScore),
    trustScore,
    sessionId: options?.sessionId || crypto.randomUUID(),
    requestId: options?.requestId || crypto.randomUUID(),
    parentContextId: options?.parentContextId,
    rootContextId: options?.rootContextId,
    dnaFingerprint: options?.dnaFingerprint,
    createdAt: now,
    updatedAt: now,
    expiresAt: options?.expiresAt,
    metadata: options?.metadata
  }
}

/**
 * Create context from HTTP request headers
 */
export function contextFromRequest(request: Request, type: ContextType = 'session'): ChittyContext {
  const chittyId = request.headers.get('X-Chitty-ID') || 'anonymous'
  const sessionId = request.headers.get('X-Session-ID') || crypto.randomUUID()
  const requestId = request.headers.get('X-Request-ID') || crypto.randomUUID()

  return createContext(chittyId, type, { sessionId, requestId })
}

/**
 * Update context status
 */
export function updateContextStatus(
  ctx: ChittyContext,
  status: ContextStatus
): ChittyContext {
  return {
    ...ctx,
    status,
    updatedAt: new Date().toISOString()
  }
}

/**
 * Promote context grade (increase trust)
 */
export function promoteContext(ctx: ChittyContext, reason: string): ChittyContext {
  const newScore = Math.min(100, ctx.trustScore + 5)
  return {
    ...ctx,
    trustScore: newScore,
    grade: scoreToGrade(newScore),
    updatedAt: new Date().toISOString(),
    metadata: {
      ...ctx.metadata,
      lastPromotion: { reason, timestamp: new Date().toISOString() }
    }
  }
}

/**
 * Demote context grade (decrease trust)
 */
export function demoteContext(ctx: ChittyContext, reason: string): ChittyContext {
  const newScore = Math.max(0, ctx.trustScore - 10)
  return {
    ...ctx,
    trustScore: newScore,
    grade: scoreToGrade(newScore),
    updatedAt: new Date().toISOString(),
    metadata: {
      ...ctx.metadata,
      lastDemotion: { reason, timestamp: new Date().toISOString() }
    }
  }
}

/**
 * Create an audit event
 */
export function createAuditEvent(
  ctx: ChittyContext,
  eventType: string,
  action: string,
  resource: string,
  metadata?: Record<string, unknown>
): AuditEvent {
  return {
    id: crypto.randomUUID(),
    contextId: ctx.id,
    chittyId: ctx.chittyId,
    eventType,
    action,
    resource,
    timestamp: new Date().toISOString(),
    metadata: {
      ...metadata,
      sessionId: ctx.sessionId,
      requestId: ctx.requestId,
      contextGrade: ctx.grade,
      trustScore: ctx.trustScore
    }
  }
}

/**
 * Log an audit event to KV storage
 */
export async function logAudit(env: ContextEnv, event: AuditEvent): Promise<void> {
  if (!env.CHITTY_KV) return

  const key = `audit:${event.chittyId}:${event.timestamp}:${event.id}`

  await env.CHITTY_KV.put(key, JSON.stringify(event), {
    expirationTtl: 86400 * 90 // 90 days retention
  })

  // Optionally queue for async processing
  if (env.CHITTY_TASKS) {
    await env.CHITTY_TASKS.send({
      type: 'audit',
      event
    })
  }
}

/**
 * Get audit trail for a ChittyID
 */
export async function getAuditTrail(
  env: ContextEnv,
  chittyId: string,
  options?: { limit?: number; eventType?: string }
): Promise<AuditEvent[]> {
  if (!env.CHITTY_KV) return []

  const prefix = `audit:${chittyId}:`
  const list = await env.CHITTY_KV.list({ prefix, limit: options?.limit || 50 })

  const events: AuditEvent[] = []
  for (const key of list.keys) {
    const data = await env.CHITTY_KV.get(key.name)
    if (data) {
      const event = JSON.parse(data) as AuditEvent
      if (!options?.eventType || event.eventType === options.eventType) {
        events.push(event)
      }
    }
  }

  return events
}

/**
 * Add context headers to response
 */
export function addContextHeaders(headers: Headers, ctx: ChittyContext): Headers {
  headers.set('X-Context-ID', ctx.id)
  headers.set('X-Request-ID', ctx.requestId)
  headers.set('X-Session-ID', ctx.sessionId)
  headers.set('X-Context-Grade', ctx.grade)
  return headers
}
