// ============================================
// INTAKE WORKER
// Canonical URI: chittycanon://evidence/pipeline/intake-worker
// Processes qualified documents from intake stream
// Fetches actual files and triggers full workflow
// ============================================

import { Env } from '../types';
import { generateId, computeHash } from '../utils';
import { IntakeEvent } from './pre-filter';

/**
 * Source fetchers - retrieve actual file content from source systems
 */
interface SourceFetcher {
  canHandle(source: string): boolean;
  fetch(sourceRef: string, env: Env): Promise<{ buffer: ArrayBuffer; contentType: string } | null>;
}

/**
 * Google Drive fetcher
 */
const gdriveFetcher: SourceFetcher = {
  canHandle: (source) => source === 'gdrive_sync',
  async fetch(sourceRef, env) {
    // sourceRef format: gdrive://{fileId}
    const fileId = sourceRef.replace('gdrive://', '');

    // Call Google Drive API via ChittyConnect
    const response = await fetch(`${env.CHITTYCONNECT_URL}/gdrive/files/${fileId}/content`, {
      headers: {
        Authorization: `Bearer ${env.CHITTYCONNECT_TOKEN}`,
      },
    });

    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    return { buffer, contentType };
  },
};

/**
 * Email attachment fetcher
 */
const emailFetcher: SourceFetcher = {
  canHandle: (source) => source === 'email_watch',
  async fetch(sourceRef, env) {
    // sourceRef format: email://{messageId}/{attachmentId}
    const [messageId, attachmentId] = sourceRef.replace('email://', '').split('/');

    // Fetch via email service
    const response = await fetch(
      `${env.CHITTYCONNECT_URL}/email/messages/${messageId}/attachments/${attachmentId}`,
      {
        headers: {
          Authorization: `Bearer ${env.CHITTYCONNECT_TOKEN}`,
        },
      }
    );

    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    return { buffer, contentType };
  },
};

/**
 * Court filing fetcher (PACER, Odyssey, etc.)
 */
const courtFilingFetcher: SourceFetcher = {
  canHandle: (source) => source === 'court_filing',
  async fetch(sourceRef, env) {
    // sourceRef format: court://{system}/{caseNumber}/{documentId}
    // e.g., court://pacer/1:24-cv-12345/doc-78

    const response = await fetch(`${env.CHITTYCONNECT_URL}/court/documents/fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.CHITTYCONNECT_TOKEN}`,
      },
      body: JSON.stringify({ source_ref: sourceRef }),
    });

    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/pdf';

    return { buffer, contentType };
  },
};

/**
 * Client portal fetcher
 */
const clientPortalFetcher: SourceFetcher = {
  canHandle: (source) => source === 'client_portal',
  async fetch(sourceRef, env) {
    // sourceRef format: portal://{uploadId}
    const uploadId = sourceRef.replace('portal://', '');

    // Fetch from client portal R2 staging bucket
    const object = await env.DOCUMENTS.get(`staging/portal/${uploadId}`);
    if (!object) return null;

    const buffer = await object.arrayBuffer();
    const contentType = object.httpMetadata?.contentType || 'application/octet-stream';

    return { buffer, contentType };
  },
};

/**
 * Direct URL fetcher (for manual/api sources with URLs)
 */
const urlFetcher: SourceFetcher = {
  canHandle: (source) => source === 'manual' || source === 'api',
  async fetch(sourceRef, _env) {
    // sourceRef is a URL
    if (!sourceRef.startsWith('http')) return null;

    const response = await fetch(sourceRef, {
      headers: {
        'User-Agent': 'ChittyEvidence/1.0',
      },
    });

    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    return { buffer, contentType };
  },
};

/**
 * R2 staging fetcher (for pre-uploaded files)
 */
const r2StagingFetcher: SourceFetcher = {
  canHandle: (_source) => true, // Fallback
  async fetch(sourceRef, env) {
    // Check if sourceRef is an R2 key
    if (sourceRef.startsWith('r2://')) {
      const key = sourceRef.replace('r2://', '');
      const object = await env.DOCUMENTS.get(key);
      if (!object) return null;

      const buffer = await object.arrayBuffer();
      const contentType = object.httpMetadata?.contentType || 'application/octet-stream';

      return { buffer, contentType };
    }

    return null;
  },
};

const fetchers: SourceFetcher[] = [
  gdriveFetcher,
  emailFetcher,
  courtFilingFetcher,
  clientPortalFetcher,
  urlFetcher,
  r2StagingFetcher,
];

/**
 * IntakeWorker - Processes qualified intake events
 */
export class IntakeWorker {
  constructor(private env: Env) {}

