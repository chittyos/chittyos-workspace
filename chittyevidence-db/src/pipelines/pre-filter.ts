// ============================================
// PRE-FILTER PIPELINE WORKER
// Canonical URI: chittycanon://evidence/pipeline/pre-filter
// Filters consideration submissions before intake
// ============================================

import { Env } from '../types';
import { generateId } from '../utils';
import { validateConsiderationEvent } from '../services/svc-chittyschema';

/**
 * Consideration submission from the pipeline stream
 */
export interface ConsiderationEvent {
  submission_id: string;
  source: 'email_watch' | 'gdrive_sync' | 'court_filing' | 'client_portal' | 'manual' | 'api';
  source_ref: string;
  source_hash?: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  submitted_at: string;
  submitted_by?: string;
  hints?: {
    case_id?: string;
    case_name?: string;
    entity_names?: string[];
    doc_type_hint?: string;
    date_hint?: string;
    priority?: 'urgent' | 'normal' | 'low';
    tags?: string[];
  };
  source_metadata?: Record<string, unknown>;
}

/**
 * Qualified document for intake
 */
export interface IntakeEvent {
  submission_id: string;
  intake_id: string;
  qualified_at: string;
  qualification_reason: string;
  qualification_score: number;
  matched_case_id?: string;
  matched_entities?: string[];
  source: string;
  source_ref: string;
  source_hash?: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  hints?: Record<string, unknown>;
  processing_priority: number;
}

/**
 * Rejection record for archive
 */
export interface RejectionRecord {
  submission_id: string;
  rejected_at: string;
  rejection_reason: string;
  rejection_details: string;
  source: string;
  source_ref: string;
  file_name: string;
  hints?: Record<string, unknown>;
  can_retry: boolean;
  retry_hints?: string[];
}

/**
 * Pre-filter result
 */
export type PreFilterResult =
  | { action: 'intake'; event: IntakeEvent }
  | { action: 'reject'; record: RejectionRecord }
  | { action: 'defer'; reason: string; retry_after_ms: number };

/**
 * PreFilterService - Determines if a submission qualifies for intake
 *
 * This runs as part of the Pipeline transform, making lightweight
 * decisions before triggering expensive workflows.
 */
export class PreFilterService {
  constructor(private env: Env) {}

