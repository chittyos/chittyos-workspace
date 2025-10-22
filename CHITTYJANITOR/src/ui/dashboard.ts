/**
 * Dashboard Generator
 * Creates UX-friendly insights and visualizations
 */

import { ModelRouter } from '../models/router';
import type { DashboardData, Insight } from '../types';

export class DashboardGenerator {
  private router: ModelRouter;

  constructor(private env: any) {
    this.router = new ModelRouter(env);
  }

  async generate(): Promise<DashboardData> {
    return {
      overview: await this.getOverview(),
      predictions: await this.getPredictions(),
      insights: await this.generateInsights(),
      recommendations: await this.getRecommendations(),
      timeline: await this.getTimeline()
    };
  }

  async generateInsights(): Promise<Insight[]> {
    const state = await this.getState();
    const metrics = await this.getMetrics();

    // Use Claude for UX-friendly insight generation
    const response = await this.router.route({
      type: 'organize',
      prompt: `Generate user-friendly insights from cleanup data.

Focus on:
- Key patterns discovered
- Space saved over time
- Efficiency improvements
- Actionable recommendations

Make insights clear, concise, and valuable for non-technical users.`,
      context: {
        state,
        metrics
      },
      priority: 7
    });

    return response.result.insights || [];
  }

  private async getOverview(): Promise<any> {
    const state = await this.getState();

    return {
      intelligence_level: state.intelligence_level,
      total_runs: state.total_runs,
      total_saved_gb: (state.total_saved_bytes / 1024 / 1024 / 1024).toFixed(2),
      birth: state.birth,
      last_run: state.last_run,
      uptime_days: Math.floor(
        (Date.now() - new Date(state.birth).getTime()) / 1000 / 60 / 60 / 24
      )
    };
  }

  private async getPredictions(): Promise<any> {
    // Would integrate with PredictiveEngine
    return {
      next_cleanup: new Date().toISOString(),
      expected_savings: 0,
      priority: 5
    };
  }

  private async getRecommendations(): Promise<string[]> {
    return [
      'Run aggressive cleanup during off-hours',
      'Monitor npm cache growth',
      'Consider archiving old projects'
    ];
  }

  private async getTimeline(): Promise<any[]> {
    const metrics = await this.getMetrics();

    return metrics.slice(-20).map(m => ({
      timestamp: m.timestamp,
      action: m.target || 'cleanup',
      savings_mb: Math.floor((m.savings_bytes || 0) / 1024 / 1024)
    }));
  }

  private async getState(): Promise<any> {
    const stateJson = await this.env.JANITOR_STATE.get('state');
    return stateJson ? JSON.parse(stateJson) : {};
  }

  private async getMetrics(): Promise<any[]> {
    try {
      const object = await this.env.JANITOR_METRICS.get('metrics/latest.jsonl');
      if (!object) return [];

      const text = await object.text();
      return text.split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
    } catch {
      return [];
    }
  }
}
