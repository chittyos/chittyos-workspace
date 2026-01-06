/**
 * ChittyAPI Gateway - api.chitty.cc
 * Routes requests to service API endpoints
 *
 * Pattern: api.chitty.cc/{service}/* -> {service}.chitty.cc/api/*
 */

import { getGatewayRoutes, parseServicePath, buildTargetUrl, proxyRequest, corsHeaders } from '@chittyos/core'
import type { GatewayRoute } from '@chittyos/core'

interface Env {
  ROUTES_CACHE?: KVNamespace
}

// In-memory route cache (refreshed periodically)
let routeCache: Map<string, GatewayRoute> = new Map()
let lastRefresh = 0
const CACHE_TTL = 60000 // 1 minute

async function refreshRoutes(env: Env): Promise<void> {
  const now = Date.now()
  if (now - lastRefresh < CACHE_TTL && routeCache.size > 0) return

  try {
    const routes = await getGatewayRoutes('api')
    routeCache = new Map(routes.map(r => [r.service, r]))
    lastRefresh = now
  } catch (e) {
    console.error('Failed to refresh routes:', e)
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request.headers.get('Origin') || undefined) })
    }

    // Health check
    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', service: 'chittyapi', routes: routeCache.size })
    }

    // List available routes
    if (url.pathname === '/' || url.pathname === '/routes') {
      await refreshRoutes(env)
      return Response.json({
        gateway: 'api.chitty.cc',
        services: Array.from(routeCache.keys()),
        usage: 'api.chitty.cc/{service}/...'
      })
    }

    // Parse service from path
    const parsed = parseServicePath(url.pathname)
    if (!parsed) {
      return Response.json({ error: 'Invalid path. Use: api.chitty.cc/{service}/...' }, { status: 400 })
    }

    // Refresh and lookup route
    await refreshRoutes(env)
    const route = routeCache.get(parsed.service)

    if (!route) {
      return Response.json({
        error: `Service '${parsed.service}' not found`,
        available: Array.from(routeCache.keys())
      }, { status: 404 })
    }

    // Build target URL and proxy
    const targetUrl = buildTargetUrl(route, parsed.remainder)

    try {
      const response = await proxyRequest(request, targetUrl, {
        addHeaders: {
          'X-Gateway': 'chittyapi',
          'X-Original-Host': url.host
        }
      })

      // Add CORS headers to response
      const newHeaders = new Headers(response.headers)
      Object.entries(corsHeaders(request.headers.get('Origin') || undefined))
        .forEach(([k, v]) => newHeaders.set(k, v))

      return new Response(response.body, {
        status: response.status,
        headers: newHeaders
      })
    } catch (e) {
      return Response.json({ error: 'Upstream error', service: parsed.service }, { status: 502 })
    }
  }
}
