/**
 * Registry client for discovering services
 * Uses static routes as primary source, with optional dynamic registry
 */

import type { ServiceRecord, GatewayRoute, PackageMetadata } from './types'

const REGISTRY_URL = 'https://registry.chitty.cc'

// Static service definitions - the source of truth for ChittyOS services
// Service names match subdomain (api.chitty.cc/schema/* → schema.chitty.cc/*)
const STATIC_SERVICES: Record<string, {
  baseUrl: string
  exposes: string[]
  category: ServiceRecord['category']
  status: ServiceRecord['status']
  description?: string
}> = {
  // Foundation services
  schema: { baseUrl: 'https://schema.chitty.cc', exposes: ['api', 'docs'], category: 'Foundation', status: 'Live', description: 'Schema validation and management' },
  id: { baseUrl: 'https://id.chitty.cc', exposes: ['api', 'docs'], category: 'Foundation', status: 'Live', description: 'ChittyID identity management' },
  auth: { baseUrl: 'https://auth.chitty.cc', exposes: ['api', 'docs'], category: 'Foundation', status: 'Live', description: 'Authentication and authorization' },
  registry: { baseUrl: 'https://registry.chitty.cc', exposes: ['api', 'docs'], category: 'Foundation', status: 'Live', description: 'Service and tool registry' },

  // Core services
  canon: { baseUrl: 'https://canon.chitty.cc', exposes: ['api', 'docs'], category: 'Core', status: 'Live', description: 'Canonical data and rules' },
  beacon: { baseUrl: 'https://beacon.chitty.cc', exposes: ['api', 'docs'], category: 'Core', status: 'Live', description: 'Health monitoring and alerts' },
  verify: { baseUrl: 'https://verify.chitty.cc', exposes: ['api', 'mcp', 'docs'], category: 'Core', status: 'Live', description: 'Verification and validation' },
  trust: { baseUrl: 'https://trust.chitty.cc', exposes: ['api', 'mcp', 'docs'], category: 'Core', status: 'Live', description: 'Trust scoring and reputation' },
  certify: { baseUrl: 'https://certify.chitty.cc', exposes: ['api', 'docs'], category: 'Core', status: 'Live', description: 'Certificate management' },

  // Platform services
  entry: { baseUrl: 'https://entry.chitty.cc', exposes: ['api', 'docs'], category: 'Platform', status: 'Live', description: 'Entry point and routing' },
  router: { baseUrl: 'https://router.chitty.cc', exposes: ['api', 'docs'], category: 'Platform', status: 'Live', description: 'Request routing' },
  connect: { baseUrl: 'https://connect.chitty.cc', exposes: ['api', 'mcp', 'docs'], category: 'Platform', status: 'Live', description: 'Service connections and integrations' },

  // Data services
  ledger: { baseUrl: 'https://ledger.chitty.cc', exposes: ['api', 'docs'], category: 'Data', status: 'Live', description: 'Immutable transaction ledger' },
  dna: { baseUrl: 'https://dna.chitty.cc', exposes: ['api', 'docs'], category: 'Data', status: 'Live', description: 'Data lineage and provenance' },

  // Domain services
  finance: { baseUrl: 'https://finance.chitty.cc', exposes: ['api', 'docs'], category: 'Domain', status: 'Live', description: 'Financial operations' },
  credit: { baseUrl: 'https://credit.chitty.cc', exposes: ['api', 'docs'], category: 'Domain', status: 'Live', description: 'Credit and scoring' },
  resolution: { baseUrl: 'https://resolution.chitty.cc', exposes: ['api', 'docs'], category: 'Domain', status: 'Live', description: 'Dispute resolution' },
  brand: { baseUrl: 'https://brand.chitty.cc', exposes: ['api', 'docs'], category: 'Domain', status: 'Live', description: 'Brand management' },

  // Application services
  chat: { baseUrl: 'https://chat.chitty.cc', exposes: ['api', 'mcp', 'docs'], category: 'Application', status: 'Live', description: 'ChittyChat conversational AI' },
  flow: { baseUrl: 'https://flow.chitty.cc', exposes: ['api', 'mcp', 'docs'], category: 'Application', status: 'Live', description: 'Workflow orchestration' },
  force: { baseUrl: 'https://force.chitty.cc', exposes: ['api', 'mcp', 'docs'], category: 'Application', status: 'Live', description: 'Task force management' },
  forge: { baseUrl: 'https://forge.chitty.cc', exposes: ['api', 'docs'], category: 'Application', status: 'Live', description: 'Code generation and tooling' },

  // Gateway services (this workspace)
  mcp: { baseUrl: 'https://mcp.chitty.cc', exposes: ['mcp', 'docs'], category: 'Platform', status: 'Live', description: 'MCP tool aggregation gateway' },
  docs: { baseUrl: 'https://docs.chitty.cc', exposes: ['docs'], category: 'Platform', status: 'Live', description: 'Documentation gateway' },
  get: { baseUrl: 'https://get.chitty.cc', exposes: ['api', 'docs'], category: 'Platform', status: 'Live', description: 'Discovery and onboarding gateway' },
  git: { baseUrl: 'https://git.chitty.cc', exposes: ['api'], category: 'Platform', status: 'Live', description: 'Package registry gateway' },
}

function getStaticRoutes(gateway: 'api' | 'mcp' | 'docs'): GatewayRoute[] {
  return Object.entries(STATIC_SERVICES)
    .filter(([_, config]) => config.exposes.includes(gateway))
    .map(([service, config]) => ({
      service,
      target: config.baseUrl,  // Route to service root, path passed through
      auth: 'token' as const
    }))
}

