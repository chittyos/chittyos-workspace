// ============================================
// DOCUMENT PROCESSING WORKFLOW
// Durable execution for OCR, extraction, embedding
// ============================================

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { Env, WorkflowInput, ProcessingState, ExtractedDocumentData, EntityInfo, ExtractedUnknown } from '../types';
import { generateId, inferEntityType, safeJsonParse } from '../utils';
import { KnowledgeGapsService } from '../services/knowledge-gaps';

export class DocumentProcessingWorkflow extends WorkflowEntrypoint<Env, WorkflowInput> {
  async run(event: WorkflowEvent<WorkflowInput>, step: WorkflowStep) {
    const input = event.payload;
    const instanceId = event.instanceId;

    const state: ProcessingState = {
      documentId: input.documentId,
      r2Key: input.r2Key,
      contentHash: input.contentHash,
    };

    // ============================================
    // STEP 1: OCR Processing
    // ============================================
    const ocrResult = await step.do(
      'ocr-processing',
      {
        retries: { limit: 5, delay: '10 seconds', backoff: 'exponential' },
        timeout: '5 minutes',
      },
      async () => {
        // Update status
        await this.env.DB.prepare(
          `UPDATE documents SET processing_status = 'processing', updated_at = datetime('now') WHERE id = ?`
        ).bind(state.documentId).run();

        // Fetch document from R2
        const object = await this.env.DOCUMENTS.get(state.r2Key);
        if (!object) {
          throw new Error(`Document not found in R2: ${state.r2Key}`);
        }

        const fileBuffer = await object.arrayBuffer();
        const contentType = object.httpMetadata?.contentType || input.contentType;

        let ocrText: string;

        if (contentType === 'application/pdf') {
          ocrText = await this.performPdfOcr(fileBuffer);
        } else if (contentType.startsWith('image/')) {
          ocrText = await this.performImageOcr(fileBuffer);
        } else {
          throw new Error(`Unsupported content type for OCR: ${contentType}`);
        }

        // Update document with OCR text
        await this.env.DB.prepare(
          `UPDATE documents SET ocr_text = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(ocrText, state.documentId).run();

        await this.logStep(state.documentId, instanceId, 'ocr-processing', 'completed');

        return { ocrText, charCount: ocrText.length };
      }
    );

    state.ocrText = ocrResult.ocrText;

    // ============================================
    // STEP 2: Document Classification & Extraction
    // (Uncertainty-Aware)
    // ============================================
    const extractionResult = await step.do(
      'document-classification-extraction',
      {
        retries: { limit: 3, delay: '5 seconds', backoff: 'exponential' },
        timeout: '3 minutes',
      },
      async () => {
        const extractedData = await this.extractDocumentData(state.ocrText!);

        // Update document type and metadata
        await this.env.DB.prepare(
          `UPDATE documents SET document_type = ?, metadata = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(
          extractedData.documentType,
          JSON.stringify(extractedData),
          state.documentId
        ).run();

        await this.logStep(state.documentId, instanceId, 'document-classification-extraction', 'completed');

        return extractedData;
      }
    );

    state.documentType = extractionResult.documentType;
    state.extractedData = extractionResult;

    // ============================================
    // STEP 3: Register Knowledge Gaps
    // ============================================
    const gapsResult = await step.do(
      'register-knowledge-gaps',
      {
        retries: { limit: 2, delay: '3 seconds' },
        timeout: '1 minute',
      },
      async () => {
        const gapService = new KnowledgeGapsService(this.env);

        // Register any unknowns from extraction
        const unknownsResult = await gapService.processExtractionUnknowns(
          state.documentId,
          state.extractedData?.unknowns || []
        );

        // Check if this document resolves any existing gaps
        const resolvable = await gapService.findResolvableGaps(
          state.ocrText || '',
          state.documentType || ''
        );

        // Auto-propose resolutions for high-confidence matches
        for (const gap of resolvable) {
          if (gap.confidence > 0.85 && gap.proposedValue) {
            await gapService.proposeResolution(gap.gapId, gap.proposedValue, {
              type: 'document_match',
              documentId: state.documentId,
              confidence: gap.confidence,
            });
          }
        }

        await this.logStep(state.documentId, instanceId, 'register-knowledge-gaps', 'completed');

        return {
          unknownsRegistered: unknownsResult.registered.length,
          unknownsLinked: unknownsResult.linked.length,
          gapsResolvable: resolvable.length,
        };
      }
    );

    // ============================================
    // STEP 4: Entity Resolution
    // ============================================
    const entityResult = await step.do(
      'entity-resolution',
      {
        retries: { limit: 3, delay: '3 seconds', backoff: 'exponential' },
        timeout: '2 minutes',
      },
      async () => {
        const entities: EntityInfo[] = [];
        const parties = state.extractedData?.parties || [];

        for (const party of parties) {
          // Skip if this is a gap placeholder
          if (party.name.startsWith('{{GAP:')) {
            continue;
          }

          // Try to find existing entity
          const existingEntity = await this.env.DB.prepare(
            `SELECT id, name, entity_type FROM entities WHERE name = ? COLLATE NOCASE`
          ).bind(party.name).first<{ id: string; name: string; entity_type: string }>();

          let entityId: string;
          let entityType = inferEntityType(party.name, party.role);

          if (existingEntity) {
            entityId = existingEntity.id;
            entityType = existingEntity.entity_type;
          } else {
            entityId = generateId();
            await this.env.DB.prepare(
              `INSERT INTO entities (id, entity_type, name, normalized_name, identifiers, metadata)
               VALUES (?, ?, ?, ?, ?, ?)`
            ).bind(
              entityId,
              entityType,
              party.name,
              party.name.toLowerCase(),
              JSON.stringify(party.identifiers || {}),
              JSON.stringify({ source: state.documentId })
            ).run();
          }

          // Link entity to document
          await this.env.DB.prepare(
            `INSERT OR IGNORE INTO document_entities (document_id, entity_id, role, confidence)
             VALUES (?, ?, ?, ?)`
          ).bind(state.documentId, entityId, party.role, party.confidence).run();

          entities.push({
            id: entityId,
            type: entityType as any,
            name: party.name,
            role: party.role,
          });
        }

        await this.logStep(state.documentId, instanceId, 'entity-resolution', 'completed');

        return { entities, count: entities.length };
      }
    );

    state.entities = entityResult.entities;

    // ============================================
    // STEP 5: Authority Graph Update
    // ============================================
    const authorityResult = await step.do(
      'authority-graph-update',
      {
        retries: { limit: 3, delay: '5 seconds', backoff: 'exponential' },
        timeout: '2 minutes',
      },
      async () => {
        const authorityGrants: any[] = [];
        const extractedGrants = state.extractedData?.authorityGrants || [];

        for (const grant of extractedGrants) {
          // Find grantor and grantee entities
          const grantor = state.entities?.find(
            (e) =>
              e.name.toLowerCase() === grant.grantorName?.toLowerCase() ||
              e.role === 'grantor'
          );
          const grantee = state.entities?.find(
            (e) =>
              e.name.toLowerCase() === grant.granteeName?.toLowerCase() ||
              e.role === 'grantee'
          );

          if (grantor && grantee) {
            const grantId = generateId();

            // Check for existing active grants to potentially supersede
            const existingGrant = await this.env.DB.prepare(
              `SELECT id, document_id FROM authority_grants
               WHERE grantor_entity_id = ? AND grantee_entity_id = ?
               AND authority_type = ? AND is_active = 1`
            ).bind(grantor.id, grantee.id, grant.authorityType).first<{ id: string; document_id: string }>();

            // Deactivate existing grant if this one supersedes it
            if (existingGrant) {
              await this.env.DB.prepare(
                `UPDATE authority_grants SET is_active = 0, revoked_by = ? WHERE id = ?`
              ).bind(grantId, existingGrant.id).run();

              // Mark old document as superseded
              await this.env.DB.prepare(
                `UPDATE documents SET superseded_by = ? WHERE id = ?`
              ).bind(state.documentId, existingGrant.document_id).run();

              await this.env.DB.prepare(
                `UPDATE documents SET supersedes = ? WHERE id = ?`
              ).bind(existingGrant.document_id, state.documentId).run();
            }

            // Create new authority grant
            await this.env.DB.prepare(
              `INSERT INTO authority_grants
               (id, document_id, grantor_entity_id, grantee_entity_id, authority_type, scope, effective_date, expiration_date)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              grantId,
              state.documentId,
              grantor.id,
              grantee.id,
              grant.authorityType,
              JSON.stringify(grant.scope),
              state.extractedData?.effectiveDate || null,
              state.extractedData?.expirationDate || null
            ).run();

            authorityGrants.push({
              id: grantId,
              grantorEntityId: grantor.id,
              granteeEntityId: grantee.id,
              authorityType: grant.authorityType,
            });
          }
        }

        await this.logStep(state.documentId, instanceId, 'authority-graph-update', 'completed');

        return { authorityGrants, count: authorityGrants.length };
      }
    );

    // ============================================
    // STEP 6: Generate Embeddings
    // ============================================
    const embeddingResult = await step.do(
      'generate-embeddings',
      {
        retries: { limit: 3, delay: '5 seconds', backoff: 'exponential' },
        timeout: '3 minutes',
      },
      async () => {
        // Create rich text for embedding
        const embeddingText = this.createEmbeddingText(state);

        // Generate embedding using Workers AI
        const embeddingResponse = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
          text: [embeddingText],
        });

        const embedding = (embeddingResponse as any).data[0];

        // Prepare metadata for Vectorize
        const metadata = {
          documentId: state.documentId,
          documentType: state.documentType || 'unknown',
          fileName: input.fileName,
          entityIds: state.entities?.map((e) => e.id).join(',') || '',
          hasAuthorityGrants: (state.extractedData?.authorityGrants?.length || 0) > 0,
          effectiveDate: state.extractedData?.effectiveDate || '',
          keyTerms: state.extractedData?.keyTerms?.slice(0, 5).join(',') || '',
        };

        // Upsert to Vectorize
        await this.env.VECTORIZE.upsert([
          {
            id: state.documentId,
            values: embedding,
            metadata,
          },
        ]);

        await this.logStep(state.documentId, instanceId, 'generate-embeddings', 'completed');

        return { embeddingId: state.documentId, dimensions: embedding.length };
      }
    );

    state.embeddingId = embeddingResult.embeddingId;

    // ============================================
    // STEP 7: Post-Ingest Duplicate Check
    // ============================================
    await step.do(
      'post-ingest-duplicate-check',
      {
        retries: { limit: 2, delay: '2 seconds' },
        timeout: '1 minute',
      },
      async () => {
        // Trigger duplicate hunter for this specific document
        const hunterId = this.env.DUPLICATE_HUNTER.idFromName('global');
        const hunter = this.env.DUPLICATE_HUNTER.get(hunterId);

        await hunter.fetch(
          new Request(`http://internal/scan/document?documentId=${state.documentId}`)
        );

        await this.logStep(state.documentId, instanceId, 'post-ingest-duplicate-check', 'completed');

        return { triggered: true };
      }
    );

    // ============================================
    // STEP 8: Finalize
    // ============================================
    const finalResult = await step.do(
      'finalize-processing',
      {
        retries: { limit: 2, delay: '2 seconds', backoff: 'constant' },
        timeout: '30 seconds',
      },
      async () => {
        await this.env.DB.prepare(
          `UPDATE documents
           SET processing_status = 'completed', updated_at = datetime('now')
           WHERE id = ?`
        ).bind(state.documentId).run();

        await this.logStep(state.documentId, instanceId, 'finalize-processing', 'completed');

        return {
          documentId: state.documentId,
          status: 'completed',
          documentType: state.documentType,
          entitiesCreated: state.entities?.length || 0,
          authorityGrantsCreated: authorityResult.count,
          knowledgeGapsRegistered: gapsResult.unknownsRegistered,
          embeddingIndexed: true,
        };
      }
    );

    return finalResult;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async performPdfOcr(buffer: ArrayBuffer): Promise<string> {
    // Use Workers AI vision model for OCR
    const response = await this.env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
      messages: [
        {
          role: 'user',
          content: 'Extract all text from this document. Return only the extracted text, preserving formatting and structure where possible. Do not add commentary.',
        },
      ],
      image: Array.from(new Uint8Array(buffer)),
    });
    return (response as any).response || '';
  }

  private async performImageOcr(buffer: ArrayBuffer): Promise<string> {
    const response = await this.env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
      messages: [
        {
          role: 'user',
          content: 'Extract all text from this image. Return only the extracted text, preserving formatting where possible.',
        },
      ],
      image: Array.from(new Uint8Array(buffer)),
    });
    return (response as any).response || '';
  }