  /**
   * Filter a consideration event
   * Returns intake event if qualified, rejection record otherwise
   *
   * Schema validation via: chittycanon://schema/evidence/pipeline/consideration
   */
  async filter(event: ConsiderationEvent): Promise<PreFilterResult> {
    const now = new Date().toISOString();

    // ============================================
    // STEP 0: Schema validation via ChittySchema
    // ============================================
    const validation = await validateConsiderationEvent(event);
    if (!validation.valid) {
      return {
        action: 'reject',
        record: {
          submission_id: event.submission_id || generateId(),
          rejected_at: now,
          rejection_reason: 'schema_validation_failed',
          rejection_details: `Schema validation failed: ${validation.errors?.map((e) => e.message).join('; ')}`,
          source: event.source || 'unknown',
          source_ref: event.source_ref || 'unknown',
          file_name: event.file_name || 'unknown',
          hints: event.hints,
          can_retry: true,
          retry_hints: validation.errors?.map((e) => `Fix ${e.path}: ${e.message}`) || [],
        },
      };
    }

    // ============================================
    // STEP 1: Check for duplicates (fast D1 query)
    // ============================================
    if (event.source_hash) {
      const existing = await this.env.DB.prepare(
        `SELECT id, file_name, processing_status FROM documents WHERE content_hash = ?`
      ).bind(event.source_hash).first();

      if (existing) {
        return {
          action: 'reject',
          record: {
            submission_id: event.submission_id,
            rejected_at: now,
            rejection_reason: 'duplicate',
            rejection_details: `Document already exists as "${(existing as any).file_name}" (ID: ${(existing as any).id})`,
            source: event.source,
            source_ref: event.source_ref,
            file_name: event.file_name,
            hints: event.hints,
            can_retry: false,
            retry_hints: [],
          },
        };
      }
    }

    // ============================================
    // STEP 2: Source-based auto-qualification
    // ============================================
    const highPrioritySources = ['court_filing', 'client_portal'];
    if (highPrioritySources.includes(event.source)) {
      return this.qualify(event, 'source_priority', 0.95, now, {
        processing_priority: event.source === 'court_filing' ? 90 : 80,
      });
    }

    // ============================================
    // STEP 3: Case ID match
    // ============================================
    if (event.hints?.case_id) {
      const caseExists = await this.env.DB.prepare(
        `SELECT id FROM cases WHERE id = ? OR case_number = ?`
      ).bind(event.hints.case_id, event.hints.case_id).first();

      if (caseExists) {
        return this.qualify(event, 'case_match', 0.98, now, {
          matched_case_id: (caseExists as any).id,
          processing_priority: event.hints.priority === 'urgent' ? 95 : 70,
        });
      }
    }

    // ============================================
    // STEP 4: Case name fuzzy match
    // ============================================
    if (event.hints?.case_name) {
      const fuzzyCase = await this.env.DB.prepare(
        `SELECT id, case_name FROM cases
         WHERE case_name LIKE ?
         ORDER BY created_at DESC LIMIT 1`
      ).bind(`%${event.hints.case_name}%`).first();

      if (fuzzyCase) {
        return this.qualify(event, 'case_name_match', 0.75, now, {
          matched_case_id: (fuzzyCase as any).id,
          processing_priority: 60,
        });
      }
    }

    // ============================================
    // STEP 5: Entity name matching
    // ============================================
    if (event.hints?.entity_names && event.hints.entity_names.length > 0) {
      const entityMatches = await this.matchEntities(event.hints.entity_names);

      if (entityMatches.length > 0) {
        // Check if any matched entity is linked to an active case
        const activeCaseLink = await this.env.DB.prepare(
          `SELECT DISTINCT c.id as case_id FROM cases c
           JOIN case_entities ce ON c.id = ce.case_id
           WHERE ce.entity_id IN (${entityMatches.map(() => '?').join(',')})
           AND c.status IN ('active', 'pending')
           LIMIT 1`
        ).bind(...entityMatches).first();

        return this.qualify(event, 'entity_match', activeCaseLink ? 0.85 : 0.65, now, {
          matched_entities: entityMatches,
          matched_case_id: activeCaseLink ? (activeCaseLink as any).case_id : undefined,
          processing_priority: activeCaseLink ? 70 : 40,
        });
      }
    }

    // ============================================
    // STEP 6: Document type relevance check
    // ============================================
    const relevantDocTypes = [
      'motion', 'brief', 'order', 'complaint', 'answer', 'discovery',
      'subpoena', 'summons', 'notice', 'affidavit', 'declaration',
      'exhibit', 'contract', 'agreement', 'deed', 'poa', 'trust',
    ];

    const docTypeHint = event.hints?.doc_type_hint?.toLowerCase() || '';
    const fileNameLower = event.file_name.toLowerCase();

    const typeMatch = relevantDocTypes.some(
      (t) => docTypeHint.includes(t) || fileNameLower.includes(t)
    );

    if (typeMatch) {
      return this.qualify(event, 'doc_type_relevant', 0.55, now, {
        processing_priority: 30,
      });
    }

    // ============================================
    // STEP 7: Check for minimum viable metadata
    // If source has some hints, give it a chance
    // ============================================
    if (event.hints && Object.keys(event.hints).length > 0) {
      return this.qualify(event, 'has_metadata', 0.35, now, {
        processing_priority: 20,
      });
    }

    // ============================================
    // STEP 8: Reject - insufficient relevance
    // ============================================
    return {
      action: 'reject',
      record: {
        submission_id: event.submission_id,
        rejected_at: now,
        rejection_reason: 'insufficient_relevance',
        rejection_details: 'No case, entity, or document type matches found. No metadata hints provided.',
        source: event.source,
        source_ref: event.source_ref,
        file_name: event.file_name,
        hints: event.hints,
        can_retry: true,
        retry_hints: [
          'Provide case_id or case_name hint',
          'Include entity_names of relevant parties',
          'Add doc_type_hint for the document type',
          'Submit through client_portal or court_filing source for auto-qualification',
        ],
      },
    };
  }

