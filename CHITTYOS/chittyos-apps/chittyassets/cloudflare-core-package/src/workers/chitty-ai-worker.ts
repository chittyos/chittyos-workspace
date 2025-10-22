/**
 * ChittyOS AI Worker Template
 * Processes AI requests across the ChittyOS ecosystem
 */

import { Ai } from '@cloudflare/ai';

export interface Env {
  AI: Ai;
  VECTORIZE_INDEX: VectorizeIndex;
  CHITTY_API_TOKEN: string;
  ENVIRONMENT: 'production' | 'staging' | 'development';

  // Service-specific bindings
  SCHEMA_SERVICE: string;
  ID_SERVICE: string;
  CANON_SERVICE: string;
  REGISTRY_SERVICE: string;
  AUTH_SERVICE: string;
  CHAT_SERVICE: string;
  ASSETS_SERVICE: string;
}

export interface ChittyAIRequest {
  service: 'schema' | 'id' | 'canon' | 'registry' | 'auth' | 'chat' | 'assets';
  operation: string;
  data: any;
  vectorize?: boolean;
  model?: string;
}

export interface ChittyAIResponse {
  success: boolean;
  data?: any;
  error?: string;
  vectors?: number[];
  confidence?: number;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-ChittyAuth-Token',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
      const body: ChittyAIRequest = await request.json();
      const response = await processChittyAIRequest(body, env);

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: (error as Error).message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};

async function processChittyAIRequest(request: ChittyAIRequest, env: Env): Promise<ChittyAIResponse> {
  const { service, operation, data, vectorize, model } = request;

  // Route to appropriate service processor
  switch (service) {
    case 'schema':
      return await processSchemaAI(operation, data, env, model);
    case 'id':
      return await processIdAI(operation, data, env, model);
    case 'canon':
      return await processCanonAI(operation, data, env, model);
    case 'registry':
      return await processRegistryAI(operation, data, env, model);
    case 'auth':
      return await processAuthAI(operation, data, env, model);
    case 'chat':
      return await processChatAI(operation, data, env, model, vectorize);
    case 'assets':
      return await processAssetsAI(operation, data, env, model, vectorize);
    default:
      throw new Error(`Unknown service: ${service}`);
  }
}

async function processSchemaAI(operation: string, data: any, env: Env, model?: string): Promise<ChittyAIResponse> {
  const aiModel = model || '@cf/meta/llama-3.1-8b-instruct';

  switch (operation) {
    case 'validate_schema':
      const validation = await env.AI.run(aiModel as any, {
        messages: [
          {
            role: 'system',
            content: 'You are a schema validation expert. Validate the provided schema and return a confidence score.'
          },
          {
            role: 'user',
            content: `Validate this schema: ${JSON.stringify(data.schema)}`
          }
        ]
      });

      return {
        success: true,
        data: validation,
        confidence: 0.95
      };

    case 'generate_schema':
      const schema = await env.AI.run(aiModel as any, {
        messages: [
          {
            role: 'system',
            content: 'Generate a JSON schema based on the provided requirements.'
          },
          {
            role: 'user',
            content: `Generate schema for: ${data.requirements}`
          }
        ]
      });

      return {
        success: true,
        data: schema,
        confidence: 0.88
      };

    default:
      throw new Error(`Unknown schema operation: ${operation}`);
  }
}

async function processIdAI(operation: string, data: any, env: Env, model?: string): Promise<ChittyAIResponse> {
  const aiModel = model || '@cf/meta/llama-3.1-8b-instruct';

  switch (operation) {
    case 'verify_identity':
      const verification = await env.AI.run(aiModel as any, {
        messages: [
          {
            role: 'system',
            content: 'You are an identity verification specialist. Analyze documents and return verification confidence.'
          },
          {
            role: 'user',
            content: `Verify identity from: ${JSON.stringify(data.documents)}`
          }
        ]
      });

      return {
        success: true,
        data: verification,
        confidence: 0.92
      };

    default:
      throw new Error(`Unknown ID operation: ${operation}`);
  }
}

async function processCanonAI(operation: string, data: any, env: Env, model?: string): Promise<ChittyAIResponse> {
  const aiModel = model || '@cf/meta/llama-3.1-8b-instruct';

  switch (operation) {
    case 'canonicalize_data':
      const canonical = await env.AI.run(aiModel as any, {
        messages: [
          {
            role: 'system',
            content: 'Convert data to canonical form following ChittyOS standards.'
          },
          {
            role: 'user',
            content: `Canonicalize: ${JSON.stringify(data.input)}`
          }
        ]
      });

      return {
        success: true,
        data: canonical,
        confidence: 0.96
      };

    default:
      throw new Error(`Unknown canon operation: ${operation}`);
  }
}

async function processRegistryAI(operation: string, data: any, env: Env, model?: string): Promise<ChittyAIResponse> {
  const aiModel = model || '@cf/meta/llama-3.1-8b-instruct';

  switch (operation) {
    case 'classify_registry_item':
      const classification = await env.AI.run(aiModel as any, {
        messages: [
          {
            role: 'system',
            content: 'Classify registry items into appropriate categories.'
          },
          {
            role: 'user',
            content: `Classify: ${JSON.stringify(data.item)}`
          }
        ]
      });

      return {
        success: true,
        data: classification,
        confidence: 0.91
      };

    default:
      throw new Error(`Unknown registry operation: ${operation}`);
  }
}

async function processAuthAI(operation: string, data: any, env: Env, model?: string): Promise<ChittyAIResponse> {
  const aiModel = model || '@cf/meta/llama-3.1-8b-instruct';

  switch (operation) {
    case 'risk_assessment':
      const risk = await env.AI.run(aiModel as any, {
        messages: [
          {
            role: 'system',
            content: 'Assess authentication risk based on user behavior patterns.'
          },
          {
            role: 'user',
            content: `Assess risk for: ${JSON.stringify(data.context)}`
          }
        ]
      });

      return {
        success: true,
        data: risk,
        confidence: 0.89
      };

    default:
      throw new Error(`Unknown auth operation: ${operation}`);
  }
}

async function processChatAI(operation: string, data: any, env: Env, model?: string, vectorize?: boolean): Promise<ChittyAIResponse> {
  const aiModel = model || '@cf/meta/llama-3.1-8b-instruct';

  switch (operation) {
    case 'chat_response':
      let context = '';

      if (vectorize && data.query) {
        // Generate embeddings for semantic search
        const embeddings = await env.AI.run('@cf/baai/bge-base-en-v1.5' as any, {
          text: data.query
        });

        // Search vector database
        const matches = await env.VECTORIZE_INDEX.query((embeddings as any).data[0], {
          topK: 5,
          returnMetadata: true
        });

        context = matches.matches.map(m => m.metadata?.text).join('\n');
      }

      const response = await env.AI.run(aiModel as any, {
        messages: [
          {
            role: 'system',
            content: `You are ChittyOS Assistant. Use this context if relevant: ${context}`
          },
          {
            role: 'user',
            content: data.message
          }
        ]
      });

      return {
        success: true,
        data: response,
        confidence: 0.87
      };

    default:
      throw new Error(`Unknown chat operation: ${operation}`);
  }
}

async function processAssetsAI(operation: string, data: any, env: Env, model?: string, vectorize?: boolean): Promise<ChittyAIResponse> {
  const aiModel = model || '@cf/meta/llama-3.1-8b-instruct';

  switch (operation) {
    case 'analyze_asset':
      const analysis = await env.AI.run('@cf/meta/llama-3.1-8b-instruct' as any, {
        messages: [
          {
            role: 'system',
            content: 'Analyze asset documents and extract key information including valuation factors.'
          },
          {
            role: 'user',
            content: `Analyze this asset: ${JSON.stringify(data.asset)}`
          }
        ]
      });

      // Generate embeddings for asset if vectorize is enabled
      let vectors = undefined;
      if (vectorize) {
        const embeddings = await env.AI.run('@cf/baai/bge-base-en-v1.5' as any, {
          text: data.asset.description || data.asset.title || ''
        });
        vectors = (embeddings as any).data[0];

        // Store in vector database
        await env.VECTORIZE_INDEX.upsert([{
          id: data.asset.id,
          values: vectors,
          metadata: {
            type: 'asset',
            title: data.asset.title,
            description: data.asset.description
          }
        }]);
      }

      return {
        success: true,
        data: analysis,
        vectors,
        confidence: 0.93
      };

    case 'value_asset':
      const valuation = await env.AI.run(aiModel as any, {
        messages: [
          {
            role: 'system',
            content: 'You are an asset valuation expert. Provide estimated value and confidence factors.'
          },
          {
            role: 'user',
            content: `Value this asset: ${JSON.stringify(data.asset)}`
          }
        ]
      });

      return {
        success: true,
        data: valuation,
        confidence: 0.85
      };

    default:
      throw new Error(`Unknown assets operation: ${operation}`);
  }
}