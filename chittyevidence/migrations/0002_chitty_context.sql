-- ============================================
-- CHITTY CONTEXT & CONNECT TABLES
-- Migration 0002
-- ============================================

-- ============================================
-- CHITTYID REGISTRY
-- ============================================

CREATE TABLE IF NOT EXISTS chitty_ids (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('user', 'agent', 'service', 'workflow')),
    name TEXT NOT NULL,
    credentials JSON,
    metadata JSON,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- CONTEXT SESSIONS (ContextConsciousness)
-- ============================================

CREATE TABLE IF NOT EXISTS context_sessions (
    id TEXT PRIMARY KEY,
    chitty_id TEXT NOT NULL REFERENCES chitty_ids(id),
    session_type TEXT NOT NULL CHECK (session_type IN ('extraction', 'review', 'correction', 'query', 'audit')),
    started_at TEXT DEFAULT (datetime('now')),
    ended_at TEXT,
    state JSON,
    parent_session_id TEXT REFERENCES context_sessions(id),
    metadata JSON
);

-- ============================================
-- PROVENANCE CHAIN
-- ============================================

CREATE TABLE IF NOT EXISTS provenance_records (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('document', 'entity', 'authority', 'gap', 'correction')),
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    chitty_id TEXT NOT NULL REFERENCES chitty_ids(id),
    session_id TEXT REFERENCES context_sessions(id),
    previous_state_hash TEXT,
    new_state_hash TEXT NOT NULL,
    delta JSON,
    attestations JSON,
    timestamp TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- EXPERTISE TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS expertise_profiles (
    chitty_id TEXT NOT NULL REFERENCES chitty_ids(id),
    domain TEXT NOT NULL,
    total_actions INTEGER DEFAULT 0,
    successful_actions INTEGER DEFAULT 0,
    accuracy_rate REAL DEFAULT 0,
    last_active_at TEXT,
    competencies JSON,
    certifications JSON,
    PRIMARY KEY (chitty_id, domain)
);

-- ============================================
-- ACCOUNTABILITY RECORDS
-- ============================================

CREATE TABLE IF NOT EXISTS accountability_records (
    id TEXT PRIMARY KEY,
    chitty_id TEXT NOT NULL REFERENCES chitty_ids(id),
    session_id TEXT REFERENCES context_sessions(id),
    action TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure', 'pending', 'disputed')),
    impact JSON,
    verification JSON,
    dispute_info JSON,
    timestamp TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- SERVICE CREDENTIALS (ChittyConnect)
-- ============================================

CREATE TABLE IF NOT EXISTS service_credentials (
    service_id TEXT PRIMARY KEY,
    service_name TEXT NOT NULL,
    secret TEXT NOT NULL,
    public_key TEXT,
    permissions JSON,
    issued_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    revoked_at TEXT
);

-- ============================================
-- ACCESS TOKENS
-- ============================================

CREATE TABLE IF NOT EXISTS access_tokens (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    chitty_id TEXT REFERENCES chitty_ids(id),
    session_id TEXT,
    permissions JSON,
    issued_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    revoked_at TEXT
);

-- ============================================
-- SERVICE BINDINGS
-- ============================================

CREATE TABLE IF NOT EXISTS service_bindings (
    id TEXT PRIMARY KEY,
    source_service_id TEXT NOT NULL,
    target_service_id TEXT NOT NULL,
    binding_type TEXT NOT NULL CHECK (binding_type IN ('full', 'read_only', 'event_only')),
    allowed_actions JSON,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    UNIQUE(source_service_id, target_service_id)
);

-- ============================================
-- CROSS-SERVICE REQUEST LOG
-- ============================================

CREATE TABLE IF NOT EXISTS cross_service_requests (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    source_service TEXT NOT NULL,
    target_service TEXT NOT NULL,
    chitty_id TEXT,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    response_code INTEGER,
    duration_ms INTEGER,
    timestamp TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_provenance_entity ON provenance_records(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_provenance_chitty ON provenance_records(chitty_id);
CREATE INDEX IF NOT EXISTS idx_provenance_session ON provenance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_provenance_timestamp ON provenance_records(timestamp);

CREATE INDEX IF NOT EXISTS idx_sessions_chitty ON context_sessions(chitty_id);
CREATE INDEX IF NOT EXISTS idx_sessions_type ON context_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_sessions_parent ON context_sessions(parent_session_id);

CREATE INDEX IF NOT EXISTS idx_accountability_chitty ON accountability_records(chitty_id);
CREATE INDEX IF NOT EXISTS idx_accountability_outcome ON accountability_records(outcome);
CREATE INDEX IF NOT EXISTS idx_accountability_timestamp ON accountability_records(timestamp);

CREATE INDEX IF NOT EXISTS idx_tokens_chitty ON access_tokens(chitty_id);
CREATE INDEX IF NOT EXISTS idx_tokens_token ON access_tokens(token);
CREATE INDEX IF NOT EXISTS idx_tokens_expires ON access_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_requests_source ON cross_service_requests(source_service);
CREATE INDEX IF NOT EXISTS idx_requests_target ON cross_service_requests(target_service);
CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON cross_service_requests(timestamp);

-- ============================================
-- VIEWS
-- ============================================

-- Active sessions view
CREATE VIEW IF NOT EXISTS v_active_sessions AS
SELECT
    cs.*,
    ci.name as actor_name,
    ci.type as actor_type
FROM context_sessions cs
JOIN chitty_ids ci ON cs.chitty_id = ci.id
WHERE cs.ended_at IS NULL;

-- Expertise leaderboard
CREATE VIEW IF NOT EXISTS v_expertise_leaderboard AS
SELECT
    ci.id,
    ci.name,
    ci.type,
    ep.domain,
    ep.total_actions,
    ep.accuracy_rate,
    ep.last_active_at
FROM expertise_profiles ep
JOIN chitty_ids ci ON ep.chitty_id = ci.id
ORDER BY ep.accuracy_rate DESC, ep.total_actions DESC;

-- Recent accountability issues
CREATE VIEW IF NOT EXISTS v_accountability_issues AS
SELECT
    ar.*,
    ci.name as actor_name
FROM accountability_records ar
JOIN chitty_ids ci ON ar.chitty_id = ci.id
WHERE ar.outcome IN ('failure', 'disputed')
ORDER BY ar.timestamp DESC;

-- Provenance timeline
CREATE VIEW IF NOT EXISTS v_provenance_timeline AS
SELECT
    pr.*,
    ci.name as actor_name,
    ci.type as actor_type,
    cs.session_type
FROM provenance_records pr
JOIN chitty_ids ci ON pr.chitty_id = ci.id
LEFT JOIN context_sessions cs ON pr.session_id = cs.id
ORDER BY pr.timestamp DESC;
