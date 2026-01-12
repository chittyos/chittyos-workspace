// ============================================
// ENVIRONMENT BINDINGS
// ============================================

export interface Env {
  // Workflow
  DOCUMENT_WORKFLOW: Workflow;

  // Durable Objects
  DUPLICATE_HUNTER: DurableObjectNamespace;
  ACCURACY_GUARDIAN: DurableObjectNamespace;

  // Storage
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  PROCESSED: R2Bucket;
  VECTORIZE: VectorizeIndex;

  // AI
  AI: Ai;

  // Queues
  REPROCESS_QUEUE: Queue;
  CORRECTION_QUEUE: Queue;

  // Config
  ENVIRONMENT: string;
  AUTO_RESOLVE_CONFIDENCE_THRESHOLD: string;
  DUPLICATE_AUTO_MERGE_THRESHOLD: string;
  MAX_OCR_TIMEOUT_MS: string;
}

// ============================================
// WORKFLOW TYPES
// ============================================

export interface WorkflowInput {
  documentId: string;
  r2Key: string;
  contentHash: string;
  fileName: string;
  contentType: string;
  uploadedBy: string;
  clientId?: string;
}

export interface ProcessingState {
  documentId: string;
  r2Key: string;
  contentHash: string;
  ocrText?: string;
  documentType?: string;
  extractedData?: ExtractedDocumentData;
  entities?: EntityInfo[];
  authorityGrants?: AuthorityGrant[];
  knowledgeGaps?: RegisteredGap[];
  embeddingId?: string;
}

// ============================================
// DOCUMENT TYPES
// ============================================

export interface Document {
  id: string;
  workflow_instance_id: string;
  r2_key: string;
  content_hash: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  document_type?: string;
  ocr_text?: string;
  metadata?: string;
  processing_status: string;
  superseded_by?: string;
  supersedes?: string;
  uploaded_by?: string;
  client_id?: string;
  created_at: string;
  updated_at: string;
}

export type DocumentType =
  | 'poa_general'
  | 'poa_limited'
  | 'poa_healthcare'
  | 'poa_financial'
  | 'llc_formation'
  | 'llc_operating_agreement'
  | 'corporate_resolution'
  | 'corporate_bylaws'
  | 'financial_statement'
  | 'bank_statement'
  | 'contract'
  | 'deed'
  | 'trust'
  | 'will'
  | 'court_filing'
  | 'correspondence'
  | 'other';

// ============================================
// EXTRACTION TYPES
// ============================================

export interface ExtractedDocumentData {
  documentType: DocumentType;
  confidence: number;
  title?: string;
  effectiveDate?: string;
  expirationDate?: string;
  parties: PartyInfo[];
  keyTerms: string[];
  references: DocumentReference[];
  authorityGrants?: ExtractedAuthorityGrant[];
  unknowns?: ExtractedUnknown[];
}

export interface PartyInfo {
  name: string;
  role: string;
  identifiers?: Record<string, string>;
  confidence: number;
}

export interface DocumentReference {
  type: 'supersedes' | 'references' | 'amends';
  documentId?: string;
  description: string;
}

export interface ExtractedAuthorityGrant {
  grantorName: string;
  granteeName: string;
  authorityType: string;
  scope: Record<string, any>;
}

export interface ExtractedUnknown {
  placeholder: string;
  type: GapType;
  partialValue: string;
  contextClues: string[];
  resolutionHints: string[];
  confidence: number;
  fieldPath?: string;
  surroundingText?: string;
}

// ============================================
// ENTITY TYPES
// ============================================

export interface Entity {
  id: string;
  entity_type: EntityType;
  name: string;
  normalized_name?: string;
  identifiers?: string;
  metadata?: string;
  merged_into?: string;
  created_at: string;
  updated_at: string;
}

export type EntityType = 'person' | 'llc' | 'corporation' | 'trust' | 'partnership' | 'estate';

export interface EntityInfo {
  id: string;
  type: EntityType;
  name: string;
  role: string;
}

// ============================================
// AUTHORITY TYPES
// ============================================

export interface AuthorityGrant {
  id: string;
  document_id: string;
  grantor_entity_id: string;
  grantee_entity_id: string;
  authority_type: AuthorityType;
  scope?: string;
  effective_date?: string;
  expiration_date?: string;
  is_active: number;
  revoked_by?: string;
  created_at: string;
}

export type AuthorityType =
  | 'poa_general'
  | 'poa_limited'
  | 'poa_healthcare'
  | 'poa_financial'
  | 'corporate_officer'
  | 'corporate_director'
  | 'llc_member'
  | 'llc_manager'
  | 'trustee'
  | 'executor'
  | 'guardian';

export interface AuthorityChain {
  from: string;
  to: string;
  path: AuthorityNode[];
  totalDepth: number;
}

export interface AuthorityNode {
  entityId: string;
  entityName: string;
  entityType: string;
  grantType: string;
  documentId: string;
  effectiveDate: string | null;
  expirationDate: string | null;
}

// ============================================
// KNOWLEDGE GAPS TYPES
// ============================================

export interface KnowledgeGap {
  id: string;
  gap_type: GapType;
  fingerprint: string;
  partial_value?: string;
  context_clues?: string;
  resolution_hints?: string;
  confidence_threshold: number;
  occurrence_count: number;
  status: GapStatus;
  resolved_value?: string;
  resolved_by?: string;
  resolved_at?: string;
  resolution_confidence?: number;
  resolution_source_doc_id?: string;
  first_seen_at: string;
  last_seen_at: string;
}

