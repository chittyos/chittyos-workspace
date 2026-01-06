/**
 * Registry client for discovering services
 */

import type { ServiceRecord, GatewayRoute, PackageMetadata } from './types'

const REGISTRY_URL = 'https://registry.chitty.cc'

export async function getService(serviceName: string): Promise<ServiceRecord | null> {
  try {
    const res = await fetch(`${REGISTRY_URL}/api/services/${serviceName}`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function listServices(filter?: {
  category?: string
  status?: string
  exposes?: string
}): Promise<ServiceRecord[]> {
  const params = new URLSearchParams()
  if (filter?.category) params.set('category', filter.category)
  if (filter?.status) params.set('status', filter.status)
  if (filter?.exposes) params.set('exposes', filter.exposes)

  try {
    const res = await fetch(`${REGISTRY_URL}/api/services?${params}`)
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export async function getGatewayRoutes(gateway: 'api' | 'mcp' | 'docs'): Promise<GatewayRoute[]> {
  const services = await listServices({ exposes: gateway })

  return services
    .filter(s => s.routes?.[gateway])
    .map(s => ({
      service: s.service_name,
      target: s.routes![gateway]!,
      auth: 'token' as const
    }))
}

export async function getPackageMetadata(packageName: string): Promise<PackageMetadata | null> {
  try {
    const res = await fetch(`${REGISTRY_URL}/api/packages/${packageName}`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