  private async extractDocumentData(ocrText: string): Promise<ExtractedDocumentData> {
    const prompt = `You are extracting structured data from a legal document.

CRITICAL INSTRUCTION FOR UNCERTAINTY:
- If you are NOT CONFIDENT about a value, DO NOT GUESS
- Instead, use the placeholder format: {{UNKNOWN:type:partial_hint}}
- Examples:
  - Unclear name: {{UNKNOWN:entity_name:S___ LLC}}
  - Unclear date: {{UNKNOWN:date:sometime_in_2019}}
  - Unclear relationship: {{UNKNOWN:relationship:grantor_or_grantee}}

Document text:
${ocrText.slice(0, 15000)}

Respond with JSON only:
{
  "documentType": "poa_general" | "poa_limited" | "poa_healthcare" | "llc_formation" | "llc_operating_agreement" | "corporate_resolution" | "financial_statement" | "contract" | "deed" | "trust" | "other",
  "confidence": 0.0-1.0,
  "title": "extracted document title",
  "effectiveDate": "YYYY-MM-DD or null",
  "expirationDate": "YYYY-MM-DD or null",
  "parties": [
    {"name": "Full Name or {{UNKNOWN:entity_name:hint}}", "role": "grantor|grantee|member|officer|witness|notary", "identifiers": {}, "confidence": 0.0-1.0}
  ],
  "keyTerms": ["important legal terms found"],
  "references": [
    {"type": "supersedes|references|amends", "description": "description"}
  ],
  "authorityGrants": [
    {"grantorName": "name", "granteeName": "name", "authorityType": "type", "scope": {}}
  ],
  "unknowns": [
    {
      "placeholder": "{{UNKNOWN:type:hint}}",
      "type": "entity_name|date|amount|address|relationship|authority_scope",
      "partialValue": "what you can see",
      "contextClues": ["clue1", "clue2"],
      "resolutionHints": ["what would help resolve this"],
      "confidence": 0.0-1.0,
      "fieldPath": "parties[0].name"
    }
  ]
}`;

    const aiResponse = await this.env.AI.run('@cf/meta/llama-3.1-70b-instruct' as any, {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
    });

    const responseText = (aiResponse as any).response || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from AI response');
    }

