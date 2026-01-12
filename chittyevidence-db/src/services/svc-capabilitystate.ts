/**
 * CapabilityStateStore - Domain-local persistence for capability state
 *
 * Each Chemist owns its capability state. This service provides:
 * - Invocation recording (the accountability trail)
 * - Metrics aggregation (for rollout decisions)
 * - Status history (for audit and rollback)
 *
 * ChittyConnect doesn't touch this - it's internal to the domain.
 */

import type {
  CapabilityDefinition,
  CapabilityInvocation,
  CapabilityMetrics,
  CapabilityStatus,
  RolloutRule,
} from '@chittyos/core';
import { Env } from '../types';
import { generateId } from '../utils';

export interface StatusTransition {
  id: string;
  capabilityId: string;
  fromStatus: CapabilityStatus;
  toStatus: CapabilityStatus;
  reason: string;
  triggeredBy: 'rollout_rule' | 'manual' | 'incident';
  triggeredRule?: RolloutRule;
  timestamp: string;
}

export class CapabilityStateStore {
  constructor(private env: Env) {}

  // ============================================
  // INVOCATION RECORDING
  // ============================================

  async recordInvocation(invocation: CapabilityInvocation): Promise<void> {
    await this.env.DB.prepare(
      `INSERT INTO capability_invocations
       (invocation_id, capability_id, capability_version, context_id, chitty_id,
        status, timestamp, duration_ms, success, error_code, input_hash, output_hash, parent_invocations)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      invocation.invocationId,
      invocation.capabilityId,
      invocation.capabilityVersion,
      invocation.contextId,
      invocation.chittyId,
      invocation.status,
      invocation.timestamp,
      invocation.durationMs,
      invocation.success ? 1 : 0,
      invocation.errorCode || null,
      invocation.inputHash,
      invocation.outputHash || null,
      invocation.parentInvocations ? JSON.stringify(invocation.parentInvocations) : null
    ).run();
  }

  async getInvocations(
    capabilityId: string,
    options?: {
      since?: string;
      limit?: number;
      successOnly?: boolean;
    }
  ): Promise<CapabilityInvocation[]> {
    let query = `SELECT * FROM capability_invocations WHERE capability_id = ?`;
    const params: (string | number)[] = [capabilityId];

    if (options?.since) {
      query += ` AND timestamp >= ?`;
      params.push(options.since);
    }

    if (options?.successOnly !== undefined) {
      query += ` AND success = ?`;
      params.push(options.successOnly ? 1 : 0);
    }

    query += ` ORDER BY timestamp DESC`;

    if (options?.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }

    const result = await this.env.DB.prepare(query).bind(...params).all();

    return (result.results as any[]).map(this.mapInvocation);
  }

  // ============================================
  // METRICS CALCULATION
  // ============================================

  async calculateMetrics(
    capabilityId: string,
    windowHours: number = 168 // 7 days default
  ): Promise<CapabilityMetrics> {
    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

    // Get aggregate stats
    const stats = await this.env.DB.prepare(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
         AVG(duration_ms) as avg_duration,
         COUNT(DISTINCT context_id) as unique_contexts
       FROM capability_invocations
       WHERE capability_id = ? AND timestamp >= ?`
    ).bind(capabilityId, windowStart).first<{
      total: number;
      successes: number;
      avg_duration: number;
      unique_contexts: number;
    }>();

    // Get error breakdown
    const errors = await this.env.DB.prepare(
      `SELECT error_code, COUNT(*) as count
       FROM capability_invocations
       WHERE capability_id = ? AND timestamp >= ? AND error_code IS NOT NULL
       GROUP BY error_code`
    ).bind(capabilityId, windowStart).all();

    const errorBreakdown: Record<string, number> = {};
    for (const row of errors.results as any[]) {
      errorBreakdown[row.error_code] = row.count;
    }

    const total = stats?.total || 0;
    const successes = stats?.successes || 0;

    return {
      capabilityId,
      windowStart,
      windowEnd: new Date().toISOString(),
      totalInvocations: total,
      successCount: successes,
      failureCount: total - successes,
      successRate: total > 0 ? successes / total : 0,
      avgDurationMs: stats?.avg_duration || 0,
      uniqueContexts: stats?.unique_contexts || 0,
      errorBreakdown,
    };
  }