export type GapType =
  | 'entity_name'
  | 'date'
  | 'amount'
  | 'address'
  | 'relationship'
  | 'authority_scope'
  | 'document_reference'
  | 'identifier';

export type GapStatus = 'open' | 'pending_review' | 'resolved' | 'unresolvable';

export interface GapOccurrence {
  id: string;
  gap_id: string;
  document_id: string;
  field_path: string;
  page_number?: number;
  bounding_box?: string;
  surrounding_text?: string;
  local_context?: string;
  extraction_confidence?: number;
  placeholder_value: string;
  created_at: string;
}

export interface GapCandidate {
  id: string;
  gap_id: string;
  candidate_value: string;
  source_type: ResolutionSourceType;
  source_document_id?: string;
  source_description?: string;
  confidence: number;
  confirmations: number;
  rejections: number;
  status: 'proposed' | 'accepted' | 'rejected';
  created_at: string;
}

export type ResolutionSourceType = 'ai_inference' | 'document_match' | 'external_api' | 'user_input';

export interface RegisteredGap {
  gapId: string;
  fingerprint: string;
  isNew: boolean;
}

export interface ResolutionSource {
  type: ResolutionSourceType;
  documentId?: string;
  description?: string;
  confidence: number;
}

export interface PropagationResult {
  gapId: string;
  resolvedValue: string;
  documentsUpdated: number;
  fieldsUpdated: number;
  entitiesCreated: number;
  authoritiesUpdated: number;
}

export interface ResolvableGap {
  gapId: string;
  gapType: GapType;
  partialValue?: string;
  proposedValue?: string;
  confidence: number;
  occurrenceCount: number;
}

// ============================================
// DUPLICATE HUNTER TYPES
// ============================================

export interface DuplicateCandidate {
  id: string;
  document_id: string;
  candidate_document_id: string;
  detection_method: DuplicateDetectionMethod;
  similarity_score: number;
  confidence: 'high' | 'medium' | 'low';
  status: DuplicateCandidateStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  auto_resolved: number;
  resolution_notes?: string;
  created_at: string;
}

export type DuplicateDetectionMethod = 'hash' | 'phash' | 'semantic' | 'metadata' | 'ocr_text';

export type DuplicateCandidateStatus = 'pending' | 'confirmed_duplicate' | 'not_duplicate' | 'merged';

export interface DuplicateMatch {
  documentId: string;
  method: DuplicateDetectionMethod;
  score: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface ScanState {
  id: string;
  type: 'full' | 'incremental' | 'post_ingest';
  lastDocumentId: string | null;
  documentsScanned: number;
  duplicatesFound: number;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
}

// ============================================
// CORRECTION TYPES
// ============================================

export interface CorrectionRule {
  id: string;
  rule_name: string;
  rule_type: CorrectionRuleType;
  description?: string;
  match_criteria: string;
  correction_type: CorrectionType;
  correction_value?: string;
  requires_approval: number;
  approved_by?: string;
  approved_at?: string;
  documents_affected: number;
  documents_corrected: number;
  status: 'draft' | 'active' | 'paused' | 'archived';
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type CorrectionRuleType =
  | 'date_extraction'
  | 'entity_name'
  | 'authority_type'
  | 'relationship'
  | 'ocr_misread'
  | 'metadata_field';

export type CorrectionType = 'replace' | 'regex' | 'ai_reextract' | 'manual_review';

export interface CorrectionQueueItem {
  id: string;
  rule_id: string;
  document_id: string;
  field_path: string;
  current_value?: string;
  proposed_value?: string;
  status: 'pending' | 'approved' | 'applied' | 'rejected' | 'skipped';
  confidence?: number;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  applied_at?: string;
  rollback_value?: string;
  created_at: string;
}

export interface MatchCriteria {
  documentType?: DocumentType;
  dateRange?: [string, string];
  entityName?: string;
  field: string;
  metadataPattern?: { path: string; value?: string };
}

// ============================================
// REVIEW QUEUE TYPES
// ============================================

export interface ReviewQueueItem {
  id: string;
  review_type: 'duplicate' | 'correction' | 'authority_conflict' | 'gap_resolution';
  priority: number;
  source_table: string;
  source_id: string;
  summary?: string;
  context?: string;
  assigned_to?: string;
  assigned_at?: string;
  status: 'pending' | 'in_review' | 'resolved' | 'escalated';
  resolution?: string;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  expires_at?: string;
}

// ============================================
// API TYPES
// ============================================

export interface UploadResponse {
  status: 'processing' | 'duplicate';
  documentId?: string;
  workflowInstanceId?: string;
  existingDocumentId?: string;
  message: string;
}

export interface SearchRequest {
  query: string;
  documentType?: DocumentType;
  entityId?: string;
  dateRange?: [string, string];
  limit?: number;
}

export interface SearchResult {
  documentId: string;
  score: number;
  document: Document;
  entities: EntityInfo[];
  highlights?: string[];
}

export interface AuthorityQueryRequest {
  entityId: string;
  asOfDate?: string;
  authorityType?: AuthorityType;
}