  /**
   * Qualify a submission for intake
   */
  private qualify(
    event: ConsiderationEvent,
    reason: string,
    score: number,
    now: string,
    extra: Partial<IntakeEvent>
  ): PreFilterResult {
    return {
      action: 'intake',
      event: {
        submission_id: event.submission_id,
        intake_id: generateId(),
        qualified_at: now,
        qualification_reason: reason,
        qualification_score: score,
        source: event.source,
        source_ref: event.source_ref,
        source_hash: event.source_hash,
        file_name: event.file_name,
        file_size: event.file_size,
        mime_type: event.mime_type,
        hints: event.hints,
        processing_priority: 50,
        ...extra,
      },
    };
  }

  /**
   * Match entity names against known entities
   */
  private async matchEntities(names: string[]): Promise<string[]> {
    if (names.length === 0) return [];

    // Build query for fuzzy name matching
    const conditions = names.map(() => 'normalized_name LIKE ?').join(' OR ');
    const params = names.map((n) => `%${n.toLowerCase()}%`);

    const results = await this.env.DB.prepare(
      `SELECT id FROM entities WHERE ${conditions} LIMIT 10`
    ).bind(...params).all();

    return (results.results as any[]).map((r) => r.id);
  }

  /**
   * Process a batch of consideration events
   * Returns qualified intakes and rejections
   */
  async processBatch(events: ConsiderationEvent[]): Promise<{
    intakes: IntakeEvent[];
    rejections: RejectionRecord[];
    deferred: { event: ConsiderationEvent; reason: string }[];
  }> {
    const intakes: IntakeEvent[] = [];
    const rejections: RejectionRecord[] = [];
    const deferred: { event: ConsiderationEvent; reason: string }[] = [];

    for (const event of events) {
      try {
        const result = await this.filter(event);

        switch (result.action) {
          case 'intake':
            intakes.push(result.event);
            break;
          case 'reject':
            rejections.push(result.record);
            break;
          case 'defer':
            deferred.push({ event, reason: result.reason });
            break;
        }
      } catch (error) {
        console.error(`Error filtering ${event.submission_id}:`, error);
        deferred.push({ event, reason: `Error: ${error}` });
      }
    }

    return { intakes, rejections, deferred };
  }
}

/**
 * Pipeline transform handler
 * Called by Cloudflare Pipelines to process consideration events
 */
export async function handlePipelineTransform(
  events: ConsiderationEvent[],
  env: Env
): Promise<void> {
  const preFilter = new PreFilterService(env);
  const { intakes, rejections, deferred } = await preFilter.processBatch(events);

  // Send qualified documents to intake stream
  if (intakes.length > 0 && env.PRESERVATION_PIPELINE) {
    await env.PRESERVATION_PIPELINE.send(intakes);
  }

  // Archive rejections to R2
  for (const rejection of rejections) {
    const archiveKey = `archive/${new Date().toISOString().slice(0, 10)}/${rejection.submission_id}.json`;
    await env.PROCESSED.put(archiveKey, JSON.stringify(rejection, null, 2), {
      customMetadata: {
        rejection_reason: rejection.rejection_reason,
        can_retry: String(rejection.can_retry),
      },
    });
  }

  // Log deferred for retry
  if (deferred.length > 0) {
    console.log(`Deferred ${deferred.length} events for retry`);
  }

  // Record metrics
  await env.DB.prepare(
    `INSERT INTO pipeline_metrics (id, metric_type, metric_value, recorded_at)
     VALUES (?, 'pre_filter_batch', ?, datetime('now'))`
  ).bind(
    generateId(),
    JSON.stringify({
      total: events.length,
      qualified: intakes.length,
      rejected: rejections.length,
      deferred: deferred.length,
    })
  ).run();
}
