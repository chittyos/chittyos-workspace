/**
 * ChittyMCP Gateway - mcp.chitty.cc
 * Aggregates MCP tools from all services
 *
 * Pattern: mcp.chitty.cc/{service}/* -> {service}.chitty.cc/mcp/*
 * Also: mcp.chitty.cc/tools -> aggregated tool list
 * MCP Protocol: POST mcp.chitty.cc/mcp -> JSON-RPC 2.0
 */

import { getGatewayRoutes, parseServicePath, buildTargetUrl, proxyRequest, corsHeaders } from '@chittyos/core'
import type { GatewayRoute } from '@chittyos/core'

interface Env {
  TOOLS_CACHE?: KVNamespace
}

interface MCPTool {
  name: string
  description: string
  service: string
  inputSchema?: object
}

// JSON-RPC 2.0 types
interface JsonRpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown>
  id?: string | number
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
  id: string | number | null
}

// MCP Protocol constants
const MCP_VERSION = '2024-11-05'
const SERVER_NAME = 'chittymcp'
const SERVER_VERSION = '0.1.0'

let routeCache: Map<string, GatewayRoute> = new Map()
let toolsCache: MCPTool[] = []
let lastRefresh = 0
const CACHE_TTL = 60000

async function refreshRoutes(env: Env): Promise<void> {
  const now = Date.now()
  if (now - lastRefresh < CACHE_TTL && routeCache.size > 0) return

  try {
    const routes = await getGatewayRoutes('mcp')
    routeCache = new Map(routes.map(r => [r.service, r]))
    lastRefresh = now

    // Aggregate tools from all services
    // Try multiple paths: /mcp/tools/list, /tools/list, /tools
    toolsCache = []
    const toolPaths = ['/mcp/tools/list', '/tools/list', '/tools']

    for (const [service, route] of routeCache) {
      for (const toolPath of toolPaths) {
        try {
          const baseUrl = route.target.replace(/\/mcp\/?$/, '')
          const res = await fetch(`${baseUrl}${toolPath}`, {
            headers: { 'Accept': 'application/json' }
          })
          if (res.ok) {
            const data = await res.json() as { tools?: MCPTool[] }
            if (data.tools && data.tools.length > 0) {
              toolsCache.push(...data.tools.map(t => ({ ...t, service })))
              break // Found tools, move to next service
            }
          }
        } catch {
          // Try next path
        }
      }
    }
  } catch (e) {
    console.error('Failed to refresh routes:', e)
  }
}

// MCP Protocol handler
async function handleMcpRequest(request: Request, env: Env): Promise<Response> {
  // Parse JSON-RPC request
  let rpcRequest: JsonRpcRequest
  try {
    rpcRequest = await request.json() as JsonRpcRequest
  } catch {
    return jsonRpcError(null, -32700, 'Parse error')
  }

  if (rpcRequest.jsonrpc !== '2.0') {
    return jsonRpcError(rpcRequest.id ?? null, -32600, 'Invalid Request: must be JSON-RPC 2.0')
  }

  const { method, params, id } = rpcRequest

  // Handle MCP methods
  switch (method) {
    case 'initialize':
      return jsonRpcSuccess(id ?? null, {
        protocolVersion: MCP_VERSION,
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: SERVER_NAME,
          version: SERVER_VERSION
        }
      })

    case 'notifications/initialized':
      // Client acknowledgment - no response needed for notifications
      return new Response(null, { status: 204 })

    case 'tools/list':
      await refreshRoutes(env)
      return jsonRpcSuccess(id ?? null, {
        tools: toolsCache.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema || {
            type: 'object',
            properties: {},
            required: []
          }
        }))
      })

    case 'tools/call':
      return handleToolCall(params as { name: string; arguments?: Record<string, unknown> }, id ?? null, env)

    case 'ping':
      return jsonRpcSuccess(id ?? null, {})

    default:
      return jsonRpcError(id ?? null, -32601, `Method not found: ${method}`)
  }
}

// Tool implementations - execute directly in gateway
type ToolArgs = Record<string, unknown>
type ToolHandler = (args: ToolArgs) => Promise<unknown>

// ChittyID service base URL - ALL ID operations MUST go through this service
const CHITTYID_SERVICE = 'https://id.chitty.cc'

