/**
 * ChittyMCP Gateway - mcp.chitty.cc
 * Aggregates MCP tools from all services
 *
 * Pattern: mcp.chitty.cc/{service}/* -> {service}.chitty.cc/mcp/*
 * Also: mcp.chitty.cc/tools -> aggregated tool list
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
    toolsCache = []
    for (const [service, route] of routeCache) {
      try {
        const res = await fetch(`${route.target}/tools`)
        if (res.ok) {
          const data = await res.json() as { tools?: MCPTool[] }
          if (data.tools) {
            toolsCache.push(...data.tools.map(t => ({ ...t, service })))
          }
        }
      } catch {
        // Skip unavailable services
      }
    }
  } catch (e) {
    console.error('Failed to refresh routes:', e)
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request.headers.get('Origin') || undefined) })
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
