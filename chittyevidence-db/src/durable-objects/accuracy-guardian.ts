// ============================================
// ACCURACY GUARDIAN DURABLE OBJECT
// Correction rules and error propagation
// ============================================

import { Env, CorrectionRule, CorrectionQueueItem, MatchCriteria } from '../types';
import { generateId, getNestedValue, setNestedValue, safeJsonParse } from '../utils';

export class AccuracyGuardianDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/rules/create':
        return this.createCorrectionRule(await request.json());
      case '/rules/list':
        return this.listRules(url.searchParams);
      case '/rules/activate':
        return this.activateRule(url.searchParams.get('ruleId')!);
      case '/rules/apply':
        return this.applyCorrectionRule(url.searchParams.get('ruleId')!);
      case '/corrections/approve':
        return this.approveCorrections(await request.json());
      case '/corrections/reject':
        return this.rejectCorrections(await request.json());
      case '/corrections/bulk-apply':
        return this.bulkApplyApproved();
      case '/scan/errors':
        return this.scanForKnownErrors();
      case '/queue':
        return this.getCorrectionQueue(url.searchParams);
      default:
        return Response.json({ error: 'Not found' }, { status: 404 });
    }
  }

  // ============================================
  // RULE MANAGEMENT
  // ============================================

  private async createCorrectionRule(input: {
    ruleName: string;
    ruleType: string;
    description?: string;
    matchCriteria: MatchCriteria;
    correctionType: 'replace' | 'regex' | 'ai_reextract' | 'manual_review';
    correctionValue?: any;
    requiresApproval?: boolean;
    createdBy?: string;
  }): Promise<Response> {
    const ruleId = generateId();

    await this.env.DB.prepare(
      `INSERT INTO correction_rules
       (id, rule_name, rule_type, description, match_criteria, correction_type, correction_value, requires_approval, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`
    ).bind(
      ruleId,
      input.ruleName,
      input.ruleType,
      input.description || null,
      JSON.stringify(input.matchCriteria),
      input.correctionType,
      JSON.stringify(input.correctionValue || {}),
      input.requiresApproval !== false ? 1 : 0,
      input.createdBy || null
    ).run();

    // Find affected documents immediately
    const affected = await this.findAffectedDocuments(input.matchCriteria);

    // Update count
    await this.env.DB.prepare(
      `UPDATE correction_rules SET documents_affected = ? WHERE id = ?`
    ).bind(affected.length, ruleId).run();

    return Response.json({
      ruleId,
      status: 'draft',
      documentsAffected: affected.length,
      message: 'Rule created. Activate to queue corrections.',
    });
  }

  private async listRules(params: URLSearchParams): Promise<Response> {
    const status = params.get('status');
    const limit = parseInt(params.get('limit') || '50');

    let query = `SELECT * FROM correction_rules`;
    const bindings: any[] = [];

    if (status) {
      query += ` WHERE status = ?`;
      bindings.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    bindings.push(limit);

    const rules = await this.env.DB.prepare(query).bind(...bindings).all();
    return Response.json(rules.results);
  }

  private async activateRule(ruleId: string): Promise<Response> {
    await this.env.DB.prepare(
      `UPDATE correction_rules SET status = 'active', updated_at = datetime('now') WHERE id = ?`
    ).bind(ruleId).run();

    return Response.json({ ruleId, status: 'active' });
  }

  // ============================================
  // FIND AFFECTED DOCUMENTS
  // ============================================

  private async findAffectedDocuments(criteria: MatchCriteria): Promise<string[]> {
    let query = `SELECT id FROM documents WHERE processing_status = 'completed'`;
    const params: any[] = [];

    if (criteria.documentType) {
      query += ` AND document_type = ?`;
      params.push(criteria.documentType);
    }

    if (criteria.dateRange) {
      query += ` AND created_at BETWEEN ? AND ?`;
      params.push(criteria.dateRange[0], criteria.dateRange[1]);
    }

    if (criteria.entityName) {
      query += ` AND id IN (
        SELECT document_id FROM document_entities de
        JOIN entities e ON de.entity_id = e.id
        WHERE e.name LIKE ?
      )`;
      params.push(`%${criteria.entityName}%`);
    }

    if (criteria.metadataPattern) {
      query += ` AND json_extract(metadata, ?) IS NOT NULL`;
      params.push(criteria.metadataPattern.path);
    }

    query += ` LIMIT 10000`;

    const results = await this.env.DB.prepare(query).bind(...params).all();
    return (results.results as any[]).map((r) => r.id);
  }

  // ============================================
  // APPLY RULE
  // ============================================

  private async applyCorrectionRule(ruleId: string): Promise<Response> {
    const rule = await this.env.DB.prepare(
      `SELECT * FROM correction_rules WHERE id = ?`
    ).bind(ruleId).first<CorrectionRule>();

    if (!rule) {
      return Response.json({ error: 'Rule not found' }, { status: 404 });
    }

    // Ensure rule is active
    if (rule.status !== 'active') {
      await this.env.DB.prepare(
        `UPDATE correction_rules SET status = 'active', updated_at = datetime('now') WHERE id = ?`
      ).bind(ruleId).run();
    }

    const criteria = safeJsonParse<MatchCriteria>(rule.match_criteria, { field: '' });
    const correctionValue = safeJsonParse<any>(rule.correction_value, {});
    const affectedDocs = await this.findAffectedDocuments(criteria);

    let queued = 0;
    for (const docId of affectedDocs) {
      // Get current value
      const doc = await this.env.DB.prepare(
        `SELECT metadata FROM documents WHERE id = ?`
      ).bind(docId).first<{ metadata: string }>();

      const metadata = safeJsonParse<any>(doc?.metadata, {});
      const currentValue = getNestedValue(metadata, criteria.field);

      // Skip if no current value
      if (currentValue === undefined || currentValue === null) {
        continue;
      }

      // Calculate proposed value
      let proposedValue: string;
      let confidence = 0.7;

      switch (rule.correction_type) {
        case 'replace':
          proposedValue = correctionValue.new;
          confidence = 0.95;
          break;
        case 'regex':
          try {
            proposedValue = String(currentValue).replace(
              new RegExp(correctionValue.pattern, 'g'),
              correctionValue.replacement
            );
            confidence = 0.9;
          } catch {
            continue;
          }
          break;
        case 'ai_reextract':
          proposedValue = '__AI_REEXTRACT__';
          confidence = 0.6;
          break;
        default:
          proposedValue = '__MANUAL_REVIEW__';
          confidence = 0.5;
      }

      // Skip if no change
      if (proposedValue === String(currentValue)) {
        continue;
      }

      // Insert into correction queue
      await this.env.DB.prepare(
        `INSERT OR IGNORE INTO correction_queue
         (id, rule_id, document_id, field_path, current_value, proposed_value, status, confidence)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
      ).bind(
        generateId(),
        ruleId,
        docId,
        criteria.field,
        String(currentValue),
        proposedValue,
        confidence
      ).run();

      // Add to review queue if requires approval
      if (rule.requires_approval) {
        await this.env.DB.prepare(
          `INSERT INTO review_queue
           (id, review_type, priority, source_table, source_id, summary, context)
           VALUES (?, 'correction', ?, 'correction_queue', ?, ?, ?)`
        ).bind(
          generateId(),
          rule.correction_type === 'replace' ? 50 : 70,
          `${ruleId}-${docId}`,
          `${rule.rule_name}: "${currentValue}" → "${proposedValue}"`,
          JSON.stringify({ documentId: docId, ruleId, field: criteria.field })
        ).run();
      }

      queued++;
    }

    return Response.json({
      ruleId,
      status: 'active',
      correctionsQueued: queued,
      requiresApproval: rule.requires_approval,
    });
  }

  // ============================================
  // APPROVE / REJECT / APPLY
  // ============================================

  private async approveCorrections(input: { correctionIds: string[] }): Promise<Response> {
    const { correctionIds } = input;

    for (const correctionId of correctionIds) {
      await this.env.DB.prepare(
        `UPDATE correction_queue SET status = 'approved', reviewed_at = datetime('now')
         WHERE id = ?`
      ).bind(correctionId).run();

      // Update review queue
      await this.env.DB.prepare(
        `UPDATE review_queue SET status = 'resolved', resolved_at = datetime('now')
         WHERE source_table = 'correction_queue' AND source_id LIKE ?`
      ).bind(`%-${correctionId}`).run();
    }

    return Response.json({
      approved: correctionIds.length,
      message: 'Corrections approved. Run bulk-apply to execute.',
    });
  }

  private async rejectCorrections(input: { correctionIds: string[]; reason?: string }): Promise<Response> {
    const { correctionIds, reason } = input;

    for (const correctionId of correctionIds) {
      await this.env.DB.prepare(
        `UPDATE correction_queue SET status = 'rejected', review_notes = ?, reviewed_at = datetime('now')
         WHERE id = ?`
      ).bind(reason || null, correctionId).run();
    }

    return Response.json({ rejected: correctionIds.length });
  }

  private async bulkApplyApproved(): Promise<Response> {
    const approved = await this.env.DB.prepare(
      `SELECT cq.*, cr.correction_type, cr.correction_value
       FROM correction_queue cq
       JOIN correction_rules cr ON cq.rule_id = cr.id
       WHERE cq.status = 'approved'
       LIMIT 100`
    ).all();

    let applied = 0;
    let failed = 0;

    for (const correction of approved.results as any[]) {
      try {
        if (correction.proposed_value === '__AI_REEXTRACT__') {
          // Queue for AI re-extraction
          await this.env.REPROCESS_QUEUE.send({
            documentId: correction.document_id,
            fieldPath: correction.field_path,
            type: 'reextract',
          });
        } else if (correction.proposed_value !== '__MANUAL_REVIEW__') {
          // Direct update
          await this.applyCorrection(
            correction.document_id,
            correction.field_path,
            correction.proposed_value,
            correction.current_value
          );
        }

        // Mark as applied
        await this.env.DB.prepare(
          `UPDATE correction_queue SET status = 'applied', applied_at = datetime('now'), rollback_value = ?
           WHERE id = ?`
        ).bind(correction.current_value, correction.id).run();

        // Audit log
        await this.env.DB.prepare(
          `INSERT INTO correction_audit_log
           (id, document_id, rule_id, action, field_path, old_value, new_value, performed_by)
           VALUES (?, ?, ?, 'correction_applied', ?, ?, ?, 'system')`
        ).bind(
          generateId(),
          correction.document_id,
          correction.rule_id,
          correction.field_path,
          correction.current_value,
          correction.proposed_value
        ).run();

        // Update rule stats
        await this.env.DB.prepare(
          `UPDATE correction_rules SET documents_corrected = documents_corrected + 1, updated_at = datetime('now') WHERE id = ?`
        ).bind(correction.rule_id).run();

        applied++;
      } catch (error) {
        failed++;
        console.error(`Failed to apply correction ${correction.id}:`, error);
      }
    }

    return Response.json({
      applied,
      failed,
      remaining: approved.results.length - applied - failed,
    });
  }

  private async applyCorrection(
    documentId: string,
    fieldPath: string,
    newValue: string,
    oldValue: string
  ): Promise<void> {
    const doc = await this.env.DB.prepare(
      `SELECT metadata FROM documents WHERE id = ?`
    ).bind(documentId).first<{ metadata: string }>();

    const metadata = safeJsonParse<any>(doc?.metadata, {});
    setNestedValue(metadata, fieldPath, newValue);

    await this.env.DB.prepare(
      `UPDATE documents SET metadata = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(JSON.stringify(metadata), documentId).run();

    // Propagate to entities if relevant
    if (fieldPath.includes('entities') || fieldPath.includes('parties')) {
      await this.propagateEntityCorrection(documentId, fieldPath, oldValue, newValue);
    }

    // Propagate to authority grants if relevant
    if (fieldPath.includes('authority') || fieldPath.includes('effective_date')) {
      await this.propagateAuthorityCorrection(documentId);
    }
  }

  private async propagateEntityCorrection(
    documentId: string,
    fieldPath: string,
    oldName: string,
    newName: string
  ): Promise<void> {
    // Find entity with old name linked to this document
    const entity = await this.env.DB.prepare(
      `SELECT e.id FROM entities e
       JOIN document_entities de ON e.id = de.entity_id
       WHERE de.document_id = ? AND e.name = ?`
    ).bind(documentId, oldName).first<{ id: string }>();

    if (entity) {
      // Check if entity with new name already exists
      const existingEntity = await this.env.DB.prepare(
        `SELECT id FROM entities WHERE name = ?`
      ).bind(newName).first<{ id: string }>();

      if (existingEntity) {
        // Merge entities
        await this.env.DB.prepare(
          `UPDATE document_entities SET entity_id = ? WHERE entity_id = ?`
        ).bind(existingEntity.id, entity.id).run();

        await this.env.DB.prepare(
          `UPDATE authority_grants SET grantor_entity_id = ? WHERE grantor_entity_id = ?`
        ).bind(existingEntity.id, entity.id).run();

        await this.env.DB.prepare(
          `UPDATE authority_grants SET grantee_entity_id = ? WHERE grantee_entity_id = ?`
        ).bind(existingEntity.id, entity.id).run();

        await this.env.DB.prepare(
          `UPDATE entities SET merged_into = ? WHERE id = ?`
        ).bind(existingEntity.id, entity.id).run();
      } else {
        // Just rename
        await this.env.DB.prepare(
          `UPDATE entities SET name = ?, normalized_name = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(newName, newName.toLowerCase(), entity.id).run();
      }
    }
  }

  private async propagateAuthorityCorrection(documentId: string): Promise<void> {
    const doc = await this.env.DB.prepare(
      `SELECT metadata FROM documents WHERE id = ?`
    ).bind(documentId).first<{ metadata: string }>();

    const metadata = safeJsonParse<any>(doc?.metadata, {});

    await this.env.DB.prepare(
      `UPDATE authority_grants
       SET effective_date = ?, expiration_date = ?
       WHERE document_id = ?`
    ).bind(
      metadata.effectiveDate || null,
      metadata.expirationDate || null,
      documentId
    ).run();
  }

  // ============================================
  // ERROR SCANNING
  // ============================================

  private async scanForKnownErrors(): Promise<Response> {
    const errorPatterns = [
      {
        name: 'Invalid date format (MM/DD/YYYY)',
        query: `SELECT id FROM documents WHERE json_extract(metadata, '$.effectiveDate') LIKE '%/%' LIMIT 100`,
        suggestedRule: {
          type: 'date_extraction',
          correction: 'regex',
          pattern: '(\\d{1,2})/(\\d{1,2})/(\\d{4})',
          replacement: '$3-$1-$2',
        },
      },
      {
        name: 'LLC missing suffix',
        query: `SELECT d.id FROM documents d
                JOIN document_entities de ON d.id = de.document_id
                JOIN entities e ON de.entity_id = e.id
                WHERE d.document_type = 'llc_formation'
                AND e.entity_type = 'llc'
                AND e.name NOT LIKE '%LLC%'
                LIMIT 100`,
        suggestedRule: { type: 'entity_name', correction: 'manual_review' },
      },
      {
        name: 'Authority type mismatch',
        query: `SELECT d.id FROM documents d
                JOIN authority_grants ag ON d.id = ag.document_id
                WHERE d.document_type = 'poa_healthcare'
                AND ag.authority_type != 'poa_healthcare'
                LIMIT 100`,
        suggestedRule: {
          type: 'authority_type',
          correction: 'replace',
          value: 'poa_healthcare',
        },
      },
      {
        name: 'Missing effective date',
        query: `SELECT id FROM documents
                WHERE document_type LIKE 'poa_%'
                AND (json_extract(metadata, '$.effectiveDate') IS NULL
                     OR json_extract(metadata, '$.effectiveDate') = '')
                LIMIT 100`,
        suggestedRule: { type: 'date_extraction', correction: 'ai_reextract' },
      },
    ];

    const findings: any[] = [];

    for (const pattern of errorPatterns) {
      try {
        const results = await this.env.DB.prepare(pattern.query).all();
        if (results.results.length > 0) {
          findings.push({
            errorPattern: pattern.name,
            documentsAffected: results.results.length,
            sampleDocumentIds: (results.results as any[]).slice(0, 5).map((r) => r.id),
            suggestedRule: pattern.suggestedRule,
          });
        }
      } catch (e) {
        console.error(`Error scanning pattern "${pattern.name}":`, e);
      }
    }

    return Response.json({
      scannedAt: new Date().toISOString(),
      errorsFound: findings.length,
      findings,
    });
  }

  // ============================================
  // QUEUE ACCESS
  // ============================================

  private async getCorrectionQueue(params: URLSearchParams): Promise<Response> {
    const status = params.get('status') || 'pending';
    const ruleId = params.get('ruleId');
    const limit = parseInt(params.get('limit') || '50');

    let query = `SELECT cq.*, d.file_name, cr.rule_name
                 FROM correction_queue cq
                 JOIN documents d ON cq.document_id = d.id
                 JOIN correction_rules cr ON cq.rule_id = cr.id
                 WHERE cq.status = ?`;
    const bindings: any[] = [status];

    if (ruleId) {
      query += ` AND cq.rule_id = ?`;
      bindings.push(ruleId);
    }

    query += ` ORDER BY cq.created_at DESC LIMIT ?`;
    bindings.push(limit);

    const queue = await this.env.DB.prepare(query).bind(...bindings).all();
    return Response.json(queue.results);
  }
}
