/**
 * Core types for ChittyOS ecosystem
 */

export interface ServiceRecord {
  service_name: string
  entity_type: 'Service'
  category: 'Foundation' | 'Core' | 'Data' | 'Platform' | 'Domain' | 'Sync' | 'Application'
  status: 'Planned' | 'In Progress' | 'Needs Deployment' | 'Live' | 'Active' | 'Deprecated'
  owners: string[]
  github_repo: string
  primary_domain: string
  exposes?: {
    api?: boolean
    mcp?: boolean
    openapi?: boolean
    docs?: boolean
    health?: boolean
  }
  routes?: {
    root?: string
    api?: string
    mcp?: string
    docs?: string
    health?: string
  }
}

export interface GatewayRoute {
  service: string
  target: string
  methods?: string[]
  auth?: 'none' | 'token' | 'oauth'
}

export interface PackageMetadata {
  name: string
  version: string
  description: string
  install_url: string
  npm?: string
  brew?: string
  platforms: ('npm' | 'brew' | 'binary' | 'worker')[]
  dependencies?: string[]
}

export interface DiscoveryResult {
  service: string
  confidence: number
  reason: string
  install_method: 'npm' | 'brew' | 'binary' | 'worker'
  onboard_url: string
}
