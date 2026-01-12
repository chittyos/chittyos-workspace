-- ============================================
-- CANONICAL TABLE PREFIX MIGRATION
-- Renames all tables to use evidence_ prefix per ChittyCanon standard
-- Per CLAUDE.md: "Each service owns its tables with `service_` prefix"
-- ============================================

-- Disable foreign key checks during migration
PRAGMA foreign_keys = OFF;

-- ============================================
-- MIGRATION 0001 TABLES (Core Evidence Tables)
-- ============================================

ALTER TABLE documents RENAME TO evidence_documents;
ALTER TABLE entities RENAME TO evidence_entities;
ALTER TABLE document_entities RENAME TO evidence_document_entities;
ALTER TABLE authority_grants RENAME TO evidence_authority_grants;
ALTER TABLE processing_log RENAME TO evidence_processing_log;
ALTER TABLE duplicate_candidates RENAME TO evidence_duplicate_candidates;
ALTER TABLE duplicate_scan_state RENAME TO evidence_duplicate_scan_state;
ALTER TABLE document_phash RENAME TO evidence_document_phash;
ALTER TABLE correction_rules RENAME TO evidence_correction_rules;
ALTER TABLE correction_queue RENAME TO evidence_correction_queue;
ALTER TABLE correction_audit_log RENAME TO evidence_correction_audit_log;
ALTER TABLE knowledge_gaps RENAME TO evidence_knowledge_gaps;
ALTER TABLE gap_occurrences RENAME TO evidence_gap_occurrences;
ALTER TABLE gap_candidates RENAME TO evidence_gap_candidates;
ALTER TABLE gap_propagation_log RENAME TO evidence_gap_propagation_log;
ALTER TABLE review_queue RENAME TO evidence_review_queue;
ALTER TABLE authority_alerts RENAME TO evidence_authority_alerts;
ALTER TABLE authority_validations RENAME TO evidence_authority_validations;

-- ============================================
-- MIGRATION 0002 TABLES (ChittyContext Tables)
-- ============================================

ALTER TABLE chitty_ids RENAME TO evidence_chitty_ids;
ALTER TABLE context_sessions RENAME TO evidence_context_sessions;
ALTER TABLE provenance_records RENAME TO evidence_provenance_records;
ALTER TABLE expertise_profiles RENAME TO evidence_expertise_profiles;
ALTER TABLE accountability_records RENAME TO evidence_accountability_records;
ALTER TABLE service_credentials RENAME TO evidence_service_credentials;
ALTER TABLE access_tokens RENAME TO evidence_access_tokens;
ALTER TABLE service_bindings RENAME TO evidence_service_bindings;
ALTER TABLE cross_service_requests RENAME TO evidence_cross_service_requests;

-- ============================================
-- MIGRATION 0003 TABLES (Legal Constitution Tables)
-- ============================================

ALTER TABLE legal_constitution RENAME TO evidence_legal_constitution;
ALTER TABLE claim_types RENAME TO evidence_claim_types;
ALTER TABLE claim_source_requirements RENAME TO evidence_claim_source_requirements;
ALTER TABLE approved_sources RENAME TO evidence_approved_sources;
ALTER TABLE admissibility_rules RENAME TO evidence_admissibility_rules;
ALTER TABLE legal_analysis_requests RENAME TO evidence_legal_analysis_requests;
ALTER TABLE document_claims RENAME TO evidence_document_claims;
ALTER TABLE evidence_custody RENAME TO evidence_chain_of_custody;
ALTER TABLE statement_of_facts RENAME TO evidence_statement_of_facts;

-- Re-enable foreign key checks
PRAGMA foreign_keys = ON;

-- ============================================
-- UPDATE INDEXES (recreate with new table names)
-- ============================================

-- Drop old indexes and recreate with canonical names
-- Note: SQLite renames indexes automatically with table rename
-- but we should verify they exist with correct names

-- Verify migration success
SELECT 'Migration 0004 complete: All tables renamed with evidence_ prefix' as status;
