/**
 * GPT-4 (OpenAI) Provider
 * Best for: Predictive modeling, forecasting
 */

import OpenAI from 'openai';
import type { ModelProvider, ModelTask, ModelResponse } from '../router';

export class GPT4Provider implements ModelProvider {
  name = 'gpt4';
  cost = 10.0; // $10 per 1M tokens (GPT-4 Turbo)

  private client: OpenAI;

  constructor(private env: any) {
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY
    });
  }

  async execute(task: ModelTask): Promise<ModelResponse> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{
        role: 'system',
        content: 'You are ChittyJanitor, a predictive AI cleanup agent specialized in forecasting and pattern prediction.'
      }, {
        role: 'user',
        content: this.buildPrompt(task)
      }],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsedResult = JSON.parse(content);

    return {
      result: parsedResult,
      model: 'gpt-4-turbo',
      tokens_used: response.usage?.total_tokens || 0,
      duration_ms: 0
    };
  }

  private buildPrompt(task: ModelTask): string {
    const context = task.context ? JSON.stringify(task.context, null, 2) : '';

    return `Task: ${task.type}

${task.prompt}

${context ? `Context:\n${context}` : ''}

Provide your response as JSON.`;
  }
}
