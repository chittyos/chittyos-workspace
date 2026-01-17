/**
 * ChittyOS Organization Constants and Helpers
 */

export const ORGANIZATIONS = [
  'CHITTYFOUNDATION',
  'CHITTYOS',
  'CHITTYAPPS',
  'CHITTYCORP',
  'CHICAGOAPPS',
  'FURNISHED-CONDOS'
] as const;

export type Organization = typeof ORGANIZATIONS[number];

export interface OrganizationInfo {
  name: Organization;
  description: string;
  tier: 'foundation' | 'core' | 'apps' | 'corp' | 'external';
}

export const ORGANIZATION_INFO: Record<Organization, OrganizationInfo> = {
  CHITTYFOUNDATION: {
    name: 'CHITTYFOUNDATION',
    description: 'Core infrastructure & trust services',
    tier: 'foundation'
  },
  CHITTYOS: {
    name: 'CHITTYOS',
    description: 'Platform services & utilities',
    tier: 'core'
  },
  CHITTYAPPS: {
    name: 'CHITTYAPPS',
    description: 'User-facing applications',
    tier: 'apps'
  },
  CHITTYCORP: {
    name: 'CHITTYCORP',
    description: 'Corporate/enterprise services',
    tier: 'corp'
  },
  CHICAGOAPPS: {
    name: 'CHICAGOAPPS',
    description: 'Legal tech applications',
    tier: 'external'
  },
  'FURNISHED-CONDOS': {
    name: 'FURNISHED-CONDOS',
    description: 'Property management apps',
    tier: 'external'
  }
};

export const REQUIRED_SECRETS = {
  'chittyconnect-sync': ['CHITTYCONNECT_SERVICE_TOKEN'],
  'worker-deploy': ['CHITTYCONNECT_API_KEY', 'CLOUDFLARE_API_TOKEN'],
  'package-publish': ['CHITTYCONNECT_API_KEY', 'NPM_TOKEN']
} as const;

export const STANDARD_WORKFLOWS = [
  'chittyconnect-sync.yml',
  'deploy.yml',
  'ci.yml'
] as const;

export function isValidOrganization(org: string): org is Organization {
  return ORGANIZATIONS.includes(org as Organization);
}

export function getOrganizationInfo(org: Organization): OrganizationInfo {
  return ORGANIZATION_INFO[org];
}
