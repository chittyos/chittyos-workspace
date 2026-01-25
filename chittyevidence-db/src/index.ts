// ============================================
// CHITTY EVIDENCE PLATFORM - MAIN ENTRY POINT
// ============================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import { handleUpload, handleBulkUpload, handleStatusCheck } from './workers/gatekeeper';
import { KnowledgeGapsService } from './services/svc-knowledgegaps';
import { ChittyContextService } from './services/svc-chittycontext';
import { LegalConstitutionService } from './services/svc-legalconstitution';
import { authenticateRequest, hasPermission, AuthContext } from './services/svc-chittyconnect';
import { exportRoutes } from './routes/export';
import { ExportService } from './services/svc-export';
import { generateId } from './utils';
// Pipeline imports (EDRM-aligned)
import { collectionRoutes } from './pipelines/collection-handler';
import { handleIntakeStream } from './pipelines/intake-worker';
import { ConsiderationEvent } from './pipelines/pre-filter';
import preFilterTransform from './pipelines/pre-filter-transform';
import intakeTransform from './pipelines/intake-transform';
// Capability Framework imports
import { createContext, isSuccess, isFailure, evaluateRolloutRules } from '@chittyos/core';
import type { ChittyContext } from '@chittyos/core';
import { createEvidenceCapabilities } from './capabilities';

// Re-export Durable Objects and Workflow
export { DuplicateHunterDO } from './durable-objects/duplicate-hunter';
export { AccuracyGuardianDO } from './durable-objects/accuracy-guardian';
export { DocumentProcessingWorkflow } from './workflows/document-processing';

// Define context variables for Hono
type Variables = {
  auth: AuthContext;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================
// MIDDLEWARE
// ============================================

app.use('*', cors());

// Response time header
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  c.header('X-Response-Time', `${duration}ms`);
});

// Authentication middleware for protected routes
// Mutating operations require authentication
const PROTECTED_PREFIXES = [
  '/documents',      // Document uploads and modifications
  '/gaps',           // Knowledge gap modifications
  '/duplicates',     // Duplicate resolution
  '/corrections',    // Correction rule management
  '/chitty',         // ChittyID operations
  '/sessions',       // Session management
  '/provenance',     // Provenance recording
  '/accountability', // Accountability records
  '/legal',          // Legal operations (except reads)
];

const READ_ONLY_METHODS = ['GET', 'HEAD', 'OPTIONS'];

app.use('*', async (c, next) => {
  const path = c.req.path;
  const method = c.req.method;

  // Skip auth for health/info endpoints
  if (path === '/' || path === '/health') {
    return next();
  }

  // Always attempt authentication (needed for trust scores in capabilities)
  const auth = await authenticateRequest(c.req.raw, c.env);
  c.set('auth', auth);

  // Check if this is a protected prefix
  const isProtected = PROTECTED_PREFIXES.some(prefix => path.startsWith(prefix));

  // Allow read-only requests without requiring authentication
  if (!isProtected || READ_ONLY_METHODS.includes(method)) {
    return next();
  }

  // Require auth for protected write operations
  if (!auth.authenticated) {
    return c.json({
      error: 'Unauthorized',
      message: 'Valid authentication required for this operation',
      hint: 'Provide Authorization header with Bearer token or Service credentials'
    }, 401);
  }

  await next();
});

// ============================================
// HEALTH & INFO
// ============================================

app.get('/', (c) => {
  return c.json({
    name: 'Chitty Evidence Platform',
    version: '1.0.0',
    status: 'operational',
    endpoints: {
      documents: {
        upload: 'POST /documents',
        bulkCheck: 'POST /documents/bulk-check',
        status: 'GET /documents/:id/status',
        get: 'GET /documents/:id',
      },
      search: 'POST /search',
      gaps: {
        list: 'GET /gaps',
        get: 'GET /gaps/:id',
        propose: 'POST /gaps/:id/propose',
        resolve: 'POST /gaps/:id/resolve',
        rollback: 'POST /gaps/:id/rollback',
      },
      duplicates: {
        list: 'GET /duplicates',
        status: 'GET /duplicates/status',
        scan: 'POST /duplicates/scan',
        resolve: 'POST /duplicates/:id/resolve',
      },
      corrections: {
        rules: 'GET /corrections/rules',
        createRule: 'POST /corrections/rules',
        applyRule: 'POST /corrections/rules/:id/apply',
        queue: 'GET /corrections/queue',
        approve: 'POST /corrections/approve',
        apply: 'POST /corrections/apply',
      },
      authority: {
        get: 'GET /authority/:entityId',
        expiring: 'GET /authority/expiring',
      },
      entities: {
        list: 'GET /entities',
        get: 'GET /entities/:id',
      },
      chittyId: {
        register: 'POST /chitty/register',
        get: 'GET /chitty/:id',
        addAttestation: 'POST /chitty/:id/attestations',
        startSession: 'POST /chitty/:id/sessions',
        getSessions: 'GET /chitty/:id/sessions',
        getExpertise: 'GET /chitty/:id/expertise',
        recordAction: 'POST /chitty/:id/actions',
        addCertification: 'POST /chitty/:id/certifications',
        accountability: 'GET /chitty/:id/accountability',
      },
      sessions: {
        get: 'GET /sessions/:id',
        updateState: 'PUT /sessions/:id/state',
        end: 'POST /sessions/:id/end',
      },
      provenance: {
        record: 'POST /provenance',
        getChain: 'GET /provenance/:entityType/:entityId',
        verify: 'GET /provenance/:entityType/:entityId/verify',
      },
      accountability: {
        record: 'POST /accountability',
        verify: 'POST /accountability/:id/verify',
        dispute: 'POST /accountability/:id/dispute',
        resolve: 'POST /accountability/:id/resolve',
      },
      legal: {
        check: 'POST /legal/check',
        constitution: 'GET /legal/constitution',
        claimTypes: 'GET /legal/claim-types',
        sourceRequirements: 'GET /legal/claim-types/:id/sources',
        approvedSources: 'GET /legal/approved-sources',
        admissibilityRules: 'GET /legal/admissibility-rules',
        analyzeClaim: 'POST /legal/documents/:id/claims',
        custody: 'GET /legal/documents/:id/custody',
        addCustody: 'POST /legal/documents/:id/custody',
        facts: 'GET /legal/cases/:caseId/facts',
        addFact: 'POST /legal/cases/:caseId/facts',
      },
      pipeline: {
        // EDRM Collection stage endpoints
        collect: 'POST /collect',
        collectBatch: 'POST /collect/batch',
        collectStatus: 'GET /collect/:submission_id',
        collectRetry: 'POST /collect/retry/:submission_id',
        pipelineStats: 'GET /collect/stats',
      },
      export: {
        targets: 'GET /export/targets',
        createTarget: 'POST /export/targets',
        syncTarget: 'POST /export/targets/:id/sync',
        syncHistory: 'GET /export/targets/:id/syncs',
        webhooks: 'GET /export/webhooks',
        createWebhook: 'POST /export/webhooks',
        testWebhook: 'POST /export/webhooks/:id/test',
        events: 'GET /export/events',
        processEvents: 'POST /export/events/process',
        documentSyncStatus: 'GET /export/documents/:id/sync-status',
        stats: 'GET /export/stats',
        setupNeon: 'POST /export/setup/neon',
        validateNotion: 'POST /export/setup/notion/validate',
      },
    },
  });
});

