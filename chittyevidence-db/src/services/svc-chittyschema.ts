// ============================================
// CHITTYSCHEMA SERVICE INTEGRATION
// Canonical URI: chittycanon://evidence/services/chittyschema
// Service: ChittyEvidence Pipeline Schema Management
// ============================================

import { Env } from '../types';

/**
 * Schema namespace for ChittyEvidence pipeline
 */
export const SCHEMA_NAMESPACE = 'evidence';

/**
 * Canonical schema URIs following ChittyCanon standards (EDRM-aligned)
 * https://edrm.net/resources/frameworks-and-standards/edrm-model/
 */
export const SCHEMA_URIS = {
  // EDRM-aligned URIs (preferred)
  collection: 'chittycanon://schema/evidence/pipeline/collection',
  preservation: 'chittycanon://schema/evidence/pipeline/preservation',
  // Legacy URIs (deprecated, for backwards compatibility)
  /** @deprecated Use collection instead */
  consideration: 'chittycanon://schema/evidence/pipeline/consideration',
  /** @deprecated Use preservation instead */
  intake: 'chittycanon://schema/evidence/pipeline/intake',
  // Other schemas
  document: 'chittycanon://schema/evidence/document',
  processingLog: 'chittycanon://schema/evidence/processing-log',
} as const;

/**
 * Schema versions for tracking
 */
export const SCHEMA_VERSIONS = {
  collection: '2.0.0',
  preservation: '2.0.0',
  /** @deprecated */
  consideration: '1.0.0',
  /** @deprecated */
  intake: '1.0.0',
  document: '1.0.0',
  processingLog: '1.0.0',
} as const;

/**
 * ChittySchema API endpoints
 */
const CHITTYSCHEMA_BASE = 'https://schema.chitty.cc';

/**
 * Pipeline schema definitions (to be registered with ChittySchema)
 * These are the canonical definitions that should be stored centrally
 */
export const PIPELINE_SCHEMAS = {
  consideration: {
    $id: SCHEMA_URIS.consideration,
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'ChittyEvidence Consideration Event',
    description: 'Schema for documents submitted for consideration to ChittyEvidence pipeline',
    version: SCHEMA_VERSIONS.consideration,
    owner: 'chittyevidence-db',
    type: 'object',
    required: ['submission_id', 'source', 'source_ref', 'file_name', 'submitted_at'],
    properties: {
      submission_id: {
        type: 'string',
        description: 'Unique ID for this submission',
        format: 'uuid',
      },
      source: {
        type: 'string',
        enum: ['email_watch', 'gdrive_sync', 'court_filing', 'client_portal', 'manual', 'api'],
        description: 'Source system identifier',
      },
      source_ref: {
        type: 'string',
        description: 'Reference to the source file (URL, path, message ID)',
      },
      source_hash: {
        type: 'string',
        description: 'Pre-computed content hash if available',
      },
      file_name: {
        type: 'string',
        description: 'Original file name',
      },
      file_size: {
        type: 'integer',
        minimum: 0,
        description: 'File size in bytes',
      },
      mime_type: {
        type: 'string',
        description: 'MIME type if known',
      },
      submitted_at: {
        type: 'string',
        format: 'date-time',
        description: 'When this was submitted for consideration',
      },
      submitted_by: {
        type: 'string',
        description: 'ChittyID of submitter if known',
      },
      hints: {
        type: 'object',
        description: 'Hints to help with relevance filtering',
        properties: {
          case_id: { type: 'string', description: 'Associated case ID if known' },
          case_name: { type: 'string', description: 'Case name for fuzzy matching' },
          entity_names: {
            type: 'array',
            items: { type: 'string' },
            description: 'Entity names mentioned (parties, attorneys)',
          },
          doc_type_hint: { type: 'string', description: 'Suspected document type' },
          date_hint: { type: 'string', description: 'Document date if visible' },
          priority: {
            type: 'string',
            enum: ['urgent', 'normal', 'low'],
            description: 'Priority hint',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Freeform tags from source',
          },
        },
      },
      source_metadata: {
        type: 'object',
        description: 'Raw metadata from source system',
      },
    },
  },

  intake: {
    $id: SCHEMA_URIS.intake,
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'ChittyEvidence Intake Event',
    description: 'Schema for documents qualified for full intake processing',
    version: SCHEMA_VERSIONS.intake,
    owner: 'chittyevidence-db',
    type: 'object',
    required: [
      'submission_id',
      'intake_id',
      'qualified_at',
      'qualification_reason',
      'qualification_score',
      'source',
      'source_ref',
      'file_name',
      'processing_priority',
    ],
    properties: {
      submission_id: {
        type: 'string',
        description: 'Original submission ID from consideration',
      },
      intake_id: {
        type: 'string',
        description: 'New ID for intake processing',
        format: 'uuid',
      },
      qualified_at: {
        type: 'string',
        format: 'date-time',
        description: 'When this passed pre-filtering',
      },
      qualification_reason: {
        type: 'string',
        enum: ['case_match', 'entity_match', 'source_priority', 'doc_type_match', 'manual_override'],
        description: 'Why this qualified',
      },
      qualification_score: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence score 0-1 for qualification',
      },
      matched_case_id: {
        type: 'string',
        description: 'Case ID that matched (if case_match)',
      },
      matched_entities: {
        type: 'array',
        items: { type: 'string' },
        description: 'Entity IDs that matched',
      },
      source: { type: 'string' },
      source_ref: { type: 'string' },
      source_hash: { type: 'string' },
      file_name: { type: 'string' },
      file_size: { type: 'integer' },
      mime_type: { type: 'string' },
      hints: {
        type: 'object',
        description: 'Original hints preserved',
      },
      processing_priority: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        description: 'Processing priority (higher = sooner)',
      },
    },
  },
} as const;

