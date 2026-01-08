import { ServiceConfig } from './types';

export const SERVICES: ServiceConfig[] = [
  {
    name: 'Schema Service',
    url: 'https://schema.chitty.cc',
    healthEndpoint: '/health',
    expectedStatus: 200,
    timeout: 5000,
  },
  {
    name: 'Identity Service',
    url: 'https://id.chitty.cc',
    healthEndpoint: '/health',
    expectedStatus: 200,
    timeout: 5000,
  },
  {
    name: 'Auth Service',
    url: 'https://auth.chitty.cc',
    healthEndpoint: '/health',
    expectedStatus: 200,
    timeout: 5000,
  },
  {
    name: 'Connect Service',
    url: 'https://connect.chitty.cc',
    healthEndpoint: '/health',
    expectedStatus: 200,
    timeout: 5000,
  },
  {
    name: 'Finance Service',
    url: 'https://finance.chitty.cc',
    healthEndpoint: '/health',
    expectedStatus: 200,
    timeout: 5000,
  },
  {
    name: 'Registry Service',
    url: 'https://registry.chitty.cc',
    healthEndpoint: '/health',
    expectedStatus: 200,
    timeout: 5000,
  },
  {
    name: 'API Service',
    url: 'https://api.chitty.cc',
    healthEndpoint: '/health',
    expectedStatus: 200,
    timeout: 5000,
  },
  {
    name: 'MCP Service',
    url: 'https://mcp.chitty.cc',
    healthEndpoint: '/health',
    expectedStatus: 200,
    timeout: 5000,
  },
  {
    name: 'Documentation',
    url: 'https://docs.chitty.cc',
    healthEndpoint: '/',
    expectedStatus: 200,
    timeout: 5000,
  },
  {
    name: 'Git Service',
    url: 'https://git.chitty.cc',
    healthEndpoint: '/health',
    expectedStatus: 200,
    timeout: 5000,
  },
  {
    name: 'Get Service',
    url: 'https://get.chitty.cc',
    healthEndpoint: '/health',
    expectedStatus: 200,
    timeout: 5000,
  },
];

export const SERVICE_MAP: Map<string, ServiceConfig> = new Map(
  SERVICES.map(service => [service.url.replace('https://', '').replace('.chitty.cc', ''), service])
);

export const KV_KEYS = {
  LATEST_STATUS: (service: string) => `status:latest:${service}`,
  HISTORY: (service: string, timestamp: string) => `history:${service}:${timestamp}`,
  ECOSYSTEM_STATUS: 'ecosystem:status:latest',
};
