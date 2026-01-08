/**
 * ChittyRegister - register.chitty.cc
 * Compliance gatekeeper for ChittyOS service registration
 *
 * Endpoints:
 *   GET  /health                     - Health check
 *   POST /api/v1/register            - Register a new service
 *   GET  /api/v1/services            - List all registered services
 *   GET  /api/v1/services/:name      - Get specific service details
 *   GET  /api/v1/status              - Registry status and statistics
 */

import {
  corsHeaders,
  contextFromRequest,
  createAuditEvent,
  logAudit,
  addContextHeaders
} from '@chittyos/core'
import type { ContextEnv, ChittyContext } from '@chittyos/core'

interface Env extends ContextEnv {
  REGISTRY_KV: KVNamespace
}

// Service registration record
interface ServiceRegistration {
  name: string
  version: string
  type: 'worker' | 'api' | 'mcp' | 'package' | 'tool'
  category: 'Foundation' | 'Core' | 'Data' | 'Platform' | 'Domain' | 'Sync' | 'Application'
  description: string
  owner: string
  ownerChittyId: string
  status: 'pending' | 'approved' | 'active' | 'deprecated' | 'rejected'
  endpoints?: {
    api?: string
    mcp?: string
    docs?: string
    health?: string
  }
  metadata?: {
    repository?: string
    homepage?: string
    license?: string
    tags?: string[]
    dependencies?: string[]
  }
  registeredAt: string
  updatedAt: string
  approvedAt?: string
  approvedBy?: string
  rejectedAt?: string
  rejectedBy?: string
  rejectionReason?: string
}

// Registration request payload
interface RegisterRequest {
  name: string
  version: string
  type: 'worker' | 'api' | 'mcp' | 'package' | 'tool'
  category: 'Foundation' | 'Core' | 'Data' | 'Platform' | 'Domain' | 'Sync' | 'Application'
  description: string
  owner: string
  endpoints?: {
    api?: string
    mcp?: string
    docs?: string
    health?: string
  }
  metadata?: {
    repository?: string
    homepage?: string
    license?: string
    tags?: string[]
    dependencies?: string[]
  }
}

// Validation rules
const VALIDATION_RULES = {
  name: {
    pattern: /^[a-z][a-z0-9-]{2,63}$/,
    message: 'Name must be lowercase alphanumeric with hyphens, 3-64 characters, starting with a letter'
  },
  version: {
    pattern: /^\d+\.\d+\.\d+(-[a-z0-9]+)?$/,
    message: 'Version must follow semver format (e.g., 1.0.0 or 1.0.0-beta)'
  },
  description: {
    minLength: 10,
    maxLength: 500,
    message: 'Description must be between 10 and 500 characters'
  }
}