app.get('/health', (c) => c.json({ status: 'healthy', timestamp: new Date().toISOString() }));

// ============================================
// EXPORT & DISTRIBUTION ROUTES
// ============================================

app.route('/export', exportRoutes);

// ============================================
// PIPELINE: COLLECTION ENDPOINT (EDRM-Aligned)
// EDRM Stage: Collection - gathering potentially relevant documents
// https://edrm.net/resources/frameworks-and-standards/edrm-model/
// ============================================

app.route('/collect', collectionRoutes);

// ============================================
// DOCUMENT UPLOAD & STATUS
// ============================================

app.post('/documents', async (c) => {
  return handleUpload(c.req.raw, c.env);
});

app.post('/documents/bulk-check', async (c) => {
  return handleBulkUpload(c.req.raw, c.env);
});

app.get('/documents/:id/status', async (c) => {
  const { id } = c.req.param();
  return handleStatusCheck(id, c.env);
});

app.get('/documents/:id', async (c) => {
  const { id } = c.req.param();

  const doc = await c.env.DB.prepare(
    `SELECT d.*,
            GROUP_CONCAT(DISTINCT e.name) as entity_names
     FROM documents d
     LEFT JOIN document_entities de ON d.id = de.document_id
     LEFT JOIN entities e ON de.entity_id = e.id
     WHERE d.id = ?
     GROUP BY d.id`
  ).bind(id).first();

  if (!doc) {
    return c.json({ error: 'Document not found' }, 404);
  }

  // Get related entities
  const entities = await c.env.DB.prepare(
    `SELECT e.*, de.role FROM entities e
     JOIN document_entities de ON e.id = de.entity_id
     WHERE de.document_id = ?`
  ).bind(id).all();

  // Get authority grants
  const authorities = await c.env.DB.prepare(
    `SELECT ag.*,
            g.name as grantor_name,
            e.name as grantee_name
     FROM authority_grants ag
     JOIN entities g ON ag.grantor_entity_id = g.id
     JOIN entities e ON ag.grantee_entity_id = e.id
     WHERE ag.document_id = ?`
  ).bind(id).all();

  return c.json({
    document: doc,
    entities: entities.results,
    authorities: authorities.results,
  });
});

// ============================================
// SEMANTIC SEARCH
// ============================================

app.post('/search', async (c) => {
  const body = await c.req.json();
  const { query, documentType, entityId, limit = 10 } = body;

  if (!query) {
    return c.json({ error: 'Missing query parameter' }, 400);
  }

  // Generate query embedding
  const embeddingResponse = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: [query],
  });
  const queryEmbedding = (embeddingResponse as any).data[0];

  // Build filter
  const filter: Record<string, string> = {};
  if (documentType) filter.documentType = documentType;

  // Search Vectorize
  const results = await c.env.VECTORIZE.query(queryEmbedding, {
    topK: limit,
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    returnMetadata: 'all',
  });

  if (results.matches.length === 0) {
    return c.json({ query, results: [] });
  }

  // Fetch full document details
  const documentIds = results.matches.map((m) => m.id);
  const placeholders = documentIds.map(() => '?').join(',');

  const documents = await c.env.DB.prepare(
    `SELECT d.*,
            GROUP_CONCAT(DISTINCT e.name) as entity_names
     FROM documents d
     LEFT JOIN document_entities de ON d.id = de.document_id
     LEFT JOIN entities e ON de.entity_id = e.id
     WHERE d.id IN (${placeholders})
     GROUP BY d.id`
  ).bind(...documentIds).all();

  // Merge with scores
  const enrichedResults = results.matches.map((match) => ({
    score: match.score,
    document: (documents.results as any[]).find((d) => d.id === match.id),
    metadata: match.metadata,
  }));

  return c.json({ query, results: enrichedResults });
});

// ============================================
// KNOWLEDGE GAPS
// ============================================

