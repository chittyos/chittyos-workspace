/**
 * @chittyos/cloudflare-core
 *
 * Cloudflare Workers, API Gateway, AI Workers, and Vector storage utilities
 * for ChittyOS ecosystem integration
 */

// Core exports
export * from './workers/index.js';
export * from './ai/index.js';
export * from './vectorize/index.js';
export * from './auth/index.js';
export * from './types/index.js';
export { ChittyGatewayConfig, ChittyAccessPolicy, DEFAULT_CHITTY_ROUTES } from './gateway/index.js';

/**
 * ChittyOS Cloudflare Core initialization
 */
export interface ChittyCloudflareConfig {
  accountId: string;
  apiToken: string;
  environment: 'production' | 'staging' | 'development';
  services: {
    schema?: { enabled: boolean; domain: 'schema.chitty.cc' };
    id?: { enabled: boolean; domain: 'id.chitty.cc' };
    canon?: { enabled: boolean; domain: 'canon.chitty.cc' };
    registry?: { enabled: boolean; domain: 'registry.chitty.cc' };
    auth?: { enabled: boolean; domain: 'auth.chitty.cc' };
    chat?: { enabled: boolean; domain: 'chat.chitty.cc' };
    assets?: { enabled: boolean; domain: 'assets.chitty.cc' };
  };
  ai: {
    enabled: boolean;
    model?: string;
    vectorize?: {
      enabled: boolean;
      indexName?: string;
    };
  };
  gateway: {
    domains: string[];
    accessPolicies: boolean;
  };
}

export class ChittyCloudflareCore {
  private config: ChittyCloudflareConfig;

  constructor(config: ChittyCloudflareConfig) {
    this.config = config;
  }

  /**
   * Initialize Cloudflare services for ChittyOS integration
   */
  async initialize() {
    // Implementation for service initialization
    return {
      worker: await this.deployWorker(),
      gateway: await this.configureGateway(),
      ai: this.config.ai.enabled ? await this.initializeAI() : null,
      vectorize: this.config.ai.vectorize?.enabled ? await this.initializeVectorize() : null
    };
  }

  private async deployWorker() {
    // Worker deployment logic
    return { deployed: true, url: `https://${this.config.gateway.domains[0]}` };
  }

  private async configureGateway() {
    // Gateway configuration logic
    return { configured: true, policies: this.config.gateway.accessPolicies };
  }

  private async initializeAI() {
    // AI service initialization
    return { enabled: true, model: this.config.ai.model || '@cf/meta/llama-3.1-8b-instruct' };
  }

  private async initializeVectorize() {
    // Vectorize initialization
    return { enabled: true, indexName: this.config.ai.vectorize?.indexName || 'chitty-vectors' };
  }
}