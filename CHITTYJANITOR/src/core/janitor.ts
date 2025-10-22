/**
 * ChittyJanitor Core
 * Main orchestration and state management
 */

import { ModelRouter } from '../models/router';
import type { JanitorState, CleanupResult } from '../types';

export class JanitorCore {
  private router: ModelRouter;

  constructor(private env: any) {
    this.router = new ModelRouter(env);
  }

  async getState(): Promise<JanitorState> {
    const stateJson = await this.env.JANITOR_STATE.get('state');

    if (!stateJson) {
      return this.initializeState();
    }

    return JSON.parse(stateJson);
  }

  private async initializeState(): Promise<JanitorState> {
    const state: JanitorState = {
      version: '3.0.0',
      birth: new Date().toISOString(),
      intelligence_level: 1,
      total_runs: 0,
      total_saved_bytes: 0,
      last_run: null,
      patterns: {
        temporal: {},
        targets: {}
      }
    };

    await this.saveState(state);
    return state;
  }

  private async saveState(state: JanitorState): Promise<void> {
    await this.env.JANITOR_STATE.put('state', JSON.stringify(state));
  }

  async performCleanup(level: 'conservative' | 'aggressive' | 'smart'): Promise<CleanupResult> {
    const state = await this.getState();

    // Use AI to determine optimal cleanup strategy
    const strategy = await this.router.route({
      type: 'analyze',
      prompt: `Analyze current state and recommend cleanup strategy for ${level} mode`,
      context: {
        state,
        level,
        environment: await this.getEnvironmentContext()
      },
      priority: 8
    });

    // Execute cleanup (this would integrate with actual cleanup logic)
    const result: CleanupResult = {
      level,
      saved_bytes: 0, // Would be calculated from actual cleanup
      duration_ms: 0,
      targets_cleaned: [],
      timestamp: new Date().toISOString()
    };

    // Update state
    state.total_runs += 1;
    state.total_saved_bytes += result.saved_bytes;
    state.last_run = result.timestamp;
    state.intelligence_level = Math.floor(state.total_runs / 10) + 1;

    await this.saveState(state);

    return result;
  }

  async discoverRoles(): Promise<any> {
    const context = await this.getEnvironmentContext();

    const discoveries = await this.router.route({
      type: 'discover',
      prompt: 'Analyze environment and discover new helpful assistant roles',
      context,
      priority: 6
    });

    return discoveries.result;
  }

  private async getEnvironmentContext(): Promise<any> {
    return {
      timestamp: new Date().toISOString(),
      platform: 'cloudflare-workers',
      version: this.env.VERSION
    };
  }
}