    return JSON.parse(jsonMatch[0]) as ExtractedDocumentData;
  }

  private createEmbeddingText(state: ProcessingState): string {
    const parts: string[] = [];

    if (state.documentType) {
      parts.push(`Document type: ${state.documentType}`);
    }

    if (state.extractedData?.title) {
      parts.push(`Title: ${state.extractedData.title}`);
    }

    if (state.entities && state.entities.length > 0) {
      const entityText = state.entities
        .map((e) => `${e.role}: ${e.name} (${e.type})`)
        .join('; ');
      parts.push(`Parties: ${entityText}`);
    }

    if (state.extractedData?.keyTerms && state.extractedData.keyTerms.length > 0) {
      parts.push(`Key terms: ${state.extractedData.keyTerms.join(', ')}`);
    }

    if (state.ocrText) {
      parts.push(`Content: ${state.ocrText.slice(0, 5000)}`);
    }

    return parts.join('\n\n');
  }

  private async logStep(
    documentId: string,
    instanceId: string,
    stepName: string,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    await this.env.DB.prepare(
      `INSERT INTO processing_log (id, document_id, workflow_instance_id, step_name, status, error_message)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      generateId(),
      documentId,
      instanceId,
      stepName,
      status,
      errorMessage || null
    ).run();
  }
}