  async persistMetrics(metrics: CapabilityMetrics): Promise<void> {
    await this.env.DB.prepare(
      `INSERT OR REPLACE INTO capability_metrics
       (capability_id, window_hours, total_invocations, success_count, failure_count,
        success_rate, avg_duration_ms, unique_contexts, error_breakdown, last_calculated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      metrics.capabilityId,
      168, // 7 days
      metrics.totalInvocations,
      metrics.successCount,
      metrics.failureCount,
      metrics.successRate,
      metrics.avgDurationMs,
      metrics.uniqueContexts,
      JSON.stringify(metrics.errorBreakdown)
    ).run();
  }

  async getCachedMetrics(capabilityId: string): Promise<CapabilityMetrics | null> {
    const result = await this.env.DB.prepare(
      `SELECT * FROM capability_metrics WHERE capability_id = ?`
    ).bind(capabilityId).first();

    if (!result) return null;

    return {
      capabilityId: result.capability_id as string,
      windowStart: new Date(Date.now() - (result.window_hours as number) * 60 * 60 * 1000).toISOString(),
      windowEnd: result.last_calculated_at as string,
      totalInvocations: result.total_invocations as number,
      successCount: result.success_count as number,
      failureCount: result.failure_count as number,
      successRate: result.success_rate as number,
      avgDurationMs: result.avg_duration_ms as number,
      uniqueContexts: result.unique_contexts as number,
      errorBreakdown: JSON.parse(result.error_breakdown as string || '{}'),
    };
  }

  // ============================================
  // CAPABILITY DEFINITIONS
  // ============================================

  async syncDefinition(def: CapabilityDefinition): Promise<void> {
    await this.env.DB.prepare(
      `INSERT OR REPLACE INTO capability_definitions
       (id, name, version, domain, description, status, required_grade,
        dependencies, rollout_rules, tags, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      def.id,
      def.name,
      def.version,
      def.domain,
      def.description,
      def.status,
      def.requiredContextGrade,
      JSON.stringify(def.dependencies || []),
      JSON.stringify(def.rolloutRules),
      JSON.stringify(def.tags || [])
    ).run();
  }

  async getDefinition(capabilityId: string): Promise<CapabilityDefinition | null> {
    const result = await this.env.DB.prepare(
      `SELECT * FROM capability_definitions WHERE id = ?`
    ).bind(capabilityId).first();

    if (!result) return null;

    return {
      id: result.id as string,
      name: result.name as string,
      version: result.version as string,
      domain: result.domain as string,
      description: result.description as string,
      status: result.status as CapabilityStatus,
      requiredContextGrade: result.required_grade as any,
      dependencies: JSON.parse(result.dependencies as string || '[]'),
      rolloutRules: JSON.parse(result.rollout_rules as string || '[]'),
      tags: JSON.parse(result.tags as string || '[]'),
    };
  }

  async updateStatus(
    capabilityId: string,
    newStatus: CapabilityStatus,
    reason: string,
    triggeredBy: 'rollout_rule' | 'manual' | 'incident',
    triggeredRule?: RolloutRule
  ): Promise<StatusTransition> {
    // Get current status
    const current = await this.getDefinition(capabilityId);
    const fromStatus = current?.status || 'experimental';

    // Record transition
    const transition: StatusTransition = {
      id: generateId(),
      capabilityId,
      fromStatus,
      toStatus: newStatus,
      reason,
      triggeredBy,
      triggeredRule,
      timestamp: new Date().toISOString(),
    };

    await this.env.DB.prepare(
      `INSERT INTO capability_status_history
       (id, capability_id, from_status, to_status, reason, triggered_by, triggered_rule)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      transition.id,
      transition.capabilityId,
      transition.fromStatus,
      transition.toStatus,
      transition.reason,
      transition.triggeredBy,
      triggeredRule ? JSON.stringify(triggeredRule) : null
    ).run();

    // Update definition
    await this.env.DB.prepare(
      `UPDATE capability_definitions SET status = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(newStatus, capabilityId).run();

    return transition;
  }

  async getStatusHistory(capabilityId: string, limit: number = 50): Promise<StatusTransition[]> {
    const result = await this.env.DB.prepare(
      `SELECT * FROM capability_status_history
       WHERE capability_id = ?
       ORDER BY timestamp DESC
       LIMIT ?`
    ).bind(capabilityId, limit).all();

    return (result.results as any[]).map((r) => ({
      id: r.id,
      capabilityId: r.capability_id,
      fromStatus: r.from_status,
      toStatus: r.to_status,
      reason: r.reason,
      triggeredBy: r.triggered_by,
      triggeredRule: r.triggered_rule ? JSON.parse(r.triggered_rule) : undefined,
      timestamp: r.timestamp,
    }));
  }

  // ============================================
  // CLEANUP
  // ============================================

  async pruneOldInvocations(olderThanDays: number = 90): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

    const result = await this.env.DB.prepare(
      `DELETE FROM capability_invocations WHERE timestamp < ?`
    ).bind(cutoff).run();

    return result.meta.changes || 0;
  }

  // ============================================
  // HELPERS
  // ============================================

  private mapInvocation(row: any): CapabilityInvocation {
    return {
      invocationId: row.invocation_id,
      capabilityId: row.capability_id,
      capabilityVersion: row.capability_version,
      contextId: row.context_id,
      chittyId: row.chitty_id,
      status: row.status,
      timestamp: row.timestamp,
      durationMs: row.duration_ms,
      success: row.success === 1,
      errorCode: row.error_code || undefined,
      inputHash: row.input_hash,
      outputHash: row.output_hash || undefined,
      parentInvocations: row.parent_invocations ? JSON.parse(row.parent_invocations) : undefined,
    };
  }
}
