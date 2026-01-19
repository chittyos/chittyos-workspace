// ============================================
// COLLECTION ENDPOINT HANDLER (EDRM-Aligned)
// Canonical URI: chittycanon://evidence/pipeline/collection-handler
// EDRM Stage: Collection - gathering potentially relevant documents
// https://edrm.net/resources/frameworks-and-standards/edrm-model/
// ============================================

import { Hono } from 'hono';
import { Env } from '../types';
import { generateId } from '../utils';
import { ConsiderationEvent, PreFilterService } from './pre-filter';
import {
  SCHEMA_URIS,
  getSchemaService,
  validateConsiderationEvent,
} from '../services/svc-chittyschema';

type Variables = {
  auth?: { authenticated: boolean; chittyId?: string };
};

export const collectionRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * POST /consider
 * Submit a document for consideration (lightweight - metadata only)
 *
 * This endpoint does NOT receive the actual file - only metadata and
 * hints about where to find it. The pipeline will fetch the file later
 * if/when it qualifies for intake.
 */
collectionRoutes.post('/', async (c) => {
  const body = await c.req.json();

  // Schema validation via ChittySchema (chittycanon://schema/evidence/pipeline/consideration)
  const partialEvent = {
    submission_id: generateId(),
    source: body.source,
    source_ref: body.source_ref,
    file_name: body.file_name,
    submitted_at: new Date().toISOString(),
    ...body,
  };

  const validation = await validateConsiderationEvent(partialEvent);
  if (!validation.valid) {
    return c.json({
      error: 'Schema validation failed',
      schema_uri: SCHEMA_URIS.consideration,
      errors: validation.errors,
    }, 400);
  }

  // Build consideration event
  const event: ConsiderationEvent = {
    submission_id: generateId(),
    source: body.source,
    source_ref: body.source_ref,
    source_hash: body.source_hash,
    file_name: body.file_name,
    file_size: body.file_size,
    mime_type: body.mime_type,
    submitted_at: new Date().toISOString(),
    submitted_by: body.submitted_by || c.get('auth')?.chittyId,
    hints: body.hints ? {
      case_id: body.hints.case_id,
      case_name: body.hints.case_name,
      entity_names: body.hints.entity_names,
      doc_type_hint: body.hints.doc_type_hint,
      date_hint: body.hints.date_hint,
      priority: body.hints.priority,
      tags: body.hints.tags,
    } : undefined,
    source_metadata: body.source_metadata,
  };

  // If pipeline binding exists, send to stream
  if (c.env.COLLECTION_PIPELINE) {
    await c.env.COLLECTION_PIPELINE.send([event]);

    return c.json({
      status: 'submitted',
      submission_id: event.submission_id,
      message: 'Document submitted for consideration. Processing via pipeline.',
    }, 202);
  }

  // Fallback: Direct processing (no pipeline configured)
  // This allows the system to work without pipelines for testing
  const preFilter = new PreFilterService(c.env);
  const result = await preFilter.filter(event);

  if (result.action === 'intake') {
    // If intake stream exists, send qualified event
    if (c.env.PRESERVATION_PIPELINE) {
      await c.env.PRESERVATION_PIPELINE.send([result.event]);
      return c.json({
        status: 'qualified',
        submission_id: event.submission_id,
        intake_id: result.event.intake_id,
        qualification: {
          reason: result.event.qualification_reason,
          score: result.event.qualification_score,
          matched_case_id: result.event.matched_case_id,
        },
        message: 'Document qualified for intake. Processing will begin shortly.',
      }, 202);
    }

    // No intake stream - return qualified status for manual processing
    return c.json({
      status: 'qualified',
      submission_id: event.submission_id,
      intake_event: result.event,
      message: 'Document qualified for intake. No intake stream configured - manual trigger required.',
    }, 200);
  }

  if (result.action === 'reject') {
    return c.json({
      status: 'rejected',
      submission_id: event.submission_id,
      rejection: {
        reason: result.record.rejection_reason,
        details: result.record.rejection_details,
        can_retry: result.record.can_retry,
        retry_hints: result.record.retry_hints,
      },
    }, 200);
  }

  // Deferred
  return c.json({
    status: 'deferred',
    submission_id: event.submission_id,
    reason: result.reason,
    retry_after_ms: result.retry_after_ms,
  }, 202);
});

/**
 * POST /consider/batch
 * Submit multiple documents for consideration
 */
collectionRoutes.post('/batch', async (c) => {
  const body = await c.req.json();

  if (!Array.isArray(body.documents) || body.documents.length === 0) {
    return c.json({ error: 'documents array required' }, 400);
  }

  if (body.documents.length > 100) {
    return c.json({ error: 'Maximum 100 documents per batch' }, 400);
  }

  const events: ConsiderationEvent[] = body.documents.map((doc: any) => ({
    submission_id: generateId(),
    source: doc.source,
    source_ref: doc.source_ref,
    source_hash: doc.source_hash,
    file_name: doc.file_name,
    file_size: doc.file_size,
    mime_type: doc.mime_type,
    submitted_at: new Date().toISOString(),
    submitted_by: doc.submitted_by || body.submitted_by || c.get('auth')?.chittyId,
    hints: doc.hints,
    source_metadata: doc.source_metadata,
  }));

  // Validate all events have required fields
  const invalid = events.filter(
    (e) => !e.source || !e.source_ref || !e.file_name
  );
  if (invalid.length > 0) {
    return c.json({
      error: 'Some documents missing required fields',
      invalid_count: invalid.length,
      invalid_ids: invalid.map((e) => e.submission_id),
    }, 400);
  }

  // Send to pipeline stream
  if (c.env.COLLECTION_PIPELINE) {
    await c.env.COLLECTION_PIPELINE.send(events);

    return c.json({
      status: 'submitted',
      count: events.length,
      submission_ids: events.map((e) => e.submission_id),
      message: 'Batch submitted for consideration.',
    }, 202);
  }

  // Fallback: Direct processing
  const preFilter = new PreFilterService(c.env);
  const { intakes, rejections, deferred } = await preFilter.processBatch(events);

  return c.json({
    status: 'processed',
    count: events.length,
    qualified: intakes.length,
    rejected: rejections.length,
    deferred: deferred.length,
    results: {
      intakes: intakes.map((e) => ({
        submission_id: e.submission_id,
        intake_id: e.intake_id,
        reason: e.qualification_reason,
        score: e.qualification_score,
      })),
      rejections: rejections.map((r) => ({
        submission_id: r.submission_id,
        reason: r.rejection_reason,
        can_retry: r.can_retry,
      })),
    },
  });
});