app.get('/gaps', async (c) => {
  const gapService = new KnowledgeGapsService(c.env);
  const type = c.req.query('type') as any;
  const minOccurrences = parseInt(c.req.query('minOccurrences') || '1');
  const limit = parseInt(c.req.query('limit') || '50');

  const gaps = await gapService.getOpenGaps({ type, minOccurrences, limit });
  return c.json(gaps);
});

app.get('/gaps/:id', async (c) => {
  const { id } = c.req.param();
  const gapService = new KnowledgeGapsService(c.env);

  const details = await gapService.getGapDetails(id);
  if (!details) {
    return c.json({ error: 'Gap not found' }, 404);
  }

  return c.json(details);
});

app.post('/gaps/:id/propose', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const gapService = new KnowledgeGapsService(c.env);

  const result = await gapService.proposeResolution(id, body.value, {
    type: body.sourceType || 'user_input',
    documentId: body.sourceDocumentId,
    confidence: body.confidence || 0.8,
  });

  return c.json(result);
});

app.post('/gaps/:id/resolve', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const gapService = new KnowledgeGapsService(c.env);

  const result = await gapService.resolveGap(
    id,
    body.value,
    body.resolvedBy || 'manual',
    body.sourceDocumentId
  );

  return c.json(result);
});

app.post('/gaps/:id/rollback', async (c) => {
  const { id } = c.req.param();
  const gapService = new KnowledgeGapsService(c.env);

  const result = await gapService.rollbackResolution(id);
  return c.json(result);
});

// ============================================
// DUPLICATE HUNTER
// ============================================

app.get('/duplicates', async (c) => {
  const hunterId = c.env.DUPLICATE_HUNTER.idFromName('global');
  const hunter = c.env.DUPLICATE_HUNTER.get(hunterId);

  const status = c.req.query('status') || 'pending';
  const limit = c.req.query('limit') || '50';

  return hunter.fetch(
    new Request(`http://internal/candidates?status=${status}&limit=${limit}`)
  );
});

app.get('/duplicates/status', async (c) => {
  const hunterId = c.env.DUPLICATE_HUNTER.idFromName('global');
  const hunter = c.env.DUPLICATE_HUNTER.get(hunterId);
  return hunter.fetch(new Request('http://internal/status'));
});

app.post('/duplicates/scan', async (c) => {
  const hunterId = c.env.DUPLICATE_HUNTER.idFromName('global');
  const hunter = c.env.DUPLICATE_HUNTER.get(hunterId);
  return hunter.fetch(new Request('http://internal/scan/incremental'));
});

app.post('/duplicates/:id/resolve', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();

  const hunterId = c.env.DUPLICATE_HUNTER.idFromName('global');
  const hunter = c.env.DUPLICATE_HUNTER.get(hunterId);

  return hunter.fetch(
    new Request('http://internal/resolve', {
      method: 'POST',
      body: JSON.stringify({ candidateId: id, ...body }),
    })
  );
});

// ============================================
// ACCURACY GUARDIAN / CORRECTIONS
// ============================================

app.get('/corrections/rules', async (c) => {
  const guardianId = c.env.ACCURACY_GUARDIAN.idFromName('global');
  const guardian = c.env.ACCURACY_GUARDIAN.get(guardianId);

  const status = c.req.query('status') || '';
  return guardian.fetch(new Request(`http://internal/rules/list?status=${status}`));
});

app.post('/corrections/rules', async (c) => {
  const guardianId = c.env.ACCURACY_GUARDIAN.idFromName('global');
  const guardian = c.env.ACCURACY_GUARDIAN.get(guardianId);

  return guardian.fetch(
    new Request('http://internal/rules/create', {
      method: 'POST',
      body: JSON.stringify(await c.req.json()),
    })
  );
});

app.post('/corrections/rules/:id/apply', async (c) => {
  const { id } = c.req.param();
  const guardianId = c.env.ACCURACY_GUARDIAN.idFromName('global');
  const guardian = c.env.ACCURACY_GUARDIAN.get(guardianId);

  return guardian.fetch(new Request(`http://internal/rules/apply?ruleId=${id}`));
});

app.get('/corrections/queue', async (c) => {
  const guardianId = c.env.ACCURACY_GUARDIAN.idFromName('global');
  const guardian = c.env.ACCURACY_GUARDIAN.get(guardianId);

  const status = c.req.query('status') || 'pending';
  const ruleId = c.req.query('ruleId') || '';

  return guardian.fetch(
    new Request(`http://internal/queue?status=${status}&ruleId=${ruleId}`)
  );
});

app.post('/corrections/approve', async (c) => {
  const guardianId = c.env.ACCURACY_GUARDIAN.idFromName('global');
  const guardian = c.env.ACCURACY_GUARDIAN.get(guardianId);

  return guardian.fetch(
    new Request('http://internal/corrections/approve', {
      method: 'POST',
      body: JSON.stringify(await c.req.json()),
    })
  );
});

app.post('/corrections/apply', async (c) => {
  const guardianId = c.env.ACCURACY_GUARDIAN.idFromName('global');
  const guardian = c.env.ACCURACY_GUARDIAN.get(guardianId);

  return guardian.fetch(new Request('http://internal/corrections/bulk-apply'));
});

app.get('/corrections/scan-errors', async (c) => {
  const guardianId = c.env.ACCURACY_GUARDIAN.idFromName('global');
  const guardian = c.env.ACCURACY_GUARDIAN.get(guardianId);

  return guardian.fetch(new Request('http://internal/scan/errors'));
});

// ============================================
// AUTHORITY QUERIES
// ============================================

