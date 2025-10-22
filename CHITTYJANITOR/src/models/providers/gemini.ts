/**
 * Gemini (Google) Provider
 * Best for: Large-scale analysis, discovery
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ModelProvider, ModelTask, ModelResponse } from '../router';

export class GeminiProvider implements ModelProvider {
  name = 'gemini';
  cost = 0.5; // $0.50 per 1M tokens (Gemini Pro)

  private genAI: GoogleGenerativeAI;

  constructor(private env: any) {
    this.genAI = new GoogleGenerativeAI(env.GOOGLE_API_KEY);
  }

  async execute(task: ModelTask): Promise<ModelResponse> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

    const result = await model.generateContent(this.buildPrompt(task));
    const response = await result.response;
    const text = response.text();

    // Try to parse as JSON
    let parsedResult: any;
    try {
      parsedResult = JSON.parse(text);
    } catch {
      parsedResult = text;
    }

    return {
      result: parsedResult,
      model: 'gemini-pro',
      tokens_used: 0, // Gemini doesn't provide token count in response
      duration_ms: 0
    };
  }

  private buildPrompt(task: ModelTask): string {
    const context = task.context ? JSON.stringify(task.context, null, 2) : '';

    return `You are ChittyJanitor, an AI cleanup agent specialized in discovery and exploration.

Task: ${task.type}

${task.prompt}

${context ? `Context:\n${context}` : ''}

Provide your response as JSON when possible.`;
  }
}
