-- ============================================
-- CHITTY EVIDENCE PLATFORM - COMPLETE SCHEMA
-- Version: 1.0.0
-- ============================================

-- ============================================
-- CORE DOCUMENT TABLES
-- ============================================

-- Primary document storage
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    workflow_instance_id TEXT,
    r2_key TEXT NOT NULL,
    content_hash TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    document_type TEXT,
    ocr_text TEXT,
    metadata JSON,
    processing_status TEXT DEFAULT 'pending',
    superseded_by TEXT REFERENCES documents(id),
    supersedes TEXT REFERENCES documents(id),
    uploaded_by TEXT,
    client_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Entities (people and organizations)
CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    name TEXT NOT NULL,
    normalized_name TEXT,
    identifiers JSON,
    metadata JSON,
    merged_into TEXT REFERENCES entities(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Document-entity relationships
CREATE TABLE IF NOT EXISTS document_entities (
    document_id TEXT NOT NULL REFERENCES documents(id),
    entity_id TEXT NOT NULL REFERENCES entities(id),
    role TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    source TEXT DEFAULT 'extraction',
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (document_id, entity_id, role)
);

-- Authority grants (POA, corporate authority)
CREATE TABLE IF NOT EXISTS authority_grants (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id),
    grantor_entity_id TEXT NOT NULL REFERENCES entities(id),
    grantee_entity_id TEXT NOT NULL REFERENCES entities(id),
    authority_type TEXT NOT NULL,
    scope JSON,
    effective_date TEXT,
    expiration_date TEXT,
    is_active INTEGER DEFAULT 1,
    revoked_by TEXT REFERENCES authority_grants(id),
    revocation_date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Processing audit log
CREATE TABLE IF NOT EXISTS processing_log (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id),
    workflow_instance_id TEXT,
    step_name TEXT NOT NULL,
    status TEXT NOT NULL,
    input_hash TEXT,
    output_hash TEXT,
    error_message TEXT,
    duration_ms INTEGER,
    metadata JSON,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- DUPLICATE HUNTER TABLES
-- ============================================

-- Duplicate detection results
CREATE TABLE IF NOT EXISTS duplicate_candidates (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id),
    candidate_document_id TEXT NOT NULL REFERENCES documents(id),
    detection_method TEXT NOT NULL,
    similarity_score REAL NOT NULL,
    confidence TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at TEXT,
    auto_resolved INTEGER DEFAULT 0,
    resolution_notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(document_id, candidate_document_id)
);

-- Track scan progress
CREATE TABLE IF NOT EXISTS duplicate_scan_state (
    id TEXT PRIMARY KEY,
    scan_type TEXT NOT NULL,
    last_document_id TEXT,
    documents_scanned INTEGER DEFAULT 0,
    duplicates_found INTEGER DEFAULT 0,
    started_at TEXT,
    completed_at TEXT,
    status TEXT DEFAULT 'running'
);