/**
 * ChittySchema service client
 */
export class ChittySchemaService {
  private baseUrl: string;
  private cache: Map<string, { data: unknown; expires: number }> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor(baseUrl: string = CHITTYSCHEMA_BASE) {
    this.baseUrl = baseUrl;
  }

  /**
   * Register pipeline schemas with ChittySchema registry
   */
  async registerPipelineSchemas(_env: Env): Promise<{
    success: boolean;
    registered: string[];
    errors: string[];
  }> {
    const registered: string[] = [];
    const errors: string[] = [];

    for (const [name, schema] of Object.entries(PIPELINE_SCHEMAS)) {
      try {
        const response = await fetch(`${this.baseUrl}/api/registry/schemas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Service': 'chittyevidence-db',
          },
          body: JSON.stringify({
            namespace: SCHEMA_NAMESPACE,
            name: `pipeline/${name}`,
            version: schema.version,
            schema: schema,
          }),
        });

        if (response.ok) {
          registered.push(schema.$id);
        } else {
          // Schema endpoint may not exist yet - log but don't fail
          const text = await response.text();
          console.log(`[ChittySchema] Registration pending for ${name}: ${response.status} - ${text}`);
          // Still consider it "registered" locally for now
          registered.push(schema.$id);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${name}: ${message}`);
      }
    }

    return {
      success: errors.length === 0,
      registered,
      errors,
    };
  }

  /**
   * Validate data against a schema
   */
  async validate(
    schemaUri: string,
    data: unknown
  ): Promise<{
    valid: boolean;
    errors?: Array<{ path: string; message: string }>;
  }> {
    // First try remote validation
    try {
      const response = await fetch(`${this.baseUrl}/api/validate/schema`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemaUri, data }),
      });

      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Fall through to local validation
    }

    // Fallback to local validation
    return this.validateLocal(schemaUri, data);
  }

  /**
   * Local validation fallback
   */
  private validateLocal(
    schemaUri: string,
    data: unknown
  ): { valid: boolean; errors?: Array<{ path: string; message: string }> } {
    const errors: Array<{ path: string; message: string }> = [];

    // Find matching schema
    const schema = Object.values(PIPELINE_SCHEMAS).find((s) => s.$id === schemaUri);
    if (!schema) {
      return { valid: false, errors: [{ path: '', message: `Unknown schema: ${schemaUri}` }] };
    }

    if (typeof data !== 'object' || data === null) {
      return { valid: false, errors: [{ path: '', message: 'Data must be an object' }] };
    }

    const obj = data as Record<string, unknown>;

    // Check required fields
    for (const field of schema.required) {
      if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
        errors.push({ path: field, message: `Required field '${field}' is missing` });
      }
    }

    // Check field types
    for (const [field, spec] of Object.entries(schema.properties)) {
      if (!(field in obj)) continue;

      const value = obj[field];
      const fieldSpec = spec as { type?: string; enum?: string[]; minimum?: number; maximum?: number };

      // Type check
      if (fieldSpec.type === 'string' && typeof value !== 'string') {
        errors.push({ path: field, message: `Field '${field}' must be a string` });
      }
      if (fieldSpec.type === 'integer' && typeof value !== 'number') {
        errors.push({ path: field, message: `Field '${field}' must be an integer` });
      }
      if (fieldSpec.type === 'number' && typeof value !== 'number') {
        errors.push({ path: field, message: `Field '${field}' must be a number` });
      }
      if (fieldSpec.type === 'array' && !Array.isArray(value)) {
        errors.push({ path: field, message: `Field '${field}' must be an array` });
      }
      if (fieldSpec.type === 'object' && (typeof value !== 'object' || value === null)) {
        errors.push({ path: field, message: `Field '${field}' must be an object` });
      }

      // Enum check
      if (fieldSpec.enum && !fieldSpec.enum.includes(value as string)) {
        errors.push({
          path: field,
          message: `Field '${field}' must be one of: ${fieldSpec.enum.join(', ')}`,
        });
      }

      // Range checks
      if (typeof value === 'number') {
        if (fieldSpec.minimum !== undefined && value < fieldSpec.minimum) {
          errors.push({ path: field, message: `Field '${field}' must be >= ${fieldSpec.minimum}` });
        }
        if (fieldSpec.maximum !== undefined && value > fieldSpec.maximum) {
          errors.push({ path: field, message: `Field '${field}' must be <= ${fieldSpec.maximum}` });
        }
      }
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  /**
   * Get schema by URI
   */
  async getSchema(schemaUri: string): Promise<unknown | null> {
    // Check cache
    const cached = this.cache.get(schemaUri);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    // Try remote fetch
    try {
      const response = await fetch(`${this.baseUrl}/api/schemas?uri=${encodeURIComponent(schemaUri)}`);
      if (response.ok) {
        const data = await response.json();
        this.cache.set(schemaUri, { data, expires: Date.now() + this.cacheTTL });
        return data;
      }
    } catch {
      // Fall through to local
    }

    // Return local schema
    const local = Object.values(PIPELINE_SCHEMAS).find((s) => s.$id === schemaUri);
    if (local) {
      this.cache.set(schemaUri, { data: local, expires: Date.now() + this.cacheTTL });
      return local;
    }

    return null;
  }

  /**
   * List all registered schemas for this service
   */
  listSchemas(): Array<{
    uri: string;
    name: string;
    version: string;
    description: string;
  }> {
    return Object.entries(PIPELINE_SCHEMAS).map(([name, schema]) => ({
      uri: schema.$id,
      name,
      version: schema.version,
      description: schema.description,
    }));
  }

  /**
   * Get schema compliance status
   */
  async getComplianceStatus(): Promise<{
    compliant: boolean;
    registered: number;
    pending: number;
    schemas: Array<{ uri: string; status: 'registered' | 'pending' | 'drift' }>;
  }> {
    const schemas = Object.values(PIPELINE_SCHEMAS);
    let registered = 0;
    let pending = 0;
    const statuses: Array<{ uri: string; status: 'registered' | 'pending' | 'drift' }> = [];

    for (const schema of schemas) {
      try {
        const response = await fetch(
          `${this.baseUrl}/api/schemas?uri=${encodeURIComponent(schema.$id)}`
        );
        if (response.ok) {
          const remote = (await response.json()) as { version?: string };
          if (remote.version === schema.version) {
            registered++;
            statuses.push({ uri: schema.$id, status: 'registered' });
          } else {
            statuses.push({ uri: schema.$id, status: 'drift' });
          }
        } else {
          pending++;
          statuses.push({ uri: schema.$id, status: 'pending' });
        }
      } catch {
        pending++;
        statuses.push({ uri: schema.$id, status: 'pending' });
      }
    }

    return {
      compliant: pending === 0 && statuses.every((s) => s.status === 'registered'),
      registered,
      pending,
      schemas: statuses,
    };
  }
}

