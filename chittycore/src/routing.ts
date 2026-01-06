/**
 * Routing utilities for gateway services
 */

import type { GatewayRoute } from './types'

export function parseServicePath(path: string): { service: string; remainder: string } | null {
  // Expects: /{service}/... or /{service}
  const match = path.match(/^\/([a-z][a-z0-9-]*)(.*)$/)
  if (!match) return null

  return {
    service: match[1],
    remainder: match[2] || '/'
  }
}

export function buildTargetUrl(route: GatewayRoute, remainder: string): string {
  const base = route.target.replace(/\/$/, '')
  return `${base}${remainder}`
}

export async function proxyRequest(
  request: Request,
  targetUrl: string,
  options?: {
    addHeaders?: Record<string, string>
    removeHeaders?: string[]
  }
): Promise<Response> {
  const headers = new Headers(request.headers)

  // Remove hop-by-hop headers
  const hopHeaders = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade']
  hopHeaders.forEach(h => headers.delete(h))

  // Remove specified headers
  options?.removeHeaders?.forEach(h => headers.delete(h))

  // Add specified headers
  if (options?.addHeaders) {
    Object.entries(options.addHeaders).forEach(([k, v]) => headers.set(k, v))
  }

  return fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'follow'
  })
}

export function corsHeaders(origin?: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  }
}