function staticToServiceRecord(name: string, config: typeof STATIC_SERVICES[string]): ServiceRecord {
  return {
    service_name: name,
    entity_type: 'Service',
    category: config.category,
    status: config.status,
    owners: ['chittyos'],
    github_repo: `https://github.com/CHITTYOS/${name}`,
    primary_domain: `${name}.chitty.cc`,
    exposes: {
      api: config.exposes.includes('api'),
      mcp: config.exposes.includes('mcp'),
      docs: config.exposes.includes('docs'),
      health: true
    },
    routes: {
      root: config.baseUrl,
      api: config.exposes.includes('api') ? config.baseUrl : undefined,
      mcp: config.exposes.includes('mcp') ? config.baseUrl : undefined,
      docs: config.exposes.includes('docs') ? config.baseUrl : undefined,
      health: `${config.baseUrl}/health`
    }
  }
}

export async function getService(serviceName: string): Promise<ServiceRecord | null> {
  // Check static services first
  const staticConfig = STATIC_SERVICES[serviceName]
  if (staticConfig) {
    return staticToServiceRecord(serviceName, staticConfig)
  }

  // Try remote registry as fallback
  try {
    const res = await fetch(`${REGISTRY_URL}/api/v1/search?q=${serviceName}&category=services`, {
      cf: { cacheTtl: 300 }
    } as RequestInit)
    if (!res.ok) return null
    const data = await res.json() as { results?: Array<{ name: string }> }
    if (data.results?.length) {
      // Found in registry - return basic record
      return {
        service_name: serviceName,
        entity_type: 'Service',
        category: 'Application',
        status: 'Live',
        owners: ['chittyos'],
        github_repo: `https://github.com/CHITTYOS/${serviceName}`,
        primary_domain: `${serviceName}.chitty.cc`
      }
    }
    return null
  } catch {
    return null
  }
}

export async function listServices(filter?: {
  category?: string
  status?: string
  exposes?: string
}): Promise<ServiceRecord[]> {
  // Build list from static services
  let services = Object.entries(STATIC_SERVICES).map(([name, config]) =>
    staticToServiceRecord(name, config)
  )

  // Apply filters
  if (filter?.category) {
    services = services.filter(s => s.category === filter.category)
  }
  if (filter?.status) {
    services = services.filter(s => s.status === filter.status)
  }
  if (filter?.exposes) {
    services = services.filter(s => s.exposes?.[filter.exposes as keyof typeof s.exposes])
  }

  return services
}

export async function getGatewayRoutes(gateway: 'api' | 'mcp' | 'docs'): Promise<GatewayRoute[]> {
  // Use static routes directly - they are the source of truth
  return getStaticRoutes(gateway)
}

// Static package metadata for common packages
const STATIC_PACKAGES: Record<string, PackageMetadata> = {
  chittyauth: { name: 'chittyauth', version: '1.0.0', description: 'ChittyOS authentication library', install_url: 'https://git.chitty.cc/chittyauth', platforms: ['npm'], npm: '@chittyos/auth' },
  chittyid: { name: 'chittyid', version: '1.0.0', description: 'ChittyID identity utilities', install_url: 'https://git.chitty.cc/chittyid', platforms: ['npm'], npm: '@chittyos/id' },
  chittyverify: { name: 'chittyverify', version: '1.0.0', description: 'Verification and validation', install_url: 'https://git.chitty.cc/chittyverify', platforms: ['npm'], npm: '@chittyos/verify' },
  chittytrust: { name: 'chittytrust', version: '1.0.0', description: 'Trust scoring utilities', install_url: 'https://git.chitty.cc/chittytrust', platforms: ['npm'], npm: '@chittyos/trust' },
  chittyconnect: { name: 'chittyconnect', version: '1.0.0', description: 'Service connection utilities', install_url: 'https://git.chitty.cc/chittyconnect', platforms: ['npm'], npm: '@chittyos/connect' },
  chittyledger: { name: 'chittyledger', version: '1.0.0', description: 'Ledger and transaction utilities', install_url: 'https://git.chitty.cc/chittyledger', platforms: ['npm'], npm: '@chittyos/ledger' },
  chittychat: { name: 'chittychat', version: '1.0.0', description: 'Conversational AI client', install_url: 'https://git.chitty.cc/chittychat', platforms: ['npm'], npm: '@chittyos/chat' },
  chittyflow: { name: 'chittyflow', version: '1.0.0', description: 'Workflow orchestration', install_url: 'https://git.chitty.cc/chittyflow', platforms: ['npm'], npm: '@chittyos/flow' },
  chittycore: { name: 'chittycore', version: '1.0.0', description: 'Core ChittyOS utilities', install_url: 'https://git.chitty.cc/chittycore', platforms: ['npm'], npm: '@chittyos/core' },
}

export async function getPackageMetadata(packageName: string): Promise<PackageMetadata | null> {
  // Check static packages first
  const staticPkg = STATIC_PACKAGES[packageName]
  if (staticPkg) return staticPkg

  // Fallback to remote registry
  try {
    const res = await fetch(`${REGISTRY_URL}/api/v1/search?q=${packageName}`, {
      cf: { cacheTtl: 300 }
    } as RequestInit)
    if (!res.ok) return null
    const data = await res.json() as { results?: Array<{ name: string; path: string }> }
    if (data.results?.length) {
      return {
        name: packageName,
        version: '1.0.0',
        description: `${packageName} package`,
        install_url: `https://git.chitty.cc/${packageName}`,
        platforms: ['npm'],
        npm: `@chittyos/${packageName.replace('chitty', '')}`
      }
    }
    return null
  } catch {
    return null
  }
}
