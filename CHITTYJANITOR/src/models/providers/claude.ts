/**
 * Claude (Anthropic) Provider
 * Best for: Analysis, strategic planning, UX organization
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ModelProvider, ModelTask, ModelResponse } from '../router';

export class ClaudeProvider implements ModelProvider {
  name = 'claude';
  cost = 3.0; // $3 per 1M tokens (Claude 3.5 Sonnet)

  private client: Anthropic;

  constructor(private env: any) {
    this.client = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY
    });
  }

  async execute(task: ModelTask): Promise<ModelResponse> {
    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: this.buildPrompt(task)
      }]
    });

    const content = response.content[0];
    const result = content.type === 'text' ? content.text : '';

    // Try to parse as JSON if possible
    let parsedResult: any;
    try {
      parsedResult = JSON.parse(result);
    } catch {
      parsedResult = result;
    }

    return {
      result: parsedResult,
      model: 'claude-3-5-sonnet',
      tokens_used: response.usage.input_tokens + response.usage.output_tokens,
      duration_ms: 0 // Will be set by router
    };
  }

  private buildPrompt(task: ModelTask): string {
    const context = task.context ? JSON.stringify(task.context, null, 2) : '';

    return `You are ChittyJanitor, an adaptive AI cleanup agent.

Task: ${task.type}

${task.prompt}

${context ? `Context:\n${context}` : ''}

Provide your response as JSON when possible.`;
  }
}
