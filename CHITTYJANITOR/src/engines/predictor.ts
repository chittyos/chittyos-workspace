/**
 * Predictive Engine
 * Forecasts cleanup needs and optimal timing
 */

import { ModelRouter } from '../models/router';
import type { CleanupPrediction } from '../types';

export class PredictiveEngine {
  private router: ModelRouter;

  constructor(private env: any) {
    this.router = new ModelRouter(env);
  }

  async predictCleanupNeeds(): Promise<CleanupPrediction> {
    // Get historical metrics
    const metrics = await this.getHistoricalMetrics();

    // Use GPT-4 for predictive analysis
    const prediction = await this.router.route({
      type: 'predict',
      prompt: `Analyze historical cleanup metrics and predict:
1. When the next cleanup should occur
2. Expected disk savings
3. Priority level (1-10)
4. Optimal cleanup level (conservative/aggressive/smart)

Provide predictions based on patterns, disk growth rate, and historical performance.`,
      context: {
        metrics,
        current_time: new Date().toISOString()
      },
      priority: 9
    });

    return {
      next_cleanup_recommended: prediction.result.next_cleanup_recommended || new Date().toISOString(),
      expected_savings_mb: prediction.result.expected_savings_mb || 0,
      priority: prediction.result.priority || 5,
      recommended_level: prediction.result.recommended_level || 'smart',
      confidence: prediction.result.confidence || 0.5,
      reasoning: prediction.result.reasoning || 'Insufficient historical data'
    };
  }

  async proactiveCleanup(): Promise<void> {
    const prediction = await this.predictCleanupNeeds();

    if (prediction.priority > 7) {
      console.log('[Predictor] High priority cleanup needed:', prediction);
      // Trigger cleanup via JanitorCore
    } else {
      console.log('[Predictor] No immediate cleanup needed');
    }
  }

  private async getHistoricalMetrics(): Promise<any[]> {
    // Get metrics from R2
    const metricsKey = 'metrics/latest.jsonl';

    try {
      const object = await this.env.JANITOR_METRICS.get(metricsKey);
      if (!object) return [];

      const text = await object.text();
      return text.split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))
        .slice(-100); // Last 100 metrics
    } catch (error) {
      console.error('[Predictor] Failed to load metrics:', error);
      return [];
    }
  }
}
