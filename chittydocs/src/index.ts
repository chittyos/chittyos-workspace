/**
 * ChittyDocs Gateway - docs.chitty.cc
 * Aggregates documentation from all services
 *
 * Pattern: docs.chitty.cc/{service}/* -> {service}.chitty.cc/docs/*
 * Also: docs.chitty.cc/ -> docs index
 */

import { getGatewayRoutes, parseServicePath, buildTargetUrl, proxyRequest, corsHeaders, listServices } from '@chittyos/core'
import type { GatewayRoute, ServiceRecord } from '@chittyos/core'

interface Env {}

let routeCache: Map<string, GatewayRoute> = new Map()
let servicesCache: ServiceRecord[] = []
let lastRefresh = 0
const CACHE_TTL = 60000

async function refreshRoutes(env: Env): Promise<void> {
  const now = Date.now()
  if (now - lastRefresh < CACHE_TTL && routeCache.size > 0) return

  try {
    const routes = await getGatewayRoutes('docs')
    routeCache = new Map(routes.map(r => [r.service, r]))
    servicesCache = await listServices({ exposes: 'docs' })
    lastRefresh = now
  } catch (e) {
    console.error('Failed to refresh routes:', e)
  }
}

function generateIndex(services: ServiceRecord[]): string {
  const byCategory = services.reduce((acc, s) => {
    const cat = s.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {} as Record<string, ServiceRecord[]>)

  let html = `<!DOCTYPE html>
<html>
<head>
  <title>ChittyOS Documentation</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 0 auto; padding: 2rem; }
    h1 { color: #333; }
    h2 { color: #666; margin-top: 2rem; }
    ul { list-style: none; padding: 0; }
    li { margin: 0.5rem 0; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .status { font-size: 0.8rem; color: #888; margin-left: 0.5rem; }
  </style>
</head>
<body>
  <h1>ChittyOS Documentation</h1>
  <p>Select a service to view its documentation.</p>
`

  for (const [category, svcs] of Object.entries(byCategory).sort()) {
    html += `  <h2>${category}</h2>\n  <ul>\n`
    for (const s of svcs.sort((a, b) => a.service_name.localeCompare(b.service_name))) {
      html += `    <li><a href="/${s.service_name}/">${s.service_name}</a><span class="status">${s.status}</span></li>\n`
    }
    html += `  </ul>\n`
  }

  html += `</body></html>`
  return html
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request.headers.get('Origin') || undefined) })
    }

    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', service: 'chittydocs' })
    }

    // Docs index
    if (url.pathname === '/' || url.pathname === '/index.html') {
      await refreshRoutes(env)
      return new Response(generateIndex(servicesCache), {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    // JSON index
    if (url.pathname === '/index.json') {
      await refreshRoutes(env)
      return Response.json({
        gateway: 'docs.chitty.cc',
        services: servicesCache.map(s => ({
          name: s.service_name,
          category: s.category,
          status: s.status,
          url: `https://docs.chitty.cc/${s.service_name}/`
        }))
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
        error: `Documentation for '${parsed.service}' not found`,
        available: Array.from(routeCache.keys())
      }, { status: 404 })
    }

    const targetUrl = buildTargetUrl(route, parsed.remainder)

    try {
      return await proxyRequest(request, targetUrl, {
        addHeaders: { 'X-Gateway': 'chittydocs' }
      })
    } catch {
      return Response.json({ error: 'Upstream error' }, { status: 502 })
    }
  }
}
