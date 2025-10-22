/**
 * ChittyOS Vectorize Integration
 * Vector storage and semantic search for the ChittyOS ecosystem
 */

export interface ChittyVectorizeConfig {
  indexName: string;
  dimensions: number;
  metric: 'cosine' | 'euclidean' | 'dot-product';
}

export interface ChittyVector {
  id: string;
  values: number[];
  metadata?: {
    service: 'schema' | 'id' | 'canon' | 'registry' | 'auth' | 'chat' | 'assets';
    type: string;
    title?: string;
    description?: string;
    created_at?: string;
    [key: string]: any;
  };
}

export interface ChittyVectorQuery {
  vector: number[];
  topK: number;
  filter?: Record<string, any>;
  includeMetadata?: boolean;
  includeValues?: boolean;
}

export interface ChittyVectorMatch {
  id: string;
  score: number;
  values?: number[];
  metadata?: Record<string, any>;
}

export interface ChittyVectorQueryResult {
  matches: ChittyVectorMatch[];
  count: number;
}

export class ChittyVectorizeClient {
  private index: VectorizeIndex;

  constructor(index: VectorizeIndex) {
    this.index = index;
  }

  /**
   * Store vectors for ChittyOS services
   */
  async upsert(vectors: ChittyVector[]): Promise<void> {
    const formattedVectors = vectors.map(v => ({
      id: v.id,
      values: v.values,
      metadata: {
        ...v.metadata,
        indexed_at: new Date().toISOString()
      }
    }));

    await this.index.upsert(formattedVectors);
  }

  /**
   * Semantic search across ChittyOS ecosystem
   */
  async query(query: ChittyVectorQuery): Promise<ChittyVectorQueryResult> {
    const result = await this.index.query(query.vector, {
      topK: query.topK,
      filter: query.filter,
      returnMetadata: query.includeMetadata ?? true,
      returnValues: query.includeValues ?? false
    });

    return {
      matches: result.matches.map(match => ({
        id: match.id,
        score: match.score,
        values: match.values ? Array.from(match.values) : undefined,
        metadata: match.metadata as any
      })),
      count: result.count
    };
  }

  /**
   * Delete vectors by ID
   */
  async delete(ids: string[]): Promise<void> {
    await this.index.deleteByIds(ids);
  }

  /**
   * Get vector by ID
   */
  async getById(id: string): Promise<ChittyVector | null> {
    const result = await this.index.getByIds([id]);
    if (result.length === 0) return null;

    const vector = result[0];
    return {
      id: vector.id,
      values: vector.values ? Array.from(vector.values) : [],
      metadata: vector.metadata as any
    };
  }

  /**
   * Service-specific vector operations
   */

  // Schema service vectors
  async storeSchemaVector(schemaId: string, embedding: number[], schema: any): Promise<void> {
    await this.upsert([{
      id: `schema:${schemaId}`,
      values: embedding,
      metadata: {
        service: 'schema',
        type: 'schema',
        title: schema.title || schema.name,
        description: schema.description,
        version: schema.version,
        schema_type: schema.type
      }
    }]);
  }

  // Identity service vectors
  async storeIdentityVector(identityId: string, embedding: number[], identity: any): Promise<void> {
    await this.upsert([{
      id: `identity:${identityId}`,
      values: embedding,
      metadata: {
        service: 'id',
        type: 'identity',
        verification_level: identity.verificationLevel,
        document_type: identity.documentType
      }
    }]);
  }

  // Registry service vectors
  async storeRegistryVector(itemId: string, embedding: number[], item: any): Promise<void> {
    await this.upsert([{
      id: `registry:${itemId}`,
      values: embedding,
      metadata: {
        service: 'registry',
        type: 'registry_item',
        title: item.title,
        description: item.description,
        category: item.category,
        tags: item.tags
      }
    }]);
  }

  // Chat service vectors
  async storeChatVector(messageId: string, embedding: number[], message: any): Promise<void> {
    await this.upsert([{
      id: `chat:${messageId}`,
      values: embedding,
      metadata: {
        service: 'chat',
        type: 'message',
        content: message.content.substring(0, 200), // Truncate for storage
        timestamp: message.timestamp,
        user_id: message.userId,
        conversation_id: message.conversationId
      }
    }]);
  }