app.get('/authority/:entityId', async (c) => {
  const { entityId } = c.req.param();
  const asOfDate = c.req.query('asOfDate') || new Date().toISOString().slice(0, 10);

  // Get direct authority grants
  const direct = await c.env.DB.prepare(
    `SELECT ag.*,
            g.name as grantor_name, g.entity_type as grantor_type,
            e.name as grantee_name, e.entity_type as grantee_type,
            d.file_name as source_document
     FROM authority_grants ag
     JOIN entities g ON ag.grantor_entity_id = g.id
     JOIN entities e ON ag.grantee_entity_id = e.id
     JOIN documents d ON ag.document_id = d.id
     WHERE (ag.grantor_entity_id = ? OR ag.grantee_entity_id = ?)
       AND ag.is_active = 1
       AND (ag.effective_date IS NULL OR ag.effective_date <= ?)
       AND (ag.expiration_date IS NULL OR ag.expiration_date > ?)`
  ).bind(entityId, entityId, asOfDate, asOfDate).all();

  // Get authority chain (who can act on behalf of this entity)
  const chain = await c.env.DB.prepare(
    `WITH RECURSIVE authority_chain AS (
      SELECT ag.*, 0 as depth
      FROM authority_grants ag
      WHERE ag.grantor_entity_id = ? AND ag.is_active = 1

      UNION ALL

      SELECT ag.*, ac.depth + 1
      FROM authority_grants ag
      JOIN authority_chain ac ON ag.grantor_entity_id = ac.grantee_entity_id
      WHERE ag.is_active = 1 AND ac.depth < 5
    )
    SELECT ac.*,
           g.name as grantor_name,
           e.name as grantee_name
    FROM authority_chain ac
    JOIN entities g ON ac.grantor_entity_id = g.id
    JOIN entities e ON ac.grantee_entity_id = e.id
    ORDER BY ac.depth`
  ).bind(entityId).all();

  return c.json({
    entityId,
    asOfDate,
    directGrants: direct.results,
    authorityChain: chain.results,
  });
});

app.get('/authority/expiring', async (c) => {
  const days = parseInt(c.req.query('days') || '30');

  const expiring = await c.env.DB.prepare(
    `SELECT ag.*,
            g.name as grantor_name,
            e.name as grantee_name,
            d.file_name as source_document,
            julianday(ag.expiration_date) - julianday('now') as days_remaining
     FROM authority_grants ag
     JOIN entities g ON ag.grantor_entity_id = g.id
     JOIN entities e ON ag.grantee_entity_id = e.id
     JOIN documents d ON ag.document_id = d.id
     WHERE ag.is_active = 1
       AND ag.expiration_date IS NOT NULL
       AND ag.expiration_date <= date('now', '+' || ? || ' days')
     ORDER BY ag.expiration_date`
  ).bind(days).all();

  return c.json({
    expiringWithinDays: days,
    count: expiring.results.length,
    authorities: expiring.results,
  });
});

// ============================================
// REVIEW QUEUE
// ============================================

app.get('/reviews', async (c) => {
  const status = c.req.query('status') || 'pending';
  const type = c.req.query('type');
  const limit = parseInt(c.req.query('limit') || '50');

  let query = `SELECT * FROM review_queue WHERE status = ?`;
  const params: any[] = [status];

  if (type) {
    query += ` AND review_type = ?`;
    params.push(type);
  }

  query += ` ORDER BY priority DESC, created_at LIMIT ?`;
  params.push(limit);

  const reviews = await c.env.DB.prepare(query).bind(...params).all();
  return c.json(reviews.results);
});

// ============================================
// ENTITIES
// ============================================

app.get('/entities', async (c) => {
  const type = c.req.query('type');
  const search = c.req.query('search');
  const limit = parseInt(c.req.query('limit') || '50');

  let query = `SELECT e.*, COUNT(de.document_id) as document_count
               FROM entities e
               LEFT JOIN document_entities de ON e.id = de.entity_id
               WHERE e.merged_into IS NULL`;
  const params: any[] = [];

  if (type) {
    query += ` AND e.entity_type = ?`;
    params.push(type);
  }

  if (search) {
    query += ` AND e.name LIKE ?`;
    params.push(`%${search}%`);
  }

  query += ` GROUP BY e.id ORDER BY document_count DESC LIMIT ?`;
  params.push(limit);

  const entities = await c.env.DB.prepare(query).bind(...params).all();
  return c.json(entities.results);
});

app.get('/entities/:id', async (c) => {
  const { id } = c.req.param();

  const entity = await c.env.DB.prepare(
    `SELECT * FROM entities WHERE id = ?`
  ).bind(id).first();

  if (!entity) {
    return c.json({ error: 'Entity not found' }, 404);
  }

  const documents = await c.env.DB.prepare(
    `SELECT d.*, de.role
     FROM documents d
     JOIN document_entities de ON d.id = de.document_id
     WHERE de.entity_id = ?
     ORDER BY d.created_at DESC`
  ).bind(id).all();

  const authorities = await c.env.DB.prepare(
    `SELECT ag.*,
            CASE WHEN ag.grantor_entity_id = ? THEN 'grantor' ELSE 'grantee' END as role,
            g.name as grantor_name,
            e.name as grantee_name
     FROM authority_grants ag
     JOIN entities g ON ag.grantor_entity_id = g.id
     JOIN entities e ON ag.grantee_entity_id = e.id
     WHERE (ag.grantor_entity_id = ? OR ag.grantee_entity_id = ?)
       AND ag.is_active = 1`
  ).bind(id, id, id).all();

  return c.json({
    entity,
    documents: documents.results,
    authorities: authorities.results,
  });
});

// ============================================
// CHITTYID & CONTEXT CONSCIOUSNESS
// ============================================

