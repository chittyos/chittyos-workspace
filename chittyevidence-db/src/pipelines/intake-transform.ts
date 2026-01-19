// ============================================
// INTAKE TRANSFORM WORKER
// Canonical URI: chittycanon://evidence/pipeline/intake-transform
// Cloudflare Pipeline transform for intake stream
// Fetches files and triggers document workflow
// ============================================

import { Env } from '../types';
import { IntakeWorker } from './intake-worker';
import { IntakeEvent } from './pre-filter';
import { generateId } from '../utils';

/**
 * Intake Pipeline Transform
 *
 * Processes qualified documents from the intake stream:
 * 1. Fetches actual file content from source
 * 2. Uploads to R2 storage
 * 3. Triggers DocumentProcessingWorkflow
 */
export default {
  /**
   * Process a batch of intake events
   */
  async transform(
    events: IntakeEvent[],
    env: Env
  ): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    duplicates: number;
    results: Array<{
      intake_id: string;
      status: string;
      document_id?: string;
      error?: string;
    }>;
  }> {
    const worker = new IntakeWorker(env);
    const results: Array<{
      intake_id: string;
      status: string;
      document_id?: string;
      error?: string;
    }> = [];

    console.log(`[IntakeTransform] Processing batch of ${events.length} qualified documents`);

    // Sort by priority (higher first)
    const sorted = [...events].sort((a, b) => b.processing_priority - a.processing_priority);

    let succeeded = 0;
    let failed = 0;
    let duplicates = 0;

    for (const event of sorted) {
      const result = await worker.process(event);

      if (result.success) {
        if (result.error?.includes('Duplicate')) {
          duplicates++;
          results.push({
            intake_id: event.intake_id,
            status: 'duplicate',
            document_id: result.documentId,
          });
        } else {
          succeeded++;
          results.push({
            intake_id: event.intake_id,
            status: 'processing',
            document_id: result.documentId,
          });
        }
      } else {
        failed++;
        results.push({
          intake_id: event.intake_id,
          status: 'failed',
          error: result.error,
        });
      }
    }

    console.log(`[IntakeTransform] Result: ${succeeded} succeeded, ${failed} failed, ${duplicates} duplicates`);

    // Log metrics
    await env.DB.prepare(
      `INSERT INTO pipeline_metrics (id, metric_type, metric_value, recorded_at)
       VALUES (?, 'intake_transform', ?, datetime('now'))`
    ).bind(
      generateId(),
      JSON.stringify({
        batch_size: events.length,
        succeeded,
        failed,
        duplicates,
        success_rate: events.length > 0
          ? ((succeeded / events.length) * 100).toFixed(1)
          : 0,
      })
    ).run();

    return {
      processed: events.length,
      succeeded,
      failed,
      duplicates,
      results,
    };
  },

  /**
   * Full pipeline handler
   */
  async pipeline(
    batch: MessageBatch<IntakeEvent>,
    env: Env
  ): Promise<void> {
    const events = batch.messages.map((m) => m.body);

    await this.transform(events, env);

    // Acknowledge all messages
    for (const message of batch.messages) {
      message.ack();
    }
  },
};