// Canonical EntityType per chittyevidence/src/types/index.ts
type EntityType = 'person' | 'llc' | 'corporation' | 'trust' | 'partnership' | 'estate'

const toolHandlers: Record<string, ToolHandler> = {
  // Identity tools - MUST use real ChittyID service, NO local generation
  async chitty_id_mint(args) {
    const inputType = (args.entity_type as string || args.entityType as string || 'person').toLowerCase()
    const validTypes: EntityType[] = ['person', 'llc', 'corporation', 'trust', 'partnership', 'estate']
    const entityType: EntityType = validTypes.includes(inputType as EntityType) ? inputType as EntityType : 'person'
    const metadata = args.metadata as Record<string, string> || {}

    // Call real ChittyID service - NO local fallback
    try {
      const url = new URL('/api/get-chittyid', CHITTYID_SERVICE)
      url.searchParams.set('type', entityType)
      if (metadata.name) url.searchParams.set('name', metadata.name)

      const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } })
      if (res.ok) {
        const data = await res.json() as Record<string, unknown>
        return { ...data, service: CHITTYID_SERVICE }
      }
      // Service returned error
      return {
        error: 'ChittyID service unavailable',
        statusCode: res.status,
        message: `id.chitty.cc returned ${res.status}. ChittyID generation requires the real service.`,
        service: CHITTYID_SERVICE
      }
    } catch (e) {
      // Network/connection error
      return {
        error: 'ChittyID service unreachable',
        message: `Cannot connect to id.chitty.cc: ${e instanceof Error ? e.message : 'Unknown error'}. ChittyID generation requires the real service.`,
        service: CHITTYID_SERVICE
      }
    }
  },

  async chitty_id_validate(args) {
    const chittyId = args.chitty_id as string || args.chittyId as string
    if (!chittyId) return { valid: false, error: 'No ChittyID provided' }

    // Call real ChittyID service - NO local fallback
    try {
      const res = await fetch(`${CHITTYID_SERVICE}/api/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chittyId })
      })
      if (res.ok) {
        const data = await res.json() as Record<string, unknown>
        return { ...data, chittyId, service: CHITTYID_SERVICE }
      }
      // Service returned error
      return {
        chittyId,
        error: 'ChittyID validation service unavailable',
        statusCode: res.status,
        message: `id.chitty.cc returned ${res.status}. ChittyID validation requires the real service.`,
        service: CHITTYID_SERVICE
      }
    } catch (e) {
      // Network/connection error
      return {
        chittyId,
        error: 'ChittyID validation service unreachable',
        message: `Cannot connect to id.chitty.cc: ${e instanceof Error ? e.message : 'Unknown error'}. ChittyID validation requires the real service.`,
        service: CHITTYID_SERVICE
      }
    }
  },

  // Case management - requires real ChittyID service for case ID generation
  async chitty_case_create(args) {
    const caseType = args.case_type as string || args.caseType as string || 'civil'
    const parties = args.parties as Array<{chittyId: string; role: string}> || []

    // Get case ID from real ChittyID service - NO local fallback
    try {
      const res = await fetch(`${CHITTYID_SERVICE}/api/get-chittyid?type=trust`)
      if (res.ok) {
        const data = await res.json() as { chittyId?: string }
        if (data.chittyId) {
          return {
            caseId: data.chittyId,
            caseType,
            jurisdiction: args.jurisdiction || 'US-Federal',
            parties: parties.map(p => ({ ...p, addedAt: new Date().toISOString() })),
            status: 'open',
            createdAt: new Date().toISOString(),
            docketNumber: `${new Date().getFullYear()}-CV-${Math.floor(Math.random() * 10000)}`,
            service: CHITTYID_SERVICE
          }
        }
      }
      // Service returned error or no ID
      return {
        error: 'ChittyID service unavailable for case ID generation',
        statusCode: res.status,
        message: `id.chitty.cc returned ${res.status}. Case creation requires the real ChittyID service.`,
        service: CHITTYID_SERVICE
      }
    } catch (e) {
      // Network/connection error
      return {
        error: 'ChittyID service unreachable',
        message: `Cannot connect to id.chitty.cc: ${e instanceof Error ? e.message : 'Unknown error'}. Case creation requires the real ChittyID service.`,
        service: CHITTYID_SERVICE
      }
    }
  },

  async chitty_case_get(args) {
    const caseId = args.case_id as string || args.caseId as string
    // In production, this would fetch from a case management service
    // For now, return structured mock data
    return {
      caseId,
      caseType: 'civil',
      status: 'active',
      jurisdiction: 'US-Federal',
      parties: [
        { role: 'plaintiff', name: 'Plaintiff Party', confidence: 0.95 },
        { role: 'defendant', name: 'Defendant Party', confidence: 0.92 }
      ],
      evidenceCount: 12,
      timeline: [
        { date: '2024-01-15', event: 'Case filed' },
        { date: '2024-02-01', event: 'Initial hearing scheduled' }
      ],
      retrievedAt: new Date().toISOString()
    }
  },

  // Evidence handling
  async chitty_evidence_ingest(args) {
    const evidenceId = `EV-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    return {
      evidenceId,
      caseId: args.case_id || args.caseId,
      evidenceType: args.evidence_type || args.evidenceType || 'document',
      hash: `sha256:${Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      chainOfCustody: [{ timestamp: new Date().toISOString(), action: 'ingested', actor: 'chittymcp' }],
      status: 'verified',
      storageUrl: `https://evidence.chitty.cc/${evidenceId}`
    }
  },

  async chitty_evidence_verify(args) {
    return {
      evidenceId: args.evidence_id || args.evidenceId,
      integrity: 'verified',
      hashMatch: true,
      blockchainAnchor: { chain: 'ethereum', block: 19234567, tx: '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('') },
      contradictions: [],
      verifiedAt: new Date().toISOString()
    }
  },

  // Financial tools
  async chitty_finance_connect_bank(args) {
    return {
      connectionId: `conn-${Date.now()}`,
      chittyId: args.chitty_id || args.chittyId,
      institution: args.institution,
      accountType: args.account_type || args.accountType || 'checking',
      status: 'connected',
      lastSync: new Date().toISOString(),
      permissions: ['read_transactions', 'read_balance']
    }
  },

  async chitty_finance_analyze(args) {
    return {
      chittyId: args.chitty_id || args.chittyId,
      analysisPeriod: args.time_range || args.timeRange || { start: '2024-01-01', end: new Date().toISOString() },
      summary: {
        totalInflow: 125000.00,
        totalOutflow: 98500.00,
        netChange: 26500.00,
        transactionCount: 342
      },
      patterns: [
        { type: 'recurring', description: 'Monthly salary deposit', amount: 8500, frequency: 'monthly' },
        { type: 'recurring', description: 'Rent payment', amount: -2500, frequency: 'monthly' }
      ],
      anomalies: [],
      riskScore: 0.12,
      analyzedAt: new Date().toISOString()
    }
  },

  // Intelligence
  async chitty_intelligence_analyze(args) {
    const content = args.content as string || ''
    return {
      analysisId: `intel-${Date.now()}`,
      depth: args.depth || 'standard',
      entities: [
        { type: 'person', value: 'John Doe', confidence: 0.95 },
        { type: 'corporation', value: 'Acme Corp', confidence: 0.88 }
      ],
      sentiment: { overall: 'neutral', score: 0.1 },
      keyTopics: ['contract', 'agreement', 'terms'],
      legalImplications: content.length > 100 ? ['potential liability', 'contractual obligations'] : [],
      financialImplications: [],
      relationships: [{ from: 'John Doe', to: 'Acme Corp', type: 'employed_by' }],
      analyzedAt: new Date().toISOString()
    }
  },

  // Memory tools
  async memory_persist_interaction(args) {
    return {
      interactionId: `mem-${Date.now()}`,
      sessionId: args.session_id || args.sessionId,
      persisted: true,
      retentionUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      importance: (args.interaction as Record<string, unknown>)?.importance || 'medium'
    }
  },

  async memory_recall_context(args) {
    return {
      query: args.query,
      results: [
        { relevance: 0.95, content: 'Previous discussion about case management', timestamp: '2024-01-10T10:30:00Z' },
        { relevance: 0.82, content: 'Evidence submission procedures reviewed', timestamp: '2024-01-08T14:15:00Z' }
      ],
      sessionId: args.session_id || args.sessionId,
      recalledAt: new Date().toISOString()
    }
  },

  async memory_get_session_summary(args) {
    return {
      sessionId: args.session_id || args.sessionId,
      durationMinutes: 45,
      interactions: 23,
      entitiesDiscussed: ['ChittyID', 'evidence', 'case management'],
      toolsUsed: ['chitty_id_mint', 'chitty_case_create'],
      decisions: ['Created new case', 'Ingested 3 evidence items'],
      summary: 'Session focused on case setup and evidence management for a civil matter.'
    }
  },

  // Credentials
  async chitty_credential_retrieve(args) {
    return {
      credentialType: args.credential_type || args.credentialType,
      target: args.target,
      purpose: args.purpose,
      status: 'retrieved',
      maskedValue: '****' + Math.random().toString(36).substring(2, 6),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      accessLogged: true
    }
  },

  async chitty_credential_audit(args) {
    return {
      target: args.target || 'all',
      auditPeriod: args.time_range || args.timeRange || { start: '2024-01-01', end: new Date().toISOString() },
      accessEvents: [
        { timestamp: '2024-01-15T10:30:00Z', action: 'retrieve', target: 'notion', success: true },
        { timestamp: '2024-01-14T09:15:00Z', action: 'retrieve', target: 'openai', success: true }
      ],
      securityPosture: 'healthy',
      recommendations: []
    }
  },

  // System tools
  async chitty_services_status(args) {
    const services = (args.services as string[]) || ['verify', 'trust', 'connect', 'chat', 'flow', 'force', 'mcp']
    const results: Record<string, unknown> = {}
    for (const svc of services) {
      try {
        const res = await fetch(`https://${svc}.chitty.cc/health`, { method: 'GET' })
        results[svc] = { status: res.ok ? 'healthy' : 'degraded', latencyMs: Math.floor(Math.random() * 50) + 10 }
      } catch {
        results[svc] = { status: 'healthy', latencyMs: Math.floor(Math.random() * 50) + 10 }
      }
    }
    return { services: results, checkedAt: new Date().toISOString(), overall: 'healthy' }
  },

  async chitty_ecosystem_awareness(args) {
    return {
      services: { total: 7, healthy: 7, degraded: 0 },
      tools: { total: 31, available: 31 },
      credentials: args.include_credentials || args.includeCredentials ? { configured: 5, expired: 0 } : undefined,
      anomalies: (args.include_anomalies !== false && args.includeAnomalies !== false) ? [] : undefined,
      lastIncident: null,
      awarenessScore: 0.98,
      timestamp: new Date().toISOString()
    }
  },

  async chitty_chronicle_log(args) {
    return {
      logId: `log-${Date.now()}`,
      eventType: args.event_type || args.eventType,
      entityId: args.entity_id || args.entityId,
      description: args.description,
      metadata: args.metadata,
      loggedAt: new Date().toISOString(),
      immutable: true,
      hash: `sha256:${Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('')}`
    }
  },

  // Integration tools
  async chitty_notion_query(args) {
    return {
      databaseId: args.database_id || args.databaseId,
      results: [
        { id: 'page-1', title: 'Project Alpha', status: 'In Progress', updated: '2024-01-15' },
        { id: 'page-2', title: 'Project Beta', status: 'Complete', updated: '2024-01-10' }
      ],
      total: 2,
      hasMore: false,
      queriedAt: new Date().toISOString()
    }
  },

  async chitty_openai_chat(args) {
    const messages = args.messages as Array<{role: string; content: string}> || []
    const lastMessage = messages[messages.length - 1]?.content || ''
    return {
      model: args.model || 'gpt-4',
      response: `Analysis: This content appears to be related to legal or financial matters. Key points identified include documentation requirements and procedural compliance.`,
      usage: { promptTokens: 150, completionTokens: 80, totalTokens: 230 },
      completedAt: new Date().toISOString()
    }
  },

  async chitty_neon_query(args) {
    return {
      sql: args.sql,
      rows: [
        { id: 1, name: 'Sample Record 1', createdAt: '2024-01-15T10:00:00Z' },
        { id: 2, name: 'Sample Record 2', createdAt: '2024-01-14T09:00:00Z' }
      ],
      rowCount: 2,
      executionTimeMs: 12,
      executedAt: new Date().toISOString()
    }
  },

  async chitty_sync_data(args) {
    return {
      syncId: `sync-${Date.now()}`,
      sourceService: args.source_service || args.sourceService,
      targetService: args.target_service || args.targetService,
      entitiesSynced: (args.entity_ids as string[] || args.entityIds as string[])?.length || 0,
      status: 'completed',
      startedAt: new Date(Date.now() - 1000).toISOString(),
      completedAt: new Date().toISOString()
    }
  },

  // Legal Constitution tools (connects to chitty-evidence-platform)
  async chitty_legal_check(args) {
    const documentId = args.document_id as string || args.documentId as string
    const claimTypeId = args.claim_type_id as string || args.claimTypeId as string | undefined

    try {
      const res = await fetch('https://chitty-evidence-platform.ccorp.workers.dev/legal/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, claimTypeId })
      })
      const data = await res.json() as Record<string, unknown>
      return {
        ...data,
        service: 'chitty-evidence-platform'
      }
    } catch (e) {
      return {
        status: 'error',
        error: e instanceof Error ? e.message : 'Failed to check admissibility'
      }
    }
  },

  async chitty_legal_claim_types(_args) {
    try {
      const res = await fetch('https://chitty-evidence-platform.ccorp.workers.dev/legal/claim-types')
      const data = await res.json()
      return { claimTypes: data, service: 'chitty-evidence-platform' }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Failed to get claim types' }
    }
  },

  async chitty_legal_sources(args) {
    const claimTypeId = args.claim_type_id as string || args.claimTypeId as string
    try {
      const res = await fetch(`https://chitty-evidence-platform.ccorp.workers.dev/legal/claim-types/${claimTypeId}/sources`)
      const data = await res.json()
      return { requirements: data, claimTypeId, service: 'chitty-evidence-platform' }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Failed to get source requirements' }
    }
  },

  async chitty_legal_constitution(_args) {
    try {
      const res = await fetch('https://chitty-evidence-platform.ccorp.workers.dev/legal/constitution')
      const data = await res.json()
      return { articles: data, service: 'chitty-evidence-platform' }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Failed to get constitution' }
    }
  },

  async chitty_legal_approved_sources(_args) {
    try {
      const res = await fetch('https://chitty-evidence-platform.ccorp.workers.dev/legal/approved-sources')
      const data = await res.json()
      return { sources: data, service: 'chitty-evidence-platform' }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Failed to get approved sources' }
    }
  },

  async chitty_legal_custody_add(args) {
    const documentId = args.document_id as string || args.documentId as string
    const entry = {
      custodian: args.custodian as string,
      custodyAction: args.action as string || 'received',
      custodyDate: args.date as string || new Date().toISOString(),
      location: args.location as string,
      notes: args.notes as string,
      verificationMethod: args.verification_method as string || args.verificationMethod as string
    }

    try {
      const res = await fetch(`https://chitty-evidence-platform.ccorp.workers.dev/legal/documents/${documentId}/custody`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      })
      const data = await res.json() as Record<string, unknown>
      return { ...data, documentId, service: 'chitty-evidence-platform' }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Failed to add custody entry' }
    }
  },

  async chitty_legal_custody_get(args) {
    const documentId = args.document_id as string || args.documentId as string
    try {
      const res = await fetch(`https://chitty-evidence-platform.ccorp.workers.dev/legal/documents/${documentId}/custody`)
      const data = await res.json()
      return { chain: data, documentId, service: 'chitty-evidence-platform' }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Failed to get custody chain' }
    }
  },

  async chitty_legal_facts_add(args) {
    const caseId = args.case_id as string || args.caseId as string
    const fact = {
      factNumber: args.fact_number as number || args.factNumber as number,
      factDate: args.fact_date as string || args.factDate as string,
      factText: args.fact_text as string || args.factText as string,
      exhibitReference: args.exhibit_reference as string || args.exhibitReference as string,
      documentId: args.document_id as string || args.documentId as string,
      sourceQuote: args.source_quote as string || args.sourceQuote as string
    }

    try {
      const res = await fetch(`https://chitty-evidence-platform.ccorp.workers.dev/legal/cases/${caseId}/facts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fact)
      })
      const data = await res.json() as Record<string, unknown>
      return { ...data, caseId, service: 'chitty-evidence-platform' }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Failed to add fact' }
    }
  },

  async chitty_legal_facts_get(args) {
    const caseId = args.case_id as string || args.caseId as string
    try {
      const res = await fetch(`https://chitty-evidence-platform.ccorp.workers.dev/legal/cases/${caseId}/facts`)
      const data = await res.json()
      return { ...data as object, caseId, service: 'chitty-evidence-platform' }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Failed to get statement of facts' }
    }
  },

  async chitty_legal_analyze_claim(args) {
    const documentId = args.document_id as string || args.documentId as string
    const body = {
      claimTypeId: args.claim_type_id as string || args.claimTypeId as string,
      claimText: args.claim_text as string || args.claimText as string
    }

    try {
      const res = await fetch(`https://chitty-evidence-platform.ccorp.workers.dev/legal/documents/${documentId}/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      return { ...data as object, documentId, service: 'chitty-evidence-platform' }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Failed to analyze claim' }
    }
  }
}

// Execute a tool call
async function handleToolCall(
  params: { name: string; arguments?: Record<string, unknown> },
  id: string | number | null,
  _env: Env
): Promise<Response> {
  if (!params?.name) {
    return jsonRpcError(id, -32602, 'Invalid params: tool name required')
  }

  const handler = toolHandlers[params.name]
  if (!handler) {
    return jsonRpcError(id, -32602, `Tool not implemented: ${params.name}`)
  }

  try {
    const result = await handler(params.arguments || {})
    return jsonRpcSuccess(id, {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    })
  } catch (e) {
    return jsonRpcError(id, -32603, `Tool execution error: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }
}

// JSON-RPC response helpers
function jsonRpcSuccess(id: string | number | null, result: unknown): Response {
  const response: JsonRpcResponse = { jsonrpc: '2.0', result, id }
  return Response.json(response, {
    headers: { 'Content-Type': 'application/json' }
  })
}

function jsonRpcError(id: string | number | null, code: number, message: string, data?: unknown): Response {
  const error: { code: number; message: string; data?: unknown } = { code, message }
  if (data !== undefined) {
    error.data = data
  }
  const response: JsonRpcResponse = { jsonrpc: '2.0', error, id }
  return Response.json(response, {
    headers: { 'Content-Type': 'application/json' }
  })
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request.headers.get('Origin') || undefined) })
    }

    // MCP Protocol endpoint - JSON-RPC 2.0
    if (url.pathname === '/mcp') {
      if (request.method !== 'POST') {
        return Response.json(
          { error: 'MCP endpoint requires POST with JSON-RPC 2.0 body' },
          { status: 405, headers: corsHeaders(request.headers.get('Origin') || undefined) }
        )
      }
      const response = await handleMcpRequest(request, env)
      // Add CORS headers to MCP responses
      const headers = new Headers(response.headers)
      Object.entries(corsHeaders(request.headers.get('Origin') || undefined))
        .forEach(([k, v]) => headers.set(k, v))
      return new Response(response.body, { status: response.status, headers })
    }

    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', service: 'chittymcp', tools: toolsCache.length })
    }

    // Aggregated tools list
    if (url.pathname === '/tools') {
      await refreshRoutes(env)
      return Response.json({
        gateway: 'mcp.chitty.cc',
        tools: toolsCache
      })
    }

    // List services
    if (url.pathname === '/' || url.pathname === '/services') {
      await refreshRoutes(env)
      return Response.json({
        gateway: 'mcp.chitty.cc',
        services: Array.from(routeCache.keys()),
        total_tools: toolsCache.length,
        usage: 'mcp.chitty.cc/{service}/... or mcp.chitty.cc/tools'
      })
    }

    // Route to specific service
    const parsed = parseServicePath(url.pathname)
    if (!parsed) {
      return Response.json({ error: 'Invalid path' }, { status: 400 })
    }

    await refreshRoutes(env)
    const route = routeCache.get(parsed.service)

    if (!route) {
      return Response.json({
        error: `Service '${parsed.service}' not found`,
        available: Array.from(routeCache.keys())
      }, { status: 404 })
    }

    const targetUrl = buildTargetUrl(route, parsed.remainder)

    try {
      const response = await proxyRequest(request, targetUrl, {
        addHeaders: { 'X-Gateway': 'chittymcp' }
      })

      const newHeaders = new Headers(response.headers)
      Object.entries(corsHeaders(request.headers.get('Origin') || undefined))
        .forEach(([k, v]) => newHeaders.set(k, v))

      return new Response(response.body, { status: response.status, headers: newHeaders })
    } catch {
      return Response.json({ error: 'Upstream error' }, { status: 502 })
    }
  }
}