-- Perceptual hashes for image-based documents
CREATE TABLE IF NOT EXISTS document_phash (
    document_id TEXT PRIMARY KEY REFERENCES documents(id),
    phash_value TEXT NOT NULL,
    phash_bits BLOB,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- ACCURACY GUARDIAN TABLES
-- ============================================

-- Correction rules
CREATE TABLE IF NOT EXISTS correction_rules (
    id TEXT PRIMARY KEY,
    rule_name TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    description TEXT,
    match_criteria JSON NOT NULL,
    correction_type TEXT NOT NULL,
    correction_value JSON,
    requires_approval INTEGER DEFAULT 1,
    approved_by TEXT,
    approved_at TEXT,
    documents_affected INTEGER DEFAULT 0,
    documents_corrected INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft',
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Correction queue
CREATE TABLE IF NOT EXISTS correction_queue (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL REFERENCES correction_rules(id),
    document_id TEXT NOT NULL REFERENCES documents(id),
    field_path TEXT NOT NULL,
    current_value TEXT,
    proposed_value TEXT,
    status TEXT DEFAULT 'pending',
    confidence REAL,
    reviewed_by TEXT,
    reviewed_at TEXT,
    review_notes TEXT,
    applied_at TEXT,
    rollback_value TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(rule_id, document_id, field_path)
);

-- Correction audit log
CREATE TABLE IF NOT EXISTS correction_audit_log (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    rule_id TEXT,
    action TEXT NOT NULL,
    field_path TEXT,
    old_value TEXT,
    new_value TEXT,
    performed_by TEXT,
    performed_at TEXT DEFAULT (datetime('now')),
    metadata JSON
);

-- ============================================
-- KNOWLEDGE GAPS TABLES
-- ============================================

-- Core gap registry
CREATE TABLE IF NOT EXISTS knowledge_gaps (
    id TEXT PRIMARY KEY,
    gap_type TEXT NOT NULL,
    fingerprint TEXT NOT NULL UNIQUE,
    partial_value TEXT,
    context_clues JSON,
    resolution_hints JSON,
    confidence_threshold REAL DEFAULT 0.90,
    occurrence_count INTEGER DEFAULT 1,
    first_seen_at TEXT DEFAULT (datetime('now')),
    last_seen_at TEXT DEFAULT (datetime('now')),
    status TEXT DEFAULT 'open',
    resolved_value TEXT,
    resolved_by TEXT,
    resolved_at TEXT,
    resolution_confidence REAL,
    resolution_source_doc_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Gap occurrences (many-to-many)
CREATE TABLE IF NOT EXISTS gap_occurrences (
    id TEXT PRIMARY KEY,
    gap_id TEXT NOT NULL REFERENCES knowledge_gaps(id),
    document_id TEXT NOT NULL REFERENCES documents(id),
    field_path TEXT NOT NULL,
    page_number INTEGER,
    bounding_box JSON,
    surrounding_text TEXT,
    local_context JSON,
    extraction_confidence REAL,
    placeholder_value TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(gap_id, document_id, field_path)
);

-- Candidate resolutions
CREATE TABLE IF NOT EXISTS gap_candidates (
    id TEXT PRIMARY KEY,
    gap_id TEXT NOT NULL REFERENCES knowledge_gaps(id),
    candidate_value TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_document_id TEXT,
    source_description TEXT,
    confidence REAL NOT NULL,
    confirmations INTEGER DEFAULT 0,
    rejections INTEGER DEFAULT 0,
    status TEXT DEFAULT 'proposed',
    created_at TEXT DEFAULT (datetime('now'))
);

-- Gap propagation log
CREATE TABLE IF NOT EXISTS gap_propagation_log (
    id TEXT PRIMARY KEY,
    gap_id TEXT NOT NULL,
    resolved_value TEXT NOT NULL,
    documents_updated INTEGER,
    fields_updated INTEGER,
    entities_created INTEGER,
    authorities_updated INTEGER,
    started_at TEXT,
    completed_at TEXT,
    rollback_data JSON,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- SHARED REVIEW QUEUE
-- ============================================

CREATE TABLE IF NOT EXISTS review_queue (
    id TEXT PRIMARY KEY,
    review_type TEXT NOT NULL,
    priority INTEGER DEFAULT 50,
    source_table TEXT NOT NULL,
    source_id TEXT NOT NULL,
    summary TEXT,
    context JSON,
    assigned_to TEXT,
    assigned_at TEXT,
    status TEXT DEFAULT 'pending',
    resolution TEXT,
    resolved_by TEXT,
    resolved_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT
);

-- ============================================
-- AUTHORITY VALIDATION TABLES
-- ============================================

-- Expiring authorities tracking
CREATE TABLE IF NOT EXISTS authority_alerts (
    id TEXT PRIMARY KEY,
    authority_grant_id TEXT NOT NULL REFERENCES authority_grants(id),
    alert_type TEXT NOT NULL,
    alert_date TEXT NOT NULL,
    days_until_expiry INTEGER,
    notified INTEGER DEFAULT 0,
    notified_at TEXT,
    acknowledged INTEGER DEFAULT 0,
    acknowledged_by TEXT,
    acknowledged_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Authority validation history
CREATE TABLE IF NOT EXISTS authority_validations (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL REFERENCES entities(id),
    validation_date TEXT NOT NULL,
    validation_type TEXT NOT NULL,
    result TEXT NOT NULL,
    active_authorities INTEGER,
    expired_authorities INTEGER,
    gaps_found INTEGER,
    details JSON,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Documents
CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_client ON documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);

-- Entities
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(normalized_name);
CREATE INDEX IF NOT EXISTS idx_entities_merged ON entities(merged_into);

-- Document entities
CREATE INDEX IF NOT EXISTS idx_doc_entities_doc ON document_entities(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_entities_entity ON document_entities(entity_id);

-- Authority grants
CREATE INDEX IF NOT EXISTS idx_authority_grantor ON authority_grants(grantor_entity_id);
CREATE INDEX IF NOT EXISTS idx_authority_grantee ON authority_grants(grantee_entity_id);
CREATE INDEX IF NOT EXISTS idx_authority_active ON authority_grants(is_active);
CREATE INDEX IF NOT EXISTS idx_authority_expiry ON authority_grants(expiration_date);
CREATE INDEX IF NOT EXISTS idx_authority_type ON authority_grants(authority_type);

-- Processing log
CREATE INDEX IF NOT EXISTS idx_processing_log_doc ON processing_log(document_id);
CREATE INDEX IF NOT EXISTS idx_processing_log_workflow ON processing_log(workflow_instance_id);

-- Duplicate candidates
CREATE INDEX IF NOT EXISTS idx_dup_candidates_status ON duplicate_candidates(status);
CREATE INDEX IF NOT EXISTS idx_dup_candidates_score ON duplicate_candidates(similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_dup_candidates_doc ON duplicate_candidates(document_id);

-- Correction queue
CREATE INDEX IF NOT EXISTS idx_correction_queue_status ON correction_queue(status);
CREATE INDEX IF NOT EXISTS idx_correction_queue_rule ON correction_queue(rule_id);
CREATE INDEX IF NOT EXISTS idx_correction_queue_doc ON correction_queue(document_id);

-- Knowledge gaps
CREATE INDEX IF NOT EXISTS idx_gaps_fingerprint ON knowledge_gaps(fingerprint);
CREATE INDEX IF NOT EXISTS idx_gaps_status ON knowledge_gaps(status);
CREATE INDEX IF NOT EXISTS idx_gaps_type ON knowledge_gaps(gap_type);
CREATE INDEX IF NOT EXISTS idx_gaps_occurrences ON knowledge_gaps(occurrence_count DESC);

-- Gap occurrences
CREATE INDEX IF NOT EXISTS idx_gap_occ_gap ON gap_occurrences(gap_id);
CREATE INDEX IF NOT EXISTS idx_gap_occ_doc ON gap_occurrences(document_id);

-- Gap candidates
CREATE INDEX IF NOT EXISTS idx_gap_candidates_gap ON gap_candidates(gap_id);
CREATE INDEX IF NOT EXISTS idx_gap_candidates_conf ON gap_candidates(confidence DESC);

-- Review queue
CREATE INDEX IF NOT EXISTS idx_review_queue_priority ON review_queue(priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_review_queue_status ON review_queue(status);
CREATE INDEX IF NOT EXISTS idx_review_queue_type ON review_queue(review_type);

-- Perceptual hash
CREATE INDEX IF NOT EXISTS idx_phash ON document_phash(phash_value);

-- Authority alerts
CREATE INDEX IF NOT EXISTS idx_authority_alerts_date ON authority_alerts(alert_date);
CREATE INDEX IF NOT EXISTS idx_authority_alerts_notified ON authority_alerts(notified);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Active authorities with entity names
CREATE VIEW IF NOT EXISTS v_active_authorities AS
SELECT
    ag.*,
    g.name as grantor_name,
    g.entity_type as grantor_type,
    e.name as grantee_name,
    e.entity_type as grantee_type,
    d.file_name as source_document
FROM authority_grants ag
JOIN entities g ON ag.grantor_entity_id = g.id
JOIN entities e ON ag.grantee_entity_id = e.id
JOIN documents d ON ag.document_id = d.id
WHERE ag.is_active = 1
AND (ag.expiration_date IS NULL OR ag.expiration_date > datetime('now'));

-- Open knowledge gaps with occurrence counts
CREATE VIEW IF NOT EXISTS v_open_gaps AS
SELECT
    g.*,
    COUNT(DISTINCT o.document_id) as document_count,
    GROUP_CONCAT(DISTINCT o.document_id) as affected_documents
FROM knowledge_gaps g
LEFT JOIN gap_occurrences o ON g.id = o.gap_id
WHERE g.status = 'open'
GROUP BY g.id
ORDER BY g.occurrence_count DESC;

-- Pending reviews by priority
CREATE VIEW IF NOT EXISTS v_pending_reviews AS
SELECT
    r.*,
    CASE
        WHEN r.expires_at < datetime('now') THEN 'overdue'
        WHEN r.expires_at < datetime('now', '+1 day') THEN 'urgent'
        ELSE 'normal'
    END as urgency
FROM review_queue r
WHERE r.status = 'pending'
ORDER BY r.priority DESC, r.created_at;

-- Document processing summary
CREATE VIEW IF NOT EXISTS v_document_summary AS
SELECT
    d.id,
    d.file_name,
    d.document_type,
    d.processing_status,
    d.created_at,
    COUNT(DISTINCT de.entity_id) as entity_count,
    COUNT(DISTINCT ag.id) as authority_count,
    COUNT(DISTINCT go.gap_id) as gap_count
FROM documents d
LEFT JOIN document_entities de ON d.id = de.document_id
LEFT JOIN authority_grants ag ON d.id = ag.document_id
LEFT JOIN gap_occurrences go ON d.id = go.document_id
GROUP BY d.id;