// Register a new ChittyID
app.post('/chitty/register', async (c) => {
  const body = await c.req.json();
  const contextService = new ChittyContextService(c.env);

  const chittyId = await contextService.registerChittyId({
    type: body.type || 'user',
    name: body.name,
    metadata: body.metadata,
  });

  return c.json(chittyId, { status: 201 });
});

// Get ChittyID details
app.get('/chitty/:id', async (c) => {
  const { id } = c.req.param();
  const contextService = new ChittyContextService(c.env);

  const chittyId = await contextService.getChittyId(id);
  if (!chittyId) {
    return c.json({ error: 'ChittyID not found' }, 404);
  }

  return c.json(chittyId);
});

// Add attestation to ChittyID
app.post('/chitty/:id/attestations', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const contextService = new ChittyContextService(c.env);

  const attestation = await contextService.addAttestation(id, {
    issuer: body.issuer,
    claim: body.claim,
    evidence: body.evidence,
    issuedAt: new Date().toISOString(),
    expiresAt: body.expiresAt,
  });

  return c.json(attestation, { status: 201 });
});

// Start a context session
app.post('/chitty/:id/sessions', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const contextService = new ChittyContextService(c.env);

  const session = await contextService.startSession({
    chittyId: id,
    sessionType: body.sessionType,
    parentSessionId: body.parentSessionId,
    initialState: body.initialState,
    metadata: body.metadata,
  });

  return c.json(session, { status: 201 });
});

// Get session details
app.get('/sessions/:id', async (c) => {
  const { id } = c.req.param();
  const contextService = new ChittyContextService(c.env);

  const session = await contextService.getSession(id);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  return c.json(session);
});

// Update session state
app.put('/sessions/:id/state', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const contextService = new ChittyContextService(c.env);

  await contextService.updateSessionState(id, body.state);
  return c.json({ success: true });
});

// End session
app.post('/sessions/:id/end', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const contextService = new ChittyContextService(c.env);

  await contextService.endSession(id, body.finalState);
  return c.json({ success: true });
});

// Get session history for a ChittyID
app.get('/chitty/:id/sessions', async (c) => {
  const { id } = c.req.param();
  const limit = parseInt(c.req.query('limit') || '50');
  const contextService = new ChittyContextService(c.env);

  const sessions = await contextService.getSessionHistory(id, limit);
  return c.json(sessions);
});

// ============================================
// PROVENANCE
// ============================================

// Record provenance
app.post('/provenance', async (c) => {
  const body = await c.req.json();
  const contextService = new ChittyContextService(c.env);

  const record = await contextService.recordProvenance({
    entityType: body.entityType,
    entityId: body.entityId,
    action: body.action,
    chittyId: body.chittyId,
    sessionId: body.sessionId,
    previousState: body.previousState,
    newState: body.newState,
    attestations: body.attestations,
  });

  return c.json(record, { status: 201 });
});

// Get provenance chain for an entity
app.get('/provenance/:entityType/:entityId', async (c) => {
  const { entityType, entityId } = c.req.param();
  const contextService = new ChittyContextService(c.env);

  const chain = await contextService.getProvenanceChain(entityType, entityId);
  return c.json(chain);
});

// Verify provenance chain integrity
app.get('/provenance/:entityType/:entityId/verify', async (c) => {
  const { entityType, entityId } = c.req.param();
  const contextService = new ChittyContextService(c.env);

  const verification = await contextService.verifyProvenance(entityType, entityId);
  return c.json(verification);
});

// ============================================
// CAPABILITY-BASED PROVENANCE (POC)
// Demonstrates the leak-proof capability pattern
// ============================================

// Create context from request for capability invocations
function contextFromAuth(auth: AuthContext | undefined, request: Request): ChittyContext {
  const chittyId = auth?.chittyId || request.headers.get('X-Chitty-ID') || 'anonymous';

  // Trust score calculation:
  // - Test auth with explicit score: use testTrustScore (allows testing all grades)
  // - Authenticated: 75 (Grade C - can invoke general capabilities)
  // - Anonymous: 50 (Grade F - limited access)
  let trustScore = 50;
  if (auth?.isTestAuth && auth.testTrustScore !== undefined) {
    trustScore = auth.testTrustScore;
  } else if (auth?.authenticated) {
    trustScore = 75;
  }

  return createContext(chittyId, 'session', {
    trustScore,
    sessionId: request.headers.get('X-Session-ID') || crypto.randomUUID(),
    requestId: request.headers.get('X-Request-ID') || crypto.randomUUID(),
    metadata: {
      isTest: auth?.isTestAuth || request.headers.get('X-Test-Context') === 'true',
      authMethod: auth?.isTestAuth ? 'test' : auth?.authenticated ? 'authenticated' : 'anonymous',
    },
  });
}

// Verify provenance via capability (instrumented, traceable)
app.get('/v2/provenance/:entityType/:entityId/verify', async (c) => {
  const { entityType, entityId } = c.req.param();
  const auth = c.get('auth');
  const caps = createEvidenceCapabilities(c.env);
  const context = contextFromAuth(auth, c.req.raw);

  // Check if context can invoke this capability
  const accessCheck = caps.provenance.verifyProvenance.canInvoke(context);
  if (!accessCheck.allowed) {
    return c.json({
      error: 'Capability access denied',
      reason: accessCheck.reason,
      blockedBy: accessCheck.blockedBy,
      contextGrade: context.grade,
      requiredGrade: accessCheck.missingGrade,
      hint: 'Upgrade context trust level or authenticate with higher privileges',
    }, 403);
  }

  // Invoke the capability
  const result = await caps.provenance.verifyProvenance.invoke(context, {
    entityType,
    entityId,
  });

  if (isFailure(result)) {
    return c.json({
      error: 'Capability invocation failed',
      message: result.error,
      errorCode: result.errorCode,
      provenance: result.provenance,
      recoverable: result.recoverable,
    }, result.errorCode === 'ACCESS_DENIED' ? 403 : 500);
  }

  // Return result with provenance
  return c.json({
    result: result.value,
    provenance: result.provenance,
    metrics: caps.provenance.verifyProvenance.getMetrics(),
  });
});