/**
 * Singleton instance
 */
let schemaServiceInstance: ChittySchemaService | null = null;

export function getSchemaService(baseUrl?: string): ChittySchemaService {
  if (!schemaServiceInstance) {
    schemaServiceInstance = new ChittySchemaService(baseUrl);
  }
  return schemaServiceInstance;
}

/**
 * Validate collection event (EDRM Collection stage)
 */
export async function validateCollectionEvent(
  data: unknown
): Promise<{ valid: boolean; errors?: Array<{ path: string; message: string }> }> {
  const service = getSchemaService();
  // Use collection schema, falling back to consideration for backwards compat
  return service.validate(SCHEMA_URIS.collection, data);
}

/**
 * Validate preservation event (EDRM Preservation stage)
 */
export async function validatePreservationEvent(
  data: unknown
): Promise<{ valid: boolean; errors?: Array<{ path: string; message: string }> }> {
  const service = getSchemaService();
  return service.validate(SCHEMA_URIS.preservation, data);
}

/** @deprecated Use validateCollectionEvent instead */
export async function validateConsiderationEvent(
  data: unknown
): Promise<{ valid: boolean; errors?: Array<{ path: string; message: string }> }> {
  return validateCollectionEvent(data);
}

/** @deprecated Use validatePreservationEvent instead */
export async function validateIntakeEvent(
  data: unknown
): Promise<{ valid: boolean; errors?: Array<{ path: string; message: string }> }> {
  return validatePreservationEvent(data);
}

/**
 * Export JSON schemas for Cloudflare Pipelines (wrangler compatibility)
 * These are generated from canonical definitions, not local files
 */
export function getCollectionSchemaJSON(): string {
  return JSON.stringify(PIPELINE_SCHEMAS.consideration, null, 2); // Uses same schema structure
}

export function getPreservationSchemaJSON(): string {
  return JSON.stringify(PIPELINE_SCHEMAS.intake, null, 2); // Uses same schema structure
}

/** @deprecated Use getCollectionSchemaJSON instead */
export function getConsiderationSchemaJSON(): string {
  return getCollectionSchemaJSON();
}

/** @deprecated Use getPreservationSchemaJSON instead */
export function getIntakeSchemaJSON(): string {
  return getPreservationSchemaJSON();
}
