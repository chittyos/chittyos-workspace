// ============================================
// PRE-FILTER TRANSFORM WORKER
// Cloudflare Pipeline transform for consideration stream
// ============================================

import { Env } from '../types';
import { PreFilterService, ConsiderationEvent, IntakeEvent, RejectionRecord } from './pre-filter';
import { generateId } from '../utils';

/**
 * Pipeline Transform Handler
 *
 * This is the entry point for the Cloudflare Pipeline transform.
 * It receives batches of events from the consideration stream,
 * filters them, and routes to intake stream or archive.
 */
export default {
  /**
   * Process a batch of pipeline events
   * Called by Cloudflare Pipelines with each batch
   */
  async transform(
    events: ConsiderationEvent[],
    env: Env
  ): Promise<{
    qualified: IntakeEvent[];
    rejected: RejectionRecord[];
  }> {
    const preFilter = new PreFilterService(env);
    const qualified: IntakeEvent[] = [];
    const rejected: RejectionRecord[] = [];

    console.log(`[PreFilterTransform] Processing batch of ${events.length} events`);

    for (const event of events) {
      try {
        const result = await preFilter.filter(event);

        if (result.action === 'intake') {
          qualified.push(result.event);
        } else if (result.action === 'reject') {
          rejected.push(result.record);
        }
        // Deferred events are dropped - they'll need resubmission
      } catch (error) {
        console.error(`[PreFilterTransform] Error processing ${event.submission_id}:`, error);
        // Create rejection record for failed processing
        rejected.push({
          submission_id: event.submission_id,
          rejected_at: new Date().toISOString(),
          rejection_reason: 'processing_error',
          rejection_details: String(error),
          source: event.source,
          source_ref: event.source_ref,
          file_name: event.file_name,
          hints: event.hints,
          can_retry: true,
          retry_hints: ['Resubmit after system recovery'],
        });
      }
    }

    console.log(`[PreFilterTransform] Result: ${qualified.length} qualified, ${rejected.length} rejected`);

    // Log metrics
    await env.DB.prepare(
      `INSERT INTO pipeline_metrics (id, metric_type, metric_value, recorded_at)
       VALUES (?, 'pre_filter_transform', ?, datetime('now'))`
    ).bind(
      generateId(),
      JSON.stringify({
        batch_size: events.length,
        qualified: qualified.length,
        rejected: rejected.length,
        qualification_rate: events.length > 0
          ? (qualified.length / events.length * 100).toFixed(1)
          : 0,
      })
    ).run();

    return { qualified, rejected };
  },

  /**
   * Handle qualified documents - send to intake stream
   */
  async routeQualified(
    qualified: IntakeEvent[],
    env: Env
  ): Promise<void> {
    if (qualified.length === 0) return;

    if (env.PRESERVATION_PIPELINE) {
      await env.PRESERVATION_PIPELINE.send(qualified);
      console.log(`[PreFilterTransform] Sent ${qualified.length} to intake stream`);
    } else {
      console.warn('[PreFilterTransform] No PRESERVATION_PIPELINE binding - qualified events not forwarded');
    }
  },

  /**
   * Handle rejected documents - archive to R2
   */
  async routeRejected(
    rejected: RejectionRecord[],
    env: Env
  ): Promise<void> {
    if (rejected.length === 0) return;

    const datePrefix = new Date().toISOString().slice(0, 10);

    for (const record of rejected) {
      const key = `archive/${datePrefix}/${record.submission_id}.json`;

      await env.PROCESSED.put(key, JSON.stringify(record, null, 2), {
        customMetadata: {
          submission_id: record.submission_id,
          rejection_reason: record.rejection_reason,
          can_retry: String(record.can_retry),
          source: record.source,
        },
      });
    }

    console.log(`[PreFilterTransform] Archived ${rejected.length} rejections to R2`);
  },

  /**
   * Full pipeline handler - transform + route
   */
  async pipeline(
    batch: MessageBatch<ConsiderationEvent>,
    env: Env
  ): Promise<void> {
    const events = batch.messages.map((m) => m.body);

    const { qualified, rejected } = await this.transform(events, env);

    await Promise.all([
      this.routeQualified(qualified, env),
      this.routeRejected(rejected, env),
    ]);

    // Acknowledge all messages
    for (const message of batch.messages) {
      message.ack();
    }
  },
};