// Record provenance via capability
app.post('/v2/provenance', async (c) => {
  const body = await c.req.json();
  const auth = c.get('auth');
  const caps = createEvidenceCapabilities(c.env);
  const context = contextFromAuth(auth, c.req.raw);

  const result = await caps.provenance.recordProvenance.invoke(context, {
    entityType: body.entityType,
    entityId: body.entityId,
    action: body.action,
    previousState: body.previousState,
    newState: body.newState,
    sessionId: body.sessionId,
    attestations: body.attestations,
  });

  if (isFailure(result)) {
    return c.json({
      error: 'Capability invocation failed',
      message: result.error,
      errorCode: result.errorCode,
      provenance: result.provenance,
    }, result.errorCode === 'ACCESS_DENIED' ? 403 : 500);
  }

  return c.json({
    result: result.value,
    provenance: result.provenance,
  }, 201);
});

// Certify provenance - demonstrates REQUIRED upstream provenance
app.post('/v2/provenance/:entityType/:entityId/certify', async (c) => {
  const { entityType, entityId } = c.req.param();
  const body = await c.req.json();
  const auth = c.get('auth');
  const caps = createEvidenceCapabilities(c.env);
  const context = contextFromAuth(auth, c.req.raw);

  // First, verify the provenance chain (this produces required upstream result)
  const verifyResult = await caps.provenance.verifyProvenance.invoke(context, {
    entityType,
    entityId,
  });

  if (isFailure(verifyResult)) {
    return c.json({
      error: 'Cannot certify: verification failed',
      verificationError: verifyResult.error,
      provenance: verifyResult.provenance,
    }, 400);
  }

  // Now certify - note: the input REQUIRES CapabilityResult, not raw data
  // This is the key anti-bypass mechanism
  const certifyResult = await caps.provenance.certifyProvenance.invoke(
    context,
    {
      verificationResult: verifyResult,  // Must be CapabilityResult, not raw data
      certifierNotes: body.notes,
    },
    [verifyResult.provenance]  // Parent provenance chain
  );

  if (isFailure(certifyResult)) {
    return c.json({
      error: 'Certification failed',
      message: certifyResult.error,
      errorCode: certifyResult.errorCode,
      provenance: certifyResult.provenance,
    }, certifyResult.errorCode === 'ACCESS_DENIED' ? 403 : 400);
  }

  return c.json({
    certification: certifyResult.value,
    provenance: certifyResult.provenance,
    upstreamProvenance: [verifyResult.provenance],
  }, 201);
});

// Get capability metrics (persisted)
app.get('/v2/capabilities/metrics', async (c) => {
  const caps = createEvidenceCapabilities(c.env);

  // Get persisted metrics from D1
  const [recordProvenance, getProvenanceChain, verifyProvenance, certifyProvenance] = await Promise.all([
    caps.provenance.recordProvenance.getPersistedMetrics(),
    caps.provenance.getProvenanceChain.getPersistedMetrics(),
    caps.provenance.verifyProvenance.getPersistedMetrics(),
    caps.provenance.certifyProvenance.getPersistedMetrics(),
  ]);

  return c.json({
    provenance: {
      recordProvenance,
      getProvenanceChain,
      verifyProvenance,
      certifyProvenance,
    },
  });
});

// List available capabilities and their status
app.get('/v2/capabilities', async (c) => {
  const caps = createEvidenceCapabilities(c.env);

  const describe = (cap: any) => ({
    id: cap.definition.id,
    name: cap.definition.name,
    version: cap.definition.version,
    status: cap.definition.status,
    requiredGrade: cap.definition.requiredContextGrade,
    description: cap.definition.description,
    dependencies: cap.definition.dependencies || [],
    tags: cap.definition.tags || [],
  });

  return c.json({
    domain: 'evidence',
    capabilities: {
      provenance: {
        recordProvenance: describe(caps.provenance.recordProvenance),
        getProvenanceChain: describe(caps.provenance.getProvenanceChain),
        verifyProvenance: describe(caps.provenance.verifyProvenance),
        certifyProvenance: describe(caps.provenance.certifyProvenance),
      },
    },
  });
});

// ============================================
// EXPERTISE TRACKING
// ============================================

// Get expertise profile
app.get('/chitty/:id/expertise', async (c) => {
  const { id } = c.req.param();
  const contextService = new ChittyContextService(c.env);

  const expertise = await contextService.getExpertiseProfile(id);
  return c.json(expertise);
});

// Record an action (updates expertise)
app.post('/chitty/:id/actions', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const contextService = new ChittyContextService(c.env);

  await contextService.recordAction({
    chittyId: id,
    domain: body.domain,
    action: body.action,
    success: body.success,
    competencyDemonstrated: body.competencyDemonstrated,
  });

  return c.json({ success: true });
});

// Add certification
app.post('/chitty/:id/certifications', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const contextService = new ChittyContextService(c.env);

  await contextService.addCertification(id, body.domain, {
    name: body.name,
    issuedBy: body.issuedBy,
    issuedAt: new Date().toISOString(),
    expiresAt: body.expiresAt,
    verificationUrl: body.verificationUrl,
  });

  return c.json({ success: true }, { status: 201 });
});