function validateRegistration(req: RegisterRequest): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Validate name
  if (!VALIDATION_RULES.name.pattern.test(req.name)) {
    errors.push(VALIDATION_RULES.name.message)
  }

  // Validate version
  if (!VALIDATION_RULES.version.pattern.test(req.version)) {
    errors.push(VALIDATION_RULES.version.message)
  }

  // Validate description
  if (req.description.length < VALIDATION_RULES.description.minLength ||
      req.description.length > VALIDATION_RULES.description.maxLength) {
    errors.push(VALIDATION_RULES.description.message)
  }

  // Validate type
  const validTypes = ['worker', 'api', 'mcp', 'package', 'tool']
  if (!validTypes.includes(req.type)) {
    errors.push(`Type must be one of: ${validTypes.join(', ')}`)
  }

  // Validate category
  const validCategories = ['Foundation', 'Core', 'Data', 'Platform', 'Domain', 'Sync', 'Application']
  if (!validCategories.includes(req.category)) {
    errors.push(`Category must be one of: ${validCategories.join(', ')}`)
  }

  // Validate owner
  if (!req.owner || req.owner.length < 3) {
    errors.push('Owner must be at least 3 characters')
  }

  // Validate endpoints if provided
  if (req.endpoints) {
    const urlPattern = /^https?:\/\/.+/
    if (req.endpoints.api && !urlPattern.test(req.endpoints.api)) {
      errors.push('API endpoint must be a valid URL')
    }
    if (req.endpoints.mcp && !urlPattern.test(req.endpoints.mcp)) {
      errors.push('MCP endpoint must be a valid URL')
    }
    if (req.endpoints.docs && !urlPattern.test(req.endpoints.docs)) {
      errors.push('Docs endpoint must be a valid URL')
    }
    if (req.endpoints.health && !urlPattern.test(req.endpoints.health)) {
      errors.push('Health endpoint must be a valid URL')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

async function registerService(
  env: Env,
  req: RegisterRequest,
  chittyCtx: ChittyContext
): Promise<{ success: boolean; registration?: ServiceRegistration; errors?: string[] }> {
  // Validate request
  const validation = validateRegistration(req)
  if (!validation.valid) {
    return { success: false, errors: validation.errors }
  }

  // Check if service already exists
  const existingKey = `service:${req.name}`
  const existing = await env.REGISTRY_KV.get(existingKey)
  if (existing) {
    return { success: false, errors: ['Service with this name already exists'] }
  }

  // Create registration record
  const now = new Date().toISOString()
  const registration: ServiceRegistration = {
    name: req.name,
    version: req.version,
    type: req.type,
    category: req.category,
    description: req.description,
    owner: req.owner,
    ownerChittyId: chittyCtx.chittyId,
    status: 'pending',
    endpoints: req.endpoints,
    metadata: req.metadata,
    registeredAt: now,
    updatedAt: now
  }

  // Store in KV
  await env.REGISTRY_KV.put(existingKey, JSON.stringify(registration))

  // Add to index for listing
  const indexKey = `index:${req.type}:${req.name}`
  await env.REGISTRY_KV.put(indexKey, JSON.stringify({ name: req.name, registeredAt: now }))

  return { success: true, registration }
}

async function getService(env: Env, name: string): Promise<ServiceRegistration | null> {
  const key = `service:${name}`
  const data = await env.REGISTRY_KV.get(key)
  if (!data) return null
  return JSON.parse(data) as ServiceRegistration
}

async function listServices(
  env: Env,
  filters?: {
    type?: string
    category?: string
    status?: string
    limit?: number
  }
): Promise<ServiceRegistration[]> {
  const limit = filters?.limit || 100
  const prefix = filters?.type ? `index:${filters.type}:` : 'index:'

  const list = await env.REGISTRY_KV.list({ prefix, limit })
  const services: ServiceRegistration[] = []

  for (const key of list.keys) {
    const serviceName = key.name.split(':').pop()
    if (!serviceName) continue

    const service = await getService(env, serviceName)
    if (!service) continue

    // Apply filters
    if (filters?.category && service.category !== filters.category) continue
    if (filters?.status && service.status !== filters.status) continue

    services.push(service)
  }

  return services.sort((a, b) =>
    new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
  )
}

async function getRegistryStatus(env: Env): Promise<{
  status: string
  statistics: {
    total: number
    byType: Record<string, number>
    byStatus: Record<string, number>
    byCategory: Record<string, number>
  }
}> {
  const allServices = await listServices(env, { limit: 1000 })

  const byType: Record<string, number> = {}
  const byStatus: Record<string, number> = {}
  const byCategory: Record<string, number> = {}

  for (const service of allServices) {
    byType[service.type] = (byType[service.type] || 0) + 1
    byStatus[service.status] = (byStatus[service.status] || 0) + 1
    byCategory[service.category] = (byCategory[service.category] || 0) + 1
  }

  return {
    status: 'operational',
    statistics: {
      total: allServices.length,
      byType,
      byStatus,
      byCategory
    }
  }
}

export default {
  async fetch(request: Request, env: Env, execCtx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request.headers.get('Origin') || undefined) })
    }

    // Create context for traceability
    const chittyCtx = contextFromRequest(request, 'transaction')

    // Health check
    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        service: 'chittyregister',
        version: '0.1.0',
        features: ['registration', 'validation', 'audit']
      })
    }

    // POST /api/v1/register - Register a new service
    if (url.pathname === '/api/v1/register' && request.method === 'POST') {
      try {
        const body = await request.json() as RegisterRequest

        const result = await registerService(env, body, chittyCtx)

        // Audit the registration attempt
        execCtx.waitUntil(logAudit(env, createAuditEvent(
          chittyCtx,
          'registry.register',
          result.success ? 'create' : 'reject',
          `/api/v1/register`,
          {
            serviceName: body.name,
            serviceType: body.type,
            success: result.success,
            errors: result.errors
          }
        )))

        const headers = new Headers(corsHeaders(request.headers.get('Origin') || undefined))
        addContextHeaders(headers, chittyCtx)

        if (!result.success) {
          return Response.json({
            success: false,
            errors: result.errors,
            _context: {
              id: chittyCtx.id,
              requestId: chittyCtx.requestId
            }
          }, { status: 400, headers })
        }

        return Response.json({
          success: true,
          registration: result.registration,
          message: 'Service registered successfully. Status: pending approval.',
          _context: {
            id: chittyCtx.id,
            requestId: chittyCtx.requestId,
            grade: chittyCtx.grade
          }
        }, { status: 201, headers })
      } catch (error) {
        return Response.json({
          success: false,
          error: 'Invalid request body. Expected JSON.'
        }, { status: 400 })
      }
    }

    // GET /api/v1/services - List all registered services
    if (url.pathname === '/api/v1/services' && request.method === 'GET') {
      const type = url.searchParams.get('type') || undefined
      const category = url.searchParams.get('category') || undefined
      const status = url.searchParams.get('status') || undefined
      const limit = parseInt(url.searchParams.get('limit') || '100')

      const services = await listServices(env, { type, category, status, limit })

      // Audit the query
      execCtx.waitUntil(logAudit(env, createAuditEvent(
        chittyCtx,
        'registry.list',
        'query',
        '/api/v1/services',
        {
          filters: { type, category, status, limit },
          resultCount: services.length
        }
      )))

      const headers = new Headers(corsHeaders(request.headers.get('Origin') || undefined))
      addContextHeaders(headers, chittyCtx)

      return Response.json({
        services,
        total: services.length,
        filters: { type, category, status, limit },
        _context: {
          id: chittyCtx.id,
          requestId: chittyCtx.requestId
        }
      }, { headers })
    }

    // GET /api/v1/services/:name - Get specific service
    if (url.pathname.startsWith('/api/v1/services/') && request.method === 'GET') {
      const serviceName = url.pathname.replace('/api/v1/services/', '').replace(/\/$/, '')

      if (!serviceName) {
        return Response.json({ error: 'Service name is required' }, { status: 400 })
      }

      const service = await getService(env, serviceName)

      // Audit the lookup
      execCtx.waitUntil(logAudit(env, createAuditEvent(
        chittyCtx,
        'registry.get',
        'read',
        `/api/v1/services/${serviceName}`,
        {
          serviceName,
          found: !!service
        }
      )))

      if (!service) {
        return Response.json({
          error: `Service '${serviceName}' not found`
        }, { status: 404 })
      }

      const headers = new Headers(corsHeaders(request.headers.get('Origin') || undefined))
      addContextHeaders(headers, chittyCtx)

      return Response.json({
        service,
        _context: {
          id: chittyCtx.id,
          requestId: chittyCtx.requestId
        }
      }, { headers })
    }

    // GET /api/v1/status - Registry status
    if (url.pathname === '/api/v1/status' && request.method === 'GET') {
      const status = await getRegistryStatus(env)

      const headers = new Headers(corsHeaders(request.headers.get('Origin') || undefined))
      addContextHeaders(headers, chittyCtx)

      return Response.json({
        ...status,
        timestamp: new Date().toISOString(),
        _context: {
          id: chittyCtx.id,
          requestId: chittyCtx.requestId
        }
      }, { headers })
    }

    // Route not found
    return Response.json({
      error: 'Not found',
      availableEndpoints: [
        'GET /health',
        'POST /api/v1/register',
        'GET /api/v1/services',
        'GET /api/v1/services/:name',
        'GET /api/v1/status'
      ]
    }, { status: 404 })
  }
}