/**
 * GET /consider/:submission_id
 * Check status of a consideration submission
 */
collectionRoutes.get('/:submission_id', async (c) => {
  const { submission_id } = c.req.param();

  // Check intake log
  const intakeRecord = await c.env.DB.prepare(
    `SELECT * FROM intake_log WHERE submission_id = ? ORDER BY recorded_at DESC LIMIT 1`
  ).bind(submission_id).first();

  if (intakeRecord) {
    return c.json({
      submission_id,
      status: (intakeRecord as any).result_status,
      intake_id: (intakeRecord as any).intake_id,
      qualification: {
        reason: (intakeRecord as any).qualification_reason,
        score: (intakeRecord as any).qualification_score,
      },
      result: JSON.parse((intakeRecord as any).result_details || '{}'),
      recorded_at: (intakeRecord as any).recorded_at,
    });
  }

  // Check archive for rejections
  const archiveKey = `archive/${new Date().toISOString().slice(0, 10)}/${submission_id}.json`;
  const archived = await c.env.PROCESSED.get(archiveKey);

  if (archived) {
    const rejection = JSON.parse(await archived.text());
    return c.json({
      submission_id,
      status: 'rejected',
      rejection,
    });
  }

  // Not found
  return c.json({
    submission_id,
    status: 'unknown',
    message: 'Submission not found or still pending in pipeline',
  }, 404);
});

/**
 * POST /consider/retry/:submission_id
 * Retry a rejected submission with updated hints
 */
collectionRoutes.post('/retry/:submission_id', async (c) => {
  const { submission_id } = c.req.param();
  const body = await c.req.json();

  // Find original rejection
  const archiveKey = `archive/${new Date().toISOString().slice(0, 10)}/${submission_id}.json`;
  const archived = await c.env.PROCESSED.get(archiveKey);

  if (!archived) {
    return c.json({
      error: 'Original submission not found',
      submission_id,
    }, 404);
  }

  const original = JSON.parse(await archived.text());

  if (!original.can_retry) {
    return c.json({
      error: 'Submission cannot be retried',
      submission_id,
      reason: original.rejection_reason,
    }, 400);
  }

  // Create new consideration with merged hints
  const newEvent: ConsiderationEvent = {
    submission_id: generateId(),
    source: original.source,
    source_ref: original.source_ref,
    file_name: original.file_name,
    submitted_at: new Date().toISOString(),
    submitted_by: c.get('auth')?.chittyId,
    hints: {
      ...original.hints,
      ...body.hints, // New hints override original
    },
    source_metadata: {
      ...original.source_metadata,
      retry_of: submission_id,
    },
  };

  // Process
  if (c.env.COLLECTION_PIPELINE) {
    await c.env.COLLECTION_PIPELINE.send([newEvent]);
  }

  return c.json({
    status: 'resubmitted',
    original_submission_id: submission_id,
    new_submission_id: newEvent.submission_id,
    merged_hints: newEvent.hints,
  }, 202);
});

/**
 * GET /consider/stats
 * Pipeline metrics and statistics
 */
/**
 * GET /consider/schemas
 * Expose canonical schemas (ChittySchema compliant)
 */
collectionRoutes.get('/schemas', async (c) => {
  const schemaService = getSchemaService();
  const schemas = schemaService.listSchemas();
  const compliance = await schemaService.getComplianceStatus();

  return c.json({
    service: 'chittyevidence-db',
    canonical_uri: 'chittycanon://evidence/pipeline',
    schemas,
    compliance,
  });
});

collectionRoutes.get('/stats', async (c) => {
  // Get recent metrics
  const metrics = await c.env.DB.prepare(
    `SELECT metric_type, metric_value, recorded_at
     FROM pipeline_metrics
     WHERE recorded_at > datetime('now', '-24 hours')
     ORDER BY recorded_at DESC
     LIMIT 100`
  ).all();

  // Aggregate
  let totalConsidered = 0;
  let totalQualified = 0;
  let totalRejected = 0;
  let totalDeferred = 0;

  for (const m of metrics.results as any[]) {
    const value = JSON.parse(m.metric_value || '{}');
    if (m.metric_type === 'pre_filter_batch') {
      totalConsidered += value.total || 0;
      totalQualified += value.qualified || 0;
      totalRejected += value.rejected || 0;
      totalDeferred += value.deferred || 0;
    }
  }

  return c.json({
    period: '24h',
    total_considered: totalConsidered,
    total_qualified: totalQualified,
    total_rejected: totalRejected,
    total_deferred: totalDeferred,
    qualification_rate: totalConsidered > 0
      ? ((totalQualified / totalConsidered) * 100).toFixed(1) + '%'
      : 'N/A',
    recent_batches: metrics.results.length,
  });
});