// ============================================
// ACCOUNTABILITY
// ============================================

// Record accountability
app.post('/accountability', async (c) => {
  const body = await c.req.json();
  const contextService = new ChittyContextService(c.env);

  const record = await contextService.recordAccountability({
    chittyId: body.chittyId,
    sessionId: body.sessionId,
    action: body.action,
    outcome: body.outcome,
    impact: body.impact,
  });

  return c.json(record, { status: 201 });
});

// Verify accountability record
app.post('/accountability/:id/verify', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const contextService = new ChittyContextService(c.env);

  await contextService.verifyAccountability(id, body.verifiedBy, body.notes);
  return c.json({ success: true });
});

// Dispute accountability record
app.post('/accountability/:id/dispute', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const contextService = new ChittyContextService(c.env);

  await contextService.disputeAccountability(id, body.disputedBy, body.reason);
  return c.json({ success: true });
});

// Resolve dispute
app.post('/accountability/:id/resolve', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const contextService = new ChittyContextService(c.env);

  await contextService.resolveDispute(id, body.resolution, body.newOutcome);
  return c.json({ success: true });
});

// Get full accountability report
app.get('/chitty/:id/accountability', async (c) => {
  const { id } = c.req.param();
  const contextService = new ChittyContextService(c.env);

  const report = await contextService.getAccountabilityReport(id);
  return c.json(report);
});

// ============================================
// LEGAL CONSTITUTION ENFORCER (CORE)
// ============================================

// Check admissibility (CORE gatekeeper)
app.post('/legal/check', async (c) => {
  const body = await c.req.json();
  const legalService = new LegalConstitutionService(c.env);

  const result = await legalService.checkAdmissibility({
    documentId: body.documentId,
    claimTypeId: body.claimTypeId,
    requestorChittyId: body.requestorChittyId,
  });

  // Return both structured result and CORE-formatted response
  return c.json({
    ...result,
    coreResponse: legalService.formatCoreResponse(result),
  });
});

// Get Legal Research Constitution
app.get('/legal/constitution', async (c) => {
  const legalService = new LegalConstitutionService(c.env);
  const constitution = await legalService.getConstitution();
  return c.json(constitution);
});

// Get claim types
app.get('/legal/claim-types', async (c) => {
  const legalService = new LegalConstitutionService(c.env);
  const claimTypes = await legalService.getClaimTypes();
  return c.json(claimTypes);
});

// Get source requirements for a claim type
app.get('/legal/claim-types/:id/sources', async (c) => {
  const { id } = c.req.param();
  const legalService = new LegalConstitutionService(c.env);
  const requirements = await legalService.getSourceRequirements(id);
  return c.json(requirements);
});

// Get approved sources
app.get('/legal/approved-sources', async (c) => {
  const legalService = new LegalConstitutionService(c.env);
  const sources = await legalService.getApprovedSources();
  return c.json(sources);
});

// Get admissibility rules
app.get('/legal/admissibility-rules', async (c) => {
  const legalService = new LegalConstitutionService(c.env);
  const rules = await legalService.getAdmissibilityRules();
  return c.json(rules);
});

// Analyze document claims
app.post('/legal/documents/:id/claims', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const legalService = new LegalConstitutionService(c.env);

  const analysis = await legalService.analyzeDocumentClaims(
    id,
    body.claimTypeId,
    body.claimText
  );

  return c.json(analysis);
});

// Get chain of custody for a document
app.get('/legal/documents/:id/custody', async (c) => {
  const { id } = c.req.param();
  const legalService = new LegalConstitutionService(c.env);
  const custody = await legalService.getCustodyChain(id);
  return c.json(custody);
});

// Add custody entry
app.post('/legal/documents/:id/custody', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const legalService = new LegalConstitutionService(c.env);

  const entryId = await legalService.addCustodyEntry({
    documentId: id,
    custodian: body.custodian,
    custodyAction: body.custodyAction,
    custodyDate: body.custodyDate || new Date().toISOString(),
    location: body.location,
    notes: body.notes,
    verificationMethod: body.verificationMethod,
  });

  return c.json({ id: entryId }, { status: 201 });
});

// Get statement of facts for a case
app.get('/legal/cases/:caseId/facts', async (c) => {
  const { caseId } = c.req.param();
  const legalService = new LegalConstitutionService(c.env);
  const facts = await legalService.getStatementOfFacts(caseId);
  return c.json(facts);
});

// Add fact entry to statement of facts
app.post('/legal/cases/:caseId/facts', async (c) => {
  const { caseId } = c.req.param();
  const body = await c.req.json();
  const legalService = new LegalConstitutionService(c.env);

  const factId = await legalService.addFactEntry({
    caseId,
    factNumber: body.factNumber,
    factDate: body.factDate,
    factText: body.factText,
    exhibitReference: body.exhibitReference,
    documentId: body.documentId,
    sourceQuote: body.sourceQuote,
  });

  return c.json({ id: factId }, { status: 201 });
});

// ============================================
// CAPABILITY ROLLOUT ENGINE
// ============================================