  // Assets service vectors
  async storeAssetVector(assetId: string, embedding: number[], asset: any): Promise<void> {
    await this.upsert([{
      id: `asset:${assetId}`,
      values: embedding,
      metadata: {
        service: 'assets',
        type: 'asset',
        title: asset.title,
        description: asset.description,
        asset_type: asset.assetType,
        value: asset.estimatedValue,
        currency: asset.currency,
        owner_id: asset.ownerId
      }
    }]);
  }

  /**
   * Cross-service semantic search
   */
  async searchAcrossServices(embedding: number[], services: string[], limit: number = 10): Promise<ChittyVectorQueryResult> {
    return await this.query({
      vector: embedding,
      topK: limit,
      filter: {
        service: { $in: services }
      },
      includeMetadata: true
    });
  }

  /**
   * Find similar items within a service
   */
  async findSimilarInService(service: string, embedding: number[], limit: number = 5): Promise<ChittyVectorQueryResult> {
    return await this.query({
      vector: embedding,
      topK: limit,
      filter: {
        service: service
      },
      includeMetadata: true
    });
  }

  /**
   * Get service statistics
   */
  async getServiceStats(service: string): Promise<{ count: number; types: string[] }> {
    const result = await this.query({
      vector: new Array(1536).fill(0), // Dummy vector for filtering
      topK: 1000,
      filter: { service },
      includeMetadata: true
    });

    const types = [...new Set(result.matches.map(m => m.metadata?.type).filter(Boolean))];

    return {
      count: result.count,
      types
    };
  }
}

/**
 * AI Embeddings Generator for ChittyOS
 */
export class ChittyEmbeddingsGenerator {
  private ai: Ai;

  constructor(ai: Ai) {
    this.ai = ai;
  }

  /**
   * Generate embeddings for text content
   */
  async generateTextEmbedding(text: string): Promise<number[]> {
    const result = await this.ai.run('@cf/baai/bge-base-en-v1.5' as any, {
      text: text
    });

    return (result as any).data[0];
  }

  /**
   * Generate embeddings for structured data
   */
  async generateStructuredEmbedding(data: Record<string, any>): Promise<number[]> {
    // Convert structured data to searchable text
    const searchableText = this.structuredDataToText(data);
    return await this.generateTextEmbedding(searchableText);
  }

  /**
   * Generate embeddings for ChittyOS schema
   */
  async generateSchemaEmbedding(schema: any): Promise<number[]> {
    const schemaText = `${schema.title || ''} ${schema.description || ''} ${JSON.stringify(schema.properties || {})}`;
    return await this.generateTextEmbedding(schemaText);
  }

  /**
   * Generate embeddings for asset
   */
  async generateAssetEmbedding(asset: any): Promise<number[]> {
    const assetText = `${asset.title || ''} ${asset.description || ''} ${asset.assetType || ''} ${asset.category || ''}`;
    return await this.generateTextEmbedding(assetText);
  }

  private structuredDataToText(data: Record<string, any>): string {
    const parts: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        parts.push(`${key}: ${value}`);
      } else if (typeof value === 'number') {
        parts.push(`${key}: ${value.toString()}`);
      } else if (Array.isArray(value)) {
        parts.push(`${key}: ${value.join(', ')}`);
      } else if (typeof value === 'object' && value !== null) {
        parts.push(`${key}: ${JSON.stringify(value)}`);
      }
    }

    return parts.join(' ');
  }
}

/**
 * ChittyOS Vectorize Service Factory
 */
export function createChittyVectorizeService(index: VectorizeIndex, ai: Ai) {
  const client = new ChittyVectorizeClient(index);
  const embeddings = new ChittyEmbeddingsGenerator(ai);

  return {
    client,
    embeddings,

    // Convenience methods
    async indexContent(service: string, id: string, content: string, metadata: Record<string, any> = {}) {
      const embedding = await embeddings.generateTextEmbedding(content);
      await client.upsert([{
        id: `${service}:${id}`,
        values: embedding,
        metadata: {
          service: service as any,
          type: metadata.type || 'content',
          ...metadata,
          content: content.substring(0, 200) // Store truncated content
        }
      }]);
    },

    async semanticSearch(query: string, services: string[] = [], limit: number = 10) {
      const queryEmbedding = await embeddings.generateTextEmbedding(query);
      return await client.searchAcrossServices(queryEmbedding, services, limit);
    }
  };
}