/**
 * ChittyOS Workers Export Module
 */

export * from './chitty-ai-worker.js';

// Re-export worker types
export interface ChittyWorkerEnv {
  AI: Ai;
  VECTORIZE_INDEX: VectorizeIndex;
  CHITTY_API_TOKEN: string;
  ENVIRONMENT: 'production' | 'staging' | 'development';

  // Service bindings
  SCHEMA_SERVICE: string;
  ID_SERVICE: string;
  CANON_SERVICE: string;
  REGISTRY_SERVICE: string;
  AUTH_SERVICE: string;
  CHAT_SERVICE: string;
  ASSETS_SERVICE: string;
}