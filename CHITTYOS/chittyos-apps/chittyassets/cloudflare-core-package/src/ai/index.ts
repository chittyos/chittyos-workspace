/**
 * ChittyOS AI Integration
 */

export interface ChittyAIModel {
  name: string;
  type: 'text' | 'embedding' | 'image' | 'multimodal';
  provider: 'cloudflare' | 'openai';
}

export const CHITTY_AI_MODELS: Record<string, ChittyAIModel> = {
  'llama-3.1-8b': {
    name: '@cf/meta/llama-3.1-8b-instruct',
    type: 'text',
    provider: 'cloudflare'
  },
  'bge-embeddings': {
    name: '@cf/baai/bge-base-en-v1.5',
    type: 'embedding',
    provider: 'cloudflare'
  },
  'whisper': {
    name: '@cf/openai/whisper',
    type: 'multimodal',
    provider: 'cloudflare'
  }
};

export class ChittyAIClient {
  private ai: Ai;

  constructor(ai: Ai) {
    this.ai = ai;
  }

  async runTextModel(model: string, messages: any[]) {
    return await this.ai.run(model as any, { messages });
  }

  async generateEmbeddings(text: string) {
    return await this.ai.run(CHITTY_AI_MODELS['bge-embeddings'].name as any, { text });
  }

  async transcribeAudio(audio: ArrayBuffer) {
    return await this.ai.run(CHITTY_AI_MODELS['whisper'].name as any, { audio });
  }
}

export * from './processors.js';