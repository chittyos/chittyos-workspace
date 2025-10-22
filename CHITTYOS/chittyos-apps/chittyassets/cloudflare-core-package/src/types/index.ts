/**
 * ChittyOS Cloudflare Core Types
 */

export interface ChittyService {
  enabled: boolean;
  domain: string;
}

export interface ChittyServices {
  schema?: ChittyService;
  id?: ChittyService;
  canon?: ChittyService;
  registry?: ChittyService;
  auth?: ChittyService;
  chat?: ChittyService;
  assets?: ChittyService;
}

export interface ChittyAIConfig {
  enabled: boolean;
  model?: string;
  vectorize?: {
    enabled: boolean;
    indexName?: string;
  };
}

export interface ChittyGatewayConfig {
  domains: string[];
  accessPolicies: boolean;
}

export type ChittyEnvironment = 'production' | 'staging' | 'development';

export interface ChittyServiceResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp?: string;
}

export interface ChittyVectorMetadata {
  service: string;
  type: string;
  title?: string;
  description?: string;
  created_at?: string;
  [key: string]: any;
}