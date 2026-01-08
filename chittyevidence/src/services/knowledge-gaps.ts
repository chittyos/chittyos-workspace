// ============================================
// KNOWLEDGE GAPS SERVICE
// Structured uncertainty management
// ============================================

import {
  Env,
  KnowledgeGap,
  GapOccurrence,
  GapCandidate,
  ExtractedUnknown,
  RegisteredGap,
  ResolutionSource,
  PropagationResult,
  ResolvableGap,
  GapType,
} from '../types';
import {
  generateId,
  simpleHash,
  getNestedValue,
  setNestedValue,
  createGapPlaceholder,
  inferEntityType,
  safeJsonParse,
} from '../utils';

export class KnowledgeGapsService {
  constructor(private env: Env) {}

  /**
   * Process extraction results and register any unknowns
   */
  async processExtractionUnknowns(
    documentId: string,
    unknowns: ExtractedUnknown[]
  ): Promise<{
    registered: RegisteredGap[];
    linked: RegisteredGap[];
    totalUnknowns: number;
  }> {
    const registered: RegisteredGap[] = [];
    const linked: RegisteredGap[] = [];

    for (const unknown of unknowns) {
      // Generate fingerprint for deduplication
      const fingerprint = this.generateFingerprint(unknown);

      // Check if this unknown already exists
      const existingGap = await this.env.DB.prepare(
        `SELECT * FROM knowledge_gaps WHERE fingerprint = ?`
      )
        .bind(fingerprint)
        .first<KnowledgeGap>();

      let gapId: string;

      if (existingGap) {
        // Link to existing gap
        gapId = existingGap.id;

        // Update occurrence count and context
        const existingClues = safeJsonParse<{ clues: string[]; sources: string[] }>(
          existingGap.context_clues,
          { clues: [], sources: [] }
        );

        const mergedClues = {
          clues: [...new Set([...existingClues.clues, ...unknown.contextClues])],
          sources: [...new Set([...existingClues.sources, documentId])],
        };

        await this.env.DB.prepare(
          `UPDATE knowledge_gaps
           SET occurrence_count = occurrence_count + 1,
               last_seen_at = datetime('now'),
               context_clues = ?
           WHERE id = ?`
        )
          .bind(JSON.stringify(mergedClues), gapId)
          .run();

        linked.push({ gapId, fingerprint, isNew: false });
      } else {
        // Register new gap
        gapId = generateId();

        await this.env.DB.prepare(
          `INSERT INTO knowledge_gaps
           (id, gap_type, fingerprint, partial_value, context_clues, resolution_hints, confidence_threshold)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            gapId,
            unknown.type,
            fingerprint,
            unknown.partialValue,
            JSON.stringify({ clues: unknown.contextClues, sources: [documentId] }),
            JSON.stringify(unknown.resolutionHints),
            parseFloat(this.env.AUTO_RESOLVE_CONFIDENCE_THRESHOLD || '0.90')
          )
          .run();

        registered.push({ gapId, fingerprint, isNew: true });
      }

      // Record this occurrence
      const placeholderValue = createGapPlaceholder(gapId);

      await this.env.DB.prepare(
        `INSERT INTO gap_occurrences
         (id, gap_id, document_id, field_path, surrounding_text, local_context, extraction_confidence, placeholder_value)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          generateId(),
          gapId,
          documentId,
          unknown.fieldPath || 'unknown',
          unknown.surroundingText || '',
          JSON.stringify(unknown.contextClues),
          unknown.confidence,
          placeholderValue
        )
        .run();

      // Replace the {{UNKNOWN:...}} placeholder with {{GAP:id}} in the document
      await this.replacePlaceholder(documentId, unknown.placeholder, placeholderValue);
    }

    return {
      registered,
      linked,
      totalUnknowns: registered.length + linked.length,
    };
  }

  /**
   * Generate a normalized fingerprint for deduplication
   */
  private generateFingerprint(unknown: ExtractedUnknown): string {
    const type = unknown.type;
    const normalized = this.normalizePartialValue(unknown.partialValue, type);
    const contextHash = simpleHash(unknown.contextClues.sort().join('|'));

    return `${type}:${normalized}:${contextHash.slice(0, 8)}`;
  }

  private normalizePartialValue(value: string, type: GapType): string {
    let normalized = value.toLowerCase().trim();

    // Remove common noise
    normalized = normalized.replace(/[_\-\s]+/g, '_');

    // Type-specific normalization
    switch (type) {
      case 'entity_name':
        // Keep LLC/Inc/Corp suffix but normalize
        normalized = normalized.replace(
          /(llc|inc|corp|ltd)\.?$/i,
          (match) => match.toLowerCase().replace('.', '')
        );
        break;
      case 'date':
        // Normalize date hints
        normalized = normalized.replace(/\d{4}/, 'YEAR');
        break;
      case 'amount':
        // Normalize amounts to magnitude
        normalized = normalized.replace(/\d+/g, 'N');
        break;
    }

    return normalized;
  }

  private async replacePlaceholder(
    documentId: string,
    oldPlaceholder: string,
    newPlaceholder: string
  ): Promise<void> {
    const doc = await this.env.DB.prepare(
      `SELECT metadata FROM documents WHERE id = ?`
    )
      .bind(documentId)
      .first<{ metadata: string }>();

    if (doc?.metadata) {
      const updated = doc.metadata.replace(oldPlaceholder, newPlaceholder);
      await this.env.DB.prepare(
        `UPDATE documents SET metadata = ?, updated_at = datetime('now') WHERE id = ?`
      )
        .bind(updated, documentId)
        .run();
    }
  }

  /**
   * Propose a resolution for a gap
   */
  async proposeResolution(
    gapId: string,
    candidateValue: string,
    source: ResolutionSource
  ): Promise<{
    status: 'auto_resolved' | 'confirmation_added' | 'candidate_proposed';
    gapId: string;
    resolvedValue?: string;
    candidateId?: string;
  }> {
    const gap = await this.env.DB.prepare(
      `SELECT * FROM knowledge_gaps WHERE id = ?`
    )
      .bind(gapId)
      .first<KnowledgeGap>();

    if (!gap) {
      throw new Error(`Gap not found: ${gapId}`);
    }

    // Check if this candidate already exists
    const existingCandidate = await this.env.DB.prepare(
      `SELECT * FROM gap_candidates WHERE gap_id = ? AND candidate_value = ?`
    )
      .bind(gapId, candidateValue)
      .first<GapCandidate>();

    if (existingCandidate) {
      // Increment confirmation count
      await this.env.DB.prepare(
        `UPDATE gap_candidates
         SET confirmations = confirmations + 1,
             confidence = MIN(1.0, confidence + 0.1)
         WHERE id = ?`
      )
        .bind(existingCandidate.id)
        .run();

      // Check if we should auto-resolve
      const updated = await this.env.DB.prepare(
        `SELECT * FROM gap_candidates WHERE id = ?`
      )
        .bind(existingCandidate.id)
        .first<GapCandidate>();

      if (updated && updated.confidence >= gap.confidence_threshold) {
        await this.resolveGap(gapId, candidateValue, 'ai_inference');
        return { status: 'auto_resolved', gapId, resolvedValue: candidateValue };
      }

      return { status: 'confirmation_added', gapId, candidateId: existingCandidate.id };
    }

    // Create new candidate
    const candidateId = generateId();
    await this.env.DB.prepare(
      `INSERT INTO gap_candidates
       (id, gap_id, candidate_value, source_type, source_document_id, source_description, confidence)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        candidateId,
        gapId,
        candidateValue,
        source.type,
        source.documentId || null,
        source.description || null,
        source.confidence
      )
      .run();

    // Check if high enough confidence to auto-resolve
    if (source.confidence >= gap.confidence_threshold) {
      await this.resolveGap(gapId, candidateValue, source.type);
      return { status: 'auto_resolved', gapId, resolvedValue: candidateValue };
    }

    return { status: 'candidate_proposed', gapId, candidateId };
  }

  /**
   * Resolve a gap and propagate to all occurrences
   */
  async resolveGap(
    gapId: string,
    resolvedValue: string,
    resolvedBy: string,
    sourceDocId?: string
  ): Promise<PropagationResult> {
    const startedAt = new Date().toISOString();

    // Get all occurrences
    const occurrences = await this.env.DB.prepare(
      `SELECT * FROM gap_occurrences WHERE gap_id = ?`
    )
      .bind(gapId)
      .all();

    const rollbackData: any[] = [];
    let documentsUpdated = 0;
    let fieldsUpdated = 0;
    let entitiesCreated = 0;
    let authoritiesUpdated = 0;

    // Update each occurrence
    for (const occ of occurrences.results as GapOccurrence[]) {
      const doc = await this.env.DB.prepare(
        `SELECT metadata FROM documents WHERE id = ?`
      )
        .bind(occ.document_id)
        .first<{ metadata: string }>();

      if (doc?.metadata) {
        // Store original for rollback
        rollbackData.push({
          documentId: occ.document_id,
          fieldPath: occ.field_path,
          originalValue: occ.placeholder_value,
        });

        // Replace placeholder with resolved value
        const updatedMetadata = doc.metadata.replace(
          occ.placeholder_value,
          resolvedValue
        );

        await this.env.DB.prepare(
          `UPDATE documents SET metadata = ?, updated_at = datetime('now') WHERE id = ?`
        )
          .bind(updatedMetadata, occ.document_id)
          .run();

        fieldsUpdated++;
      }

      // Check if this creates a new entity
      if (
        occ.field_path.includes('parties') ||
        occ.field_path.includes('entities')
      ) {
        const created = await this.maybeCreateEntity(resolvedValue, occ.document_id);
        if (created) entitiesCreated++;
      }

      // Check if this affects authority grants
      if (
        occ.field_path.includes('authority') ||
        occ.field_path.includes('grantor') ||
        occ.field_path.includes('grantee')
      ) {
        await this.updateAuthorityGrants(occ.document_id, resolvedValue);
        authoritiesUpdated++;
      }

      documentsUpdated++;
    }

    // Mark gap as resolved
    await this.env.DB.prepare(
      `UPDATE knowledge_gaps
       SET status = 'resolved',
           resolved_value = ?,
           resolved_by = ?,
           resolved_at = datetime('now'),
           resolution_source_doc_id = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(resolvedValue, resolvedBy, sourceDocId || null, gapId)
      .run();

    // Log propagation
    await this.env.DB.prepare(
      `INSERT INTO gap_propagation_log
       (id, gap_id, resolved_value, documents_updated, fields_updated, entities_created, authorities_updated, started_at, completed_at, rollback_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`
    )
      .bind(
        generateId(),
        gapId,
        resolvedValue,
        documentsUpdated,
        fieldsUpdated,
        entitiesCreated,
        authoritiesUpdated,
        startedAt,
        JSON.stringify(rollbackData)
      )
      .run();

    return {
      gapId,
      resolvedValue,
      documentsUpdated,
      fieldsUpdated,
      entitiesCreated,
      authoritiesUpdated,
    };
  }

  private async maybeCreateEntity(
    name: string,
    documentId: string
  ): Promise<boolean> {
    // Check if entity exists
    const existing = await this.env.DB.prepare(
      `SELECT id FROM entities WHERE name = ? COLLATE NOCASE`
    )
      .bind(name)
      .first();

    if (existing) return false;

    // Infer type from name
    const entityType = inferEntityType(name);

    const entityId = generateId();
    await this.env.DB.prepare(
      `INSERT INTO entities (id, entity_type, name, metadata) VALUES (?, ?, ?, ?)`
    )
      .bind(entityId, entityType, name, JSON.stringify({ discoveredFrom: documentId }))
      .run();

    return true;
  }

  private async updateAuthorityGrants(
    documentId: string,
    resolvedValue: string
  ): Promise<void> {
    // Re-process authority grants for this document with new information
    // This is a simplified version - full implementation would re-run extraction
    console.log(
      `TODO: Re-evaluate authority grants for ${documentId} with new value: ${resolvedValue}`
    );
  }

  /**
   * Find gaps that might be resolved by a new document
   */
  async findResolvableGaps(
    documentContent: string,
    documentType: string
  ): Promise<ResolvableGap[]> {
    // Get open gaps that might match this document's content
    const openGaps = await this.env.DB.prepare(
      `SELECT * FROM knowledge_gaps
       WHERE status = 'open'
       AND (gap_type IN ('entity_name', 'date', 'amount', 'address')
            OR json_extract(resolution_hints, '$') LIKE ?)
       ORDER BY occurrence_count DESC
       LIMIT 100`
    )
      .bind(`%${documentType}%`)
      .all();

    const resolvable: ResolvableGap[] = [];

    for (const gap of openGaps.results as KnowledgeGap[]) {
      // Check if this document might resolve the gap
      const match = await this.checkGapMatch(gap, documentContent);

      if (match.confidence > 0.7) {
        resolvable.push({
          gapId: gap.id,
          gapType: gap.gap_type as GapType,
          partialValue: gap.partial_value,
          proposedValue: match.proposedValue,
          confidence: match.confidence,
          occurrenceCount: gap.occurrence_count,
        });
      }
    }

    return resolvable;
  }

  private async checkGapMatch(
    gap: KnowledgeGap,
    content: string
  ): Promise<{ confidence: number; proposedValue?: string }> {
    // Use AI to check if content resolves the gap
    const prompt = `Given this partial/unknown value: "${gap.partial_value}"
Type: ${gap.gap_type}
Context clues: ${gap.context_clues}

Does this document content contain the complete value?
Document excerpt: ${content.slice(0, 2000)}

If yes, respond with JSON: {"found": true, "value": "the complete value", "confidence": 0.0-1.0}
If no, respond with JSON: {"found": false, "confidence": 0.0}`;

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
      });

      const text = (response as any).response || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const result = JSON.parse(match[0]);
        return {
          confidence: result.confidence || 0,
          proposedValue: result.found ? result.value : undefined,
        };
      }
    } catch (e) {
      console.error('Gap match check failed:', e);
    }

    return { confidence: 0 };
  }

  /**
   * Get all open gaps with their occurrence counts
   */
  async getOpenGaps(options: {
    type?: GapType;
    minOccurrences?: number;
    limit?: number;
  } = {}): Promise<KnowledgeGap[]> {
    const { type, minOccurrences = 1, limit = 50 } = options;

    let query = `SELECT * FROM knowledge_gaps WHERE status = 'open' AND occurrence_count >= ?`;
    const params: any[] = [minOccurrences];

    if (type) {
      query += ` AND gap_type = ?`;
      params.push(type);
    }

    query += ` ORDER BY occurrence_count DESC LIMIT ?`;
    params.push(limit);

    const result = await this.env.DB.prepare(query).bind(...params).all();
    return result.results as KnowledgeGap[];
  }

  /**
   * Get gap with all occurrences and candidates
   */
  async getGapDetails(gapId: string): Promise<{
    gap: KnowledgeGap;
    occurrences: GapOccurrence[];
    candidates: GapCandidate[];
  } | null> {
    const gap = await this.env.DB.prepare(
      `SELECT * FROM knowledge_gaps WHERE id = ?`
    )
      .bind(gapId)
      .first<KnowledgeGap>();

    if (!gap) return null;

    const occurrences = await this.env.DB.prepare(
      `SELECT * FROM gap_occurrences WHERE gap_id = ?`
    )
      .bind(gapId)
      .all();

    const candidates = await this.env.DB.prepare(
      `SELECT * FROM gap_candidates WHERE gap_id = ? ORDER BY confidence DESC`
    )
      .bind(gapId)
      .all();

    return {
      gap,
      occurrences: occurrences.results as GapOccurrence[],
      candidates: candidates.results as GapCandidate[],
    };
  }

  /**
   * Rollback a gap resolution
   */
  async rollbackResolution(gapId: string): Promise<{ rolledBack: number }> {
    // Get the most recent propagation log
    const log = await this.env.DB.prepare(
      `SELECT * FROM gap_propagation_log WHERE gap_id = ? ORDER BY completed_at DESC LIMIT 1`
    )
      .bind(gapId)
      .first<{ rollback_data: string }>();

    if (!log || !log.rollback_data) {
      throw new Error('No rollback data available');
    }

    const rollbackData = JSON.parse(log.rollback_data);
    let rolledBack = 0;

    for (const item of rollbackData) {
      const doc = await this.env.DB.prepare(
        `SELECT metadata FROM documents WHERE id = ?`
      )
        .bind(item.documentId)
        .first<{ metadata: string }>();

      if (doc?.metadata) {
        // Get current resolved value from gap
        const gap = await this.env.DB.prepare(
          `SELECT resolved_value FROM knowledge_gaps WHERE id = ?`
        )
          .bind(gapId)
          .first<{ resolved_value: string }>();

        if (gap?.resolved_value) {
          const restored = doc.metadata.replace(
            gap.resolved_value,
            item.originalValue
          );

          await this.env.DB.prepare(
            `UPDATE documents SET metadata = ?, updated_at = datetime('now') WHERE id = ?`
          )
            .bind(restored, item.documentId)
            .run();

          rolledBack++;
        }
      }
    }

    // Mark gap as open again
    await this.env.DB.prepare(
      `UPDATE knowledge_gaps
       SET status = 'open',
           resolved_value = NULL,
           resolved_by = NULL,
           resolved_at = NULL,
           updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(gapId)
      .run();

    return { rolledBack };
  }
}
