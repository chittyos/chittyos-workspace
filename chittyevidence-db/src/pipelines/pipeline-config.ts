// ============================================
// CHITTYEVIDENCE PIPELINE CONFIGURATION
// Canonical URI: chittycanon://evidence/pipeline/config
// Defines the Cloudflare Pipelines setup
// Schema Registry: chittycanon://schema/evidence/*
//
// TERMINOLOGY: EDRM (Electronic Discovery Reference Model)
// Industry standard for legal evidence processing
// https://edrm.net/resources/frameworks-and-standards/edrm-model/
// ============================================

/**
 * Pipeline Architecture (EDRM-Aligned):
 *
 * EDRM Stages: Collection → Processing → Preservation → Review → Analysis → Production
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  COLLECTION STREAM                                              │
 * │  (chittyevidence-consideration)                                 │
 * │  EDRM Stage: Collection                                         │
 * │  Purpose: Gathering potentially relevant documents              │
 * │  Receives: POST /collect                                        │
 * │  Schema: chittycanon://schema/evidence/pipeline/collection      │
 * └───────────────────────────────┬─────────────────────────────────┘
 *                                 │
 *                                 ▼
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  CULLING PIPELINE                                               │
 * │  (chittyevidence-prefilter)                                     │
 * │  EDRM Stage: Processing (Culling sub-stage)                     │
 * │  Purpose: Filtering, deduping, validating                       │
 * │  Transform: Worker (PreFilterService)                           │
 * │  Routes to: PRESERVATION_STREAM or ARCHIVE (R2)                 │
 * └───────────────────────────────┬─────────────────────────────────┘
 *                                 │
 *              ┌──────────────────┴──────────────────┐
 *              ▼                                     ▼
 * ┌────────────────────────────┐    ┌────────────────────────────────┐
 * │  PRESERVATION STREAM       │    │  ARCHIVE SINK (R2)             │
 * │  (chittyevidence-intake)   │    │  /archive/{date}/{id}.json     │
 * │  EDRM Stage: Preservation  │    │  Rejected with reasoning       │
 * │  Purpose: Securing with    │    └────────────────────────────────┘
 * │  chain of custody          │
 * │  Schema: chittycanon://    │
 * │  schema/evidence/pipeline/ │
 * │  preservation              │
 * └─────────────┬──────────────┘
 *               │
 *               ▼
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  PROCESSING PIPELINE                                            │
 * │  (chittyevidence-intake-processor)                              │
 * │  EDRM Stage: Processing (Extraction sub-stage)                  │
 * │  Transform: Worker (IntakeWorker)                               │
 * │  Action: Fetch file → Upload to R2 → Trigger Workflow           │
 * └─────────────────────────────────────────────────────────────────┘
 *
 *
 * Setup Commands (run in order):
 *
 * STEP 0: Generate schema files from ChittySchema (schemas stored centrally)
 *    npx ts-node scripts/export-pipeline-schemas.ts
 *
 * 1. Create consideration stream:
 *    npx wrangler pipelines streams create chittyevidence-consideration \
 *      --schema-file dist/schemas/consideration.json
 *
 * 2. Create intake stream:
 *    npx wrangler pipelines streams create chittyevidence-intake \
 *      --schema-file dist/schemas/intake.json
 *
 * 3. Create pre-filter pipeline (consideration → intake):
 *    npx wrangler pipelines create chittyevidence-prefilter \
 *      --source-stream chittyevidence-consideration \
 *      --worker-transform src/pipelines/pre-filter-transform.ts
 *
 * 4. Create intake pipeline (intake → workflow trigger):
 *    npx wrangler pipelines create chittyevidence-intake-processor \
 *      --source-stream chittyevidence-intake \
 *      --worker-transform src/pipelines/intake-transform.ts
 */

/**
 * Pipeline configuration (populated after creation)
 *
 * Cloudflare Pipelines Architecture:
 * - Stream: Durable buffered queue for receiving events (input)
 * - Pipeline: SQL transformations on data (processing)
 * - Sink: Destination like R2, Parquet, Iceberg (output)
 *
 * EDRM Terminology Mapping:
 * - Collection = gathering potentially relevant documents
 * - Culling = filtering/deduping (part of Processing stage)
 * - Preservation = securing with chain of custody
 * - Processing = extraction, transformation (workflow stage)
 */
export const PIPELINE_CONFIG = {
  // Input Streams (EDRM-aligned, configured via wrangler.toml [[pipelines]] bindings)
  collectionPipelineName: 'chittyevidence-consideration',   // EDRM: Collection
  preservationPipelineName: 'chittyevidence-intake',        // EDRM: Preservation

  // Transform Pipelines (EDRM-aligned)
  cullingPipelineName: 'chittyevidence-prefilter',          // EDRM: Processing/Culling
  extractionPipelineName: 'chittyevidence-intake-processor', // EDRM: Processing/Extraction

  // Sinks
  archiveBucket: 'chittyevidence-processed',
  archivePrefix: 'archive/',

  // Thresholds
  qualificationScoreThreshold: 0.3, // Minimum score to qualify
  autoProcessThreshold: 0.8, // Score for immediate processing
  urgentPriorityThreshold: 85, // Priority level for urgent processing
};

/**
 * Source types and their default priorities
 */
export const SOURCE_PRIORITIES: Record<string, number> = {
  court_filing: 90,
  client_portal: 80,
  email_watch: 50,
  gdrive_sync: 40,
  api: 30,
  manual: 20,
};

/**
 * Document types considered legally relevant
 */
export const RELEVANT_DOC_TYPES = [
  // Court documents
  'motion', 'brief', 'order', 'complaint', 'answer', 'discovery',
  'subpoena', 'summons', 'notice', 'judgment', 'ruling', 'opinion',

  // Evidence
  'affidavit', 'declaration', 'exhibit', 'deposition', 'transcript',

  // Legal instruments
  'contract', 'agreement', 'deed', 'poa', 'trust', 'will', 'lease',

  // Corporate
  'articles', 'bylaws', 'resolution', 'minutes', 'certificate',

  // Financial
  'statement', 'invoice', 'receipt', 'ledger', 'tax_return',
];

/**
 * Validation rules for consideration events
 */
export const VALIDATION_RULES = {
  maxFileSizeMB: 100,
  allowedMimeTypes: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/tiff',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  maxHintsPerSubmission: 10,
  maxTagsPerHint: 20,
  maxEntityNamesPerHint: 50,
};