async function runCapabilityRolloutEngine(env: Env): Promise<void> {
  console.log('[RolloutEngine] Starting capability rollout evaluation');

  const caps = createEvidenceCapabilities(env);
  const store = caps.provenance.store;

  // List of capabilities to evaluate
  const capabilityIds = [
    'evidence.provenance.record',
    'evidence.provenance.getChain',
    'evidence.provenance.verify',
    'evidence.provenance.certify',
  ];

  for (const capabilityId of capabilityIds) {
    try {
      // Get current definition
      const def = await store.getDefinition(capabilityId);
      if (!def) {
        console.log(`[RolloutEngine] No definition for ${capabilityId}, skipping`);
        continue;
      }

      // Calculate fresh metrics
      const metrics = await store.calculateMetrics(capabilityId);

      // Persist metrics for caching
      await store.persistMetrics(metrics);

      // Evaluate rollout rules
      const evaluation = evaluateRolloutRules(def, metrics);

      if (evaluation.shouldTransition && evaluation.newStatus) {
        console.log(`[RolloutEngine] ${capabilityId}: ${def.status} -> ${evaluation.newStatus} (${evaluation.triggeredRule?.gate})`);

        // Record the transition
        await store.updateStatus(
          capabilityId,
          evaluation.newStatus,
          `Rollout rule triggered: ${evaluation.triggeredRule?.gate} threshold ${evaluation.triggeredRule?.threshold}`,
          'rollout_rule',
          evaluation.triggeredRule
        );
      } else {
        console.log(`[RolloutEngine] ${capabilityId}: no transition (${metrics.totalInvocations} invocations, ${(metrics.successRate * 100).toFixed(1)}% success)`);
      }
    } catch (err) {
      console.error(`[RolloutEngine] Error evaluating ${capabilityId}:`, err);
    }
  }

  // Cleanup old invocations
  const pruned = await store.pruneOldInvocations(90);
  if (pruned > 0) {
    console.log(`[RolloutEngine] Pruned ${pruned} old invocations`);
  }

  console.log('[RolloutEngine] Completed');
}

// ============================================
// CRON HANDLER
// ============================================

async function handleCron(event: ScheduledEvent, env: Env): Promise<void> {
  console.log(`Cron triggered: ${event.cron}`);

  switch (event.cron) {
    case '0 * * * *':
      // Hourly: Duplicate Hunter incremental scan + Capability rollout engine
      const hunterId = env.DUPLICATE_HUNTER.idFromName('global');
      const hunter = env.DUPLICATE_HUNTER.get(hunterId);
      await hunter.fetch(new Request('http://internal/scan/incremental'));
      // Run capability rollout engine
      await runCapabilityRolloutEngine(env);
      break;

    case '*/15 * * * *':
      // Every 15 min: Process approved corrections + export events
      const guardianId = env.ACCURACY_GUARDIAN.idFromName('global');
      const guardian = env.ACCURACY_GUARDIAN.get(guardianId);
      await guardian.fetch(new Request('http://internal/corrections/bulk-apply'));
      // Process export events (webhooks)
      const exportSvc = new ExportService(env);
      await exportSvc.processEvents(50);
      break;

    case '0 3 * * *':
      // Daily 3am: Scan for known error patterns
      const guardianId2 = env.ACCURACY_GUARDIAN.idFromName('global');
      const guardian2 = env.ACCURACY_GUARDIAN.get(guardianId2);
      await guardian2.fetch(new Request('http://internal/scan/errors'));
      break;

    case '0 4 * * *':
      // Daily 4am: Check expiring authorities
      await checkExpiringAuthorities(env);
      break;

    case '0 0 * * 0':
      // Weekly: Full corpus duplicate scan
      const hunterId2 = env.DUPLICATE_HUNTER.idFromName('global');
      const hunter2 = env.DUPLICATE_HUNTER.get(hunterId2);
      await hunter2.fetch(new Request('http://internal/scan/full'));
      break;
  }
}

async function checkExpiringAuthorities(env: Env): Promise<void> {
  // Find authorities expiring in 30 days that haven't been alerted
  const expiring = await env.DB.prepare(
    `SELECT ag.id, ag.document_id, ag.expiration_date,
            julianday(ag.expiration_date) - julianday('now') as days_remaining
     FROM authority_grants ag
     WHERE ag.is_active = 1
       AND ag.expiration_date IS NOT NULL
       AND ag.expiration_date <= date('now', '+30 days')
       AND NOT EXISTS (
         SELECT 1 FROM authority_alerts aa
         WHERE aa.authority_grant_id = ag.id AND aa.notified = 1
       )`
  ).all();

  for (const auth of expiring.results as any[]) {
    // Create alert
    await env.DB.prepare(
      `INSERT INTO authority_alerts
       (id, authority_grant_id, alert_type, alert_date, days_until_expiry)
       VALUES (?, ?, 'expiring', datetime('now'), ?)`
    ).bind(generateId(), auth.id, Math.floor(auth.days_remaining)).run();

    // Add to review queue
    await env.DB.prepare(
      `INSERT INTO review_queue
       (id, review_type, priority, source_table, source_id, summary, expires_at)
       VALUES (?, 'authority_conflict', ?, 'authority_alerts', ?, ?, ?)`
    ).bind(
      generateId(),
      auth.days_remaining <= 7 ? 90 : 60,
      auth.id,
      `Authority expiring in ${Math.floor(auth.days_remaining)} days`,
      auth.expiration_date
    ).run();
  }
}

// ============================================
// QUEUE HANDLERS
// ============================================

async function handleQueue(
  batch: MessageBatch<{ documentId: string; fieldPath?: string; type: string }>,
  env: Env
): Promise<void> {
  for (const message of batch.messages) {
    try {
      if (message.body.type === 'reextract') {
        // Trigger re-extraction workflow
        // This would re-run extraction for a specific field
        console.log(`Re-extract requested for ${message.body.documentId}:${message.body.fieldPath}`);
      }
      message.ack();
    } catch (error) {
      console.error('Queue message failed:', error);
      message.retry();
    }
  }
}

// ============================================
// EXPORTS
// ============================================

export default {
  fetch: app.fetch,
  scheduled: handleCron,
  queue: handleQueue,
};