  /**
   * Process a single intake event
   */
  async process(event: IntakeEvent): Promise<{
    success: boolean;
    documentId?: string;
    workflowInstanceId?: string;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      // ============================================
      // STEP 1: Fetch actual file content
      // ============================================
      const fetcher = fetchers.find((f) => f.canHandle(event.source));
      if (!fetcher) {
        return { success: false, error: `No fetcher for source: ${event.source}` };
      }

      const fileData = await fetcher.fetch(event.source_ref, this.env);
      if (!fileData) {
        return { success: false, error: `Failed to fetch file from: ${event.source_ref}` };
      }

      // ============================================
      // STEP 2: Compute hash and check for duplicates
      // ============================================
      const contentHash = event.source_hash || (await computeHash(fileData.buffer));

      const existing = await this.env.DB.prepare(
        `SELECT id, file_name FROM documents WHERE content_hash = ?`
      ).bind(contentHash).first();

      if (existing) {
        // Record that this intake matched an existing document
        await this.recordIntakeResult(event, {
          status: 'duplicate',
          existing_document_id: (existing as any).id,
          duration_ms: Date.now() - startTime,
        });

        return {
          success: true,
          documentId: (existing as any).id,
          error: 'Duplicate detected at intake',
        };
      }

      // ============================================
      // STEP 3: Upload to R2
      // ============================================
      const documentId = event.preservation_id || event.intake_id!;
      const datePrefix = new Date().toISOString().slice(0, 10);
      const r2Key = `documents/${datePrefix}/${documentId}/${event.file_name}`;

      await this.env.DOCUMENTS.put(r2Key, fileData.buffer, {
        httpMetadata: { contentType: fileData.contentType },
        customMetadata: {
          documentId,
          submissionId: event.submission_id,
          contentHash,
          source: event.source,
          qualificationReason: event.qualification_reason,
          qualificationScore: String(event.qualification_score),
        },
      });

      // ============================================
      // STEP 4: Create D1 record
      // ============================================
      await this.env.DB.prepare(
        `INSERT INTO documents
         (id, workflow_instance_id, r2_key, content_hash, file_name, file_size, mime_type, processing_status,
          uploaded_by, source, source_ref, qualification_reason, qualification_score, case_id)
         VALUES (?, '', ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?)`
      ).bind(
        documentId,
        r2Key,
        contentHash,
        event.file_name,
        fileData.buffer.byteLength,
        fileData.contentType,
        event.hints?.submitted_by || 'pipeline',
        event.source,
        event.source_ref,
        event.qualification_reason,
        event.qualification_score,
        event.matched_case_id || null
      ).run();

      // ============================================
      // STEP 5: Trigger workflow
      // ============================================
      const instance = await this.env.DOCUMENT_WORKFLOW.create({
        params: {
          documentId,
          r2Key,
          contentHash,
          fileName: event.file_name,
          contentType: fileData.contentType,
          uploadedBy: 'pipeline',
          sourceRef: event.source_ref,
          qualificationScore: event.qualification_score,
          matchedCaseId: event.matched_case_id,
          matchedEntities: event.matched_entities,
          priority: event.processing_priority,
        },
      });

      // Update document with workflow ID
      await this.env.DB.prepare(
        `UPDATE documents SET workflow_instance_id = ? WHERE id = ?`
      ).bind(instance.id, documentId).run();

      // Record successful intake
      await this.recordIntakeResult(event, {
        status: 'processing',
        document_id: documentId,
        workflow_instance_id: instance.id,
        duration_ms: Date.now() - startTime,
      });

      return {
        success: true,
        documentId,
        workflowInstanceId: instance.id,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      await this.recordIntakeResult(event, {
        status: 'failed',
        error: errorMsg,
        duration_ms: Date.now() - startTime,
      });

      return { success: false, error: errorMsg };
    }
  }

  /**
   * Process a batch of intake events
   */
  async processBatch(events: IntakeEvent[]): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    duplicates: number;
  }> {
    let succeeded = 0;
    let failed = 0;
    let duplicates = 0;

    // Sort by priority (higher first)
    const sorted = [...events].sort((a, b) => b.processing_priority - a.processing_priority);

    for (const event of sorted) {
      const result = await this.process(event);

      if (result.success) {
        if (result.error?.includes('Duplicate')) {
          duplicates++;
        } else {
          succeeded++;
        }
      } else {
        failed++;
      }
    }

    return {
      processed: events.length,
      succeeded,
      failed,
      duplicates,
    };
  }

  /**
   * Record intake result for metrics/audit
   */
  private async recordIntakeResult(
    event: IntakeEvent,
    result: Record<string, unknown>
  ): Promise<void> {
    await this.env.DB.prepare(
      `INSERT INTO intake_log
       (id, submission_id, intake_id, source, qualification_reason, qualification_score, result_status, result_details, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      generateId(),
      event.submission_id,
      event.intake_id,
      event.source,
      event.qualification_reason,
      event.qualification_score,
      (result as any).status,
      JSON.stringify(result)
    ).run();
  }
}

/**
 * Handle intake stream events
 * Called when intake stream has new qualified documents
 */
export async function handleIntakeStream(
  events: IntakeEvent[],
  env: Env
): Promise<void> {
  const worker = new IntakeWorker(env);
  const result = await worker.processBatch(events);

  console.log(`Intake batch complete: ${result.succeeded} succeeded, ${result.failed} failed, ${result.duplicates} duplicates`);

  // Record batch metrics
  await env.DB.prepare(
    `INSERT INTO pipeline_metrics (id, metric_type, metric_value, recorded_at)
     VALUES (?, 'intake_batch', ?, datetime('now'))`
  ).bind(generateId(), JSON.stringify(result)).run();
}
