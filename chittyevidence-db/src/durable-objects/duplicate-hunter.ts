// ============================================
// DUPLICATE HUNTER DURABLE OBJECT
// Proactive similarity detection across corpus
// ============================================

import { Env, ScanState, DuplicateMatch, DuplicateCandidate } from '../types';
import { generateId } from '../utils';

export class DuplicateHunterDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/scan/incremental':
        return this.runIncrementalScan();
      case '/scan/full':
        return this.runFullScan();
      case '/scan/document':
        const docId = url.searchParams.get('documentId');
        if (!docId) {
          return Response.json({ error: 'documentId required' }, { status: 400 });
        }
        return this.scanSingleDocument(docId);
      case '/status':
        return this.getScanStatus();
      case '/candidates':
        return this.getCandidates(url.searchParams);
      case '/resolve':
        return this.resolveCandidate(await request.json());
      default:
        return Response.json({ error: 'Not found' }, { status: 404 });
    }
  }

  // ============================================
  // SCAN OPERATIONS
  // ============================================

  private async runIncrementalScan(): Promise<Response> {
    let scanState = await this.state.storage.get<ScanState>('scanState');

    if (!scanState || scanState.status === 'completed') {
      const scanId = generateId();
      scanState = {
        id: scanId,
        type: 'incremental',
        lastDocumentId: null,
        documentsScanned: 0,
        duplicatesFound: 0,
        startedAt: new Date().toISOString(),
        status: 'running',
      };
      await this.state.storage.put('scanState', scanState);
    }

    // Process batch of documents
    const batchSize = 50;
    const query = scanState.lastDocumentId
      ? `SELECT id, content_hash, document_type, file_name FROM documents
         WHERE id > ? AND processing_status = 'completed'
         ORDER BY id LIMIT ?`
      : `SELECT id, content_hash, document_type, file_name FROM documents
         WHERE processing_status = 'completed'
         ORDER BY id LIMIT ?`;

    const params = scanState.lastDocumentId
      ? [scanState.lastDocumentId, batchSize]
      : [batchSize];

    const documents = await this.env.DB.prepare(query).bind(...params).all();

    if (documents.results.length === 0) {
      // Scan complete
      scanState.status = 'completed';
      scanState.completedAt = new Date().toISOString();
      await this.state.storage.put('scanState', scanState);

      // Log to D1
      await this.env.DB.prepare(
        `INSERT INTO duplicate_scan_state (id, scan_type, last_document_id, documents_scanned, duplicates_found, started_at, completed_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        scanState.id,
        scanState.type,
        scanState.lastDocumentId,
        scanState.documentsScanned,
        scanState.duplicatesFound,
        scanState.startedAt,
        scanState.completedAt,
        'completed'
      ).run();

      const { status: _, ...scanStateRest } = scanState;
      return Response.json({ status: 'completed', ...scanStateRest });
    }

    // Check each document for duplicates
    for (const doc of documents.results as any[]) {
      const duplicates = await this.findDuplicates(doc);

      for (const dup of duplicates) {
        await this.env.DB.prepare(
          `INSERT OR IGNORE INTO duplicate_candidates
           (id, document_id, candidate_document_id, detection_method, similarity_score, confidence)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          generateId(),
          doc.id,
          dup.documentId,
          dup.method,
          dup.score,
          dup.confidence
        ).run();

        // Auto-resolve high-confidence duplicates
        const threshold = parseFloat(this.env.DUPLICATE_AUTO_MERGE_THRESHOLD || '0.98');
        if (dup.score >= threshold && dup.method === 'semantic') {
          await this.autoResolveDuplicate(doc.id, dup.documentId, dup.score);
        }

        scanState.duplicatesFound++;
      }

      scanState.documentsScanned++;
      scanState.lastDocumentId = doc.id;
    }

    await this.state.storage.put('scanState', scanState);

    // Schedule next batch
    await this.state.storage.setAlarm(Date.now() + 1000);

    const { status: __, ...runningStateRest } = scanState;
    return Response.json({ status: 'running', ...runningStateRest });
  }

  private async runFullScan(): Promise<Response> {
    // Reset scan state for full scan
    const scanId = generateId();
    const scanState: ScanState = {
      id: scanId,
      type: 'full',
      lastDocumentId: null,
      documentsScanned: 0,
      duplicatesFound: 0,
      startedAt: new Date().toISOString(),
      status: 'running',
    };
    await this.state.storage.put('scanState', scanState);

    // Trigger first batch
    return this.runIncrementalScan();
  }

  private async scanSingleDocument(documentId: string): Promise<Response> {
    const doc = await this.env.DB.prepare(
      `SELECT id, content_hash, document_type, file_name FROM documents WHERE id = ?`
    ).bind(documentId).first();

    if (!doc) {
      return Response.json({ error: 'Document not found' }, { status: 404 });
    }

    const duplicates = await this.findDuplicates(doc as any);

    // Store candidates
    for (const dup of duplicates) {
      await this.env.DB.prepare(
        `INSERT OR IGNORE INTO duplicate_candidates
         (id, document_id, candidate_document_id, detection_method, similarity_score, confidence)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        generateId(),
        documentId,
        dup.documentId,
        dup.method,
        dup.score,
        dup.confidence
      ).run();
    }

    return Response.json({
      documentId,
      duplicatesFound: duplicates.length,
      duplicates,
    });
  }

  // ============================================
  // DUPLICATE DETECTION METHODS
  // ============================================

  private async findDuplicates(doc: {
    id: string;
    content_hash: string;
    document_type: string;
  }): Promise<DuplicateMatch[]> {
    const duplicates: DuplicateMatch[] = [];

    // Method 1: Semantic similarity via Vectorize
    try {
      const docVector = await this.env.VECTORIZE.getByIds([doc.id]);
      if (docVector.length > 0) {
        const similar = await this.env.VECTORIZE.query(docVector[0].values, {
          topK: 10,
          filter: doc.document_type ? { documentType: doc.document_type } : undefined,
          returnMetadata: 'all',
        });

        for (const match of similar.matches) {
          if (match.id !== doc.id && match.score > 0.85) {
            duplicates.push({
              documentId: match.id,
              method: 'semantic',
              score: match.score,
              confidence: match.score > 0.95 ? 'high' : match.score > 0.90 ? 'medium' : 'low',
            });
          }
        }
      }
    } catch (e) {
      console.error('Vectorize query failed:', e);
    }

    // Method 2: Metadata match (same parties + document type)
    try {
      const metadataMatches = await this.env.DB.prepare(
        `SELECT DISTINCT d.id
         FROM documents d
         WHERE d.id != ?
           AND d.document_type = ?
           AND d.processing_status = 'completed'
           AND EXISTS (
             SELECT 1 FROM document_entities de1
             JOIN document_entities de2 ON de1.entity_id = de2.entity_id
             WHERE de1.document_id = ? AND de2.document_id = d.id
           )
         LIMIT 20`
      ).bind(doc.id, doc.document_type, doc.id).all();

      for (const match of metadataMatches.results as any[]) {
        const overlap = await this.calculateEntityOverlap(doc.id, match.id);
        if (overlap > 0.7) {
          // Check if not already found by semantic search
          if (!duplicates.find((d) => d.documentId === match.id)) {
            duplicates.push({
              documentId: match.id,
              method: 'metadata',
              score: overlap,
              confidence: overlap > 0.9 ? 'high' : 'medium',
            });
          }
        }
      }
    } catch (e) {
      console.error('Metadata match failed:', e);
    }

    return duplicates;
  }

  private async calculateEntityOverlap(docId1: string, docId2: string): Promise<number> {
    const result = await this.env.DB.prepare(
      `WITH
         entities1 AS (SELECT entity_id FROM document_entities WHERE document_id = ?),
         entities2 AS (SELECT entity_id FROM document_entities WHERE document_id = ?),
         overlap AS (SELECT entity_id FROM entities1 INTERSECT SELECT entity_id FROM entities2),
         total AS (SELECT entity_id FROM entities1 UNION SELECT entity_id FROM entities2)
       SELECT
         (SELECT COUNT(*) FROM overlap) as overlap_count,
         (SELECT COUNT(*) FROM total) as total_count`
    ).bind(docId1, docId2).first<{ overlap_count: number; total_count: number }>();

    return result && result.total_count > 0
      ? result.overlap_count / result.total_count
      : 0;
  }

  // ============================================
  // RESOLUTION
  // ============================================

  private async autoResolveDuplicate(
    docId1: string,
    docId2: string,
    score: number
  ): Promise<void> {
    // Determine which document is "primary" (older = primary)
    const docs = await this.env.DB.prepare(
      `SELECT id, created_at FROM documents WHERE id IN (?, ?) ORDER BY created_at`
    ).bind(docId1, docId2).all();

    if (docs.results.length !== 2) return;

    const [primary, duplicate] = docs.results as any[];

    // Update duplicate candidate
    await this.env.DB.prepare(
      `UPDATE duplicate_candidates
       SET status = 'confirmed_duplicate', auto_resolved = 1,
           resolution_notes = ?
       WHERE (document_id = ? AND candidate_document_id = ?)
          OR (document_id = ? AND candidate_document_id = ?)`
    ).bind(
      `Auto-merged: ${(score * 100).toFixed(1)}% semantic similarity`,
      docId1, docId2,
      docId2, docId1
    ).run();

    // Link documents
    await this.env.DB.prepare(
      `UPDATE documents SET superseded_by = ? WHERE id = ? AND superseded_by IS NULL`
    ).bind(primary.id, duplicate.id).run();

    // Create review queue entry for audit
    await this.env.DB.prepare(
      `INSERT INTO review_queue (id, review_type, priority, source_table, source_id, summary, status)
       VALUES (?, 'duplicate', 30, 'duplicate_candidates', ?, ?, 'resolved')`
    ).bind(
      generateId(),
      `${docId1}-${docId2}`,
      `Auto-resolved duplicate (${(score * 100).toFixed(1)}% match)`
    ).run();
  }

  private async resolveCandidate(body: {
    candidateId: string;
    resolution: 'confirmed_duplicate' | 'not_duplicate' | 'merged';
    notes?: string;
    reviewedBy?: string;
  }): Promise<Response> {
    const { candidateId, resolution, notes, reviewedBy } = body;

    await this.env.DB.prepare(
      `UPDATE duplicate_candidates
       SET status = ?, resolution_notes = ?, reviewed_by = ?, reviewed_at = datetime('now')
       WHERE id = ?`
    ).bind(resolution, notes || null, reviewedBy || null, candidateId).run();

    if (resolution === 'confirmed_duplicate' || resolution === 'merged') {
      // Get the candidate details
      const candidate = await this.env.DB.prepare(
        `SELECT document_id, candidate_document_id FROM duplicate_candidates WHERE id = ?`
      ).bind(candidateId).first<{ document_id: string; candidate_document_id: string }>();

      if (candidate) {
        // Link the documents
        await this.env.DB.prepare(
          `UPDATE documents SET superseded_by = ? WHERE id = ?`
        ).bind(candidate.document_id, candidate.candidate_document_id).run();
      }
    }

    return Response.json({ success: true, candidateId, resolution });
  }

  // ============================================
  // STATUS & QUERIES
  // ============================================

  private async getScanStatus(): Promise<Response> {
    const scanState = await this.state.storage.get<ScanState>('scanState');
    return Response.json(scanState || { status: 'idle' });
  }

  private async getCandidates(params: URLSearchParams): Promise<Response> {
    const status = params.get('status') || 'pending';
    const limit = parseInt(params.get('limit') || '50');

    const candidates = await this.env.DB.prepare(
      `SELECT dc.*,
              d1.file_name as document_name,
              d2.file_name as candidate_name
       FROM duplicate_candidates dc
       JOIN documents d1 ON dc.document_id = d1.id
       JOIN documents d2 ON dc.candidate_document_id = d2.id
       WHERE dc.status = ?
       ORDER BY dc.similarity_score DESC
       LIMIT ?`
    ).bind(status, limit).all();

    return Response.json(candidates.results);
  }

  // ============================================
  // ALARM HANDLER
  // ============================================

  async alarm(): Promise<void> {
    await this.runIncrementalScan();
  }
}
