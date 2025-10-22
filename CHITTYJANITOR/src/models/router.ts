/**
 * Multi-Model Router
 * Routes tasks to optimal AI models
 */

import { ClaudeProvider } from './providers/claude';
import { GPT4Provider } from './providers/gpt4';
import { GeminiProvider } from './providers/gemini';
import { LlamaProvider } from './providers/llama';

export interface ModelProvider {
  name: string;
  execute(task: ModelTask): Promise<ModelResponse>;
  cost: number; // Cost per 1M tokens
}

export interface ModelTask {
  type: 'analyze' | 'predict' | 'discover' | 'execute' | 'organize';
  prompt: string;
  context?: any;
  priority?: number;
}

export interface ModelResponse {
  result: any;
  model: string;
  tokens_used: number;
  duration_ms: number;
}

export class ModelRouter {
  private providers: Map<string, ModelProvider>;

  constructor(private env: any) {
    this.providers = new Map([
      ['claude', new ClaudeProvider(env)],
      ['gpt4', new GPT4Provider(env)],
      ['gemini', new GeminiProvider(env)],
      ['llama', new LlamaProvider(env)]
    ]);
  }

  /**
   * Route task to optimal model based on type and requirements
   */
  async route(task: ModelTask): Promise<ModelResponse> {
    const provider = this.selectProvider(task);

    const start = Date.now();
    const result = await provider.execute(task);
    const duration = Date.now() - start;

    // Log routing decision
    console.log(`[ModelRouter] ${task.type} → ${provider.name} (${duration}ms)`);

    return {
      ...result,
      duration_ms: duration
    };
  }

  /**
   * Select optimal provider based on task characteristics
   */
  private selectProvider(task: ModelTask): ModelProvider {
    switch (task.type) {
      case 'analyze':
        // Claude excels at analysis and pattern recognition
        return this.providers.get('claude')!;

      case 'predict':
        // GPT-4 for predictive modeling
        return this.providers.get('gpt4')!;

      case 'discover':
        // Gemini for exploration and discovery
        return this.providers.get('gemini')!;

      case 'execute':
        // LLaMA for fast, cost-effective execution
        return this.providers.get('llama')!;

      case 'organize':
        // Claude for UX organization
        return this.providers.get('claude')!;

      default:
        // Default to Claude
        return this.providers.get('claude')!;
    }
  }

  /**
   * Execute with fallback chain
   */
  async executeWithFallback(task: ModelTask): Promise<ModelResponse> {
    const fallbackChain = ['claude', 'gpt4', 'gemini', 'llama'];

    for (const providerName of fallbackChain) {
      try {
        const provider = this.providers.get(providerName);
        if (!provider) continue;

        return await provider.execute(task);
      } catch (error) {
        console.error(`[ModelRouter] ${providerName} failed:`, error);
        continue;
      }
    }

    throw new Error('All model providers failed');
  }

  /**
   * Parallel execution across multiple models
   */
  async executeParallel(tasks: ModelTask[]): Promise<ModelResponse[]> {
    return Promise.all(tasks.map(task => this.route(task)));
  }

  /**
   * Cost-optimized execution
   */
  async executeCostOptimized(task: ModelTask): Promise<ModelResponse> {
    // For non-critical tasks, use cheapest model
    if (!task.priority || task.priority < 7) {
      const llama = this.providers.get('llama')!;
      return llama.execute(task);
    }

    // For critical tasks, use best model
    return this.route(task);
  }
}
