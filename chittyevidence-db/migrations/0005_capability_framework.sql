-- ============================================
-- CAPABILITY FRAMEWORK TABLES
-- Domain-local storage for capability invocations and metrics
-- Each Chemist owns its own capability state
-- ============================================

-- Capability definitions (cached from code, for querying)
CREATE TABLE IF NOT EXISTS capability_definitions (
    id TEXT PRIMARY KEY,                      -- 'evidence.provenance.verify'
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    domain TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'experimental',  -- experimental, limited, general, deprecated, quarantined
    required_grade TEXT NOT NULL DEFAULT 'C',
    dependencies TEXT,                        -- JSON array of capability IDs
    rollout_rules TEXT,                       -- JSON array of RolloutRule
    tags TEXT,                                -- JSON array
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Capability invocations (the audit trail)
CREATE TABLE IF NOT EXISTS capability_invocations (
    invocation_id TEXT PRIMARY KEY,
    capability_id TEXT NOT NULL,
    capability_version TEXT NOT NULL,
    context_id TEXT NOT NULL,
    chitty_id TEXT NOT NULL,
    status TEXT NOT NULL,                     -- capability status at time of invocation
    timestamp TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    success INTEGER NOT NULL,                 -- 0 or 1
    error_code TEXT,
    input_hash TEXT NOT NULL,
    output_hash TEXT,
    parent_invocations TEXT,                  -- JSON array of parent invocation IDs
    created_at TEXT DEFAULT (datetime('now'))
);

-- Capability status history (for audit and rollback)
CREATE TABLE IF NOT EXISTS capability_status_history (
    id TEXT PRIMARY KEY,
    capability_id TEXT NOT NULL,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    reason TEXT NOT NULL,
    triggered_by TEXT NOT NULL,               -- rollout_rule, manual, incident
    triggered_rule TEXT,                      -- JSON of the rule that triggered this
    timestamp TEXT DEFAULT (datetime('now'))
);

-- Aggregated metrics (updated by cron, used for fast queries)
CREATE TABLE IF NOT EXISTS capability_metrics (
    capability_id TEXT PRIMARY KEY,
    window_hours INTEGER NOT NULL DEFAULT 168,  -- 7 days
    total_invocations INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 0,
    avg_duration_ms REAL DEFAULT 0,
    unique_contexts INTEGER DEFAULT 0,
    error_breakdown TEXT,                     -- JSON object
    last_calculated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_invocations_capability ON capability_invocations(capability_id);
CREATE INDEX IF NOT EXISTS idx_invocations_timestamp ON capability_invocations(timestamp);
CREATE INDEX IF NOT EXISTS idx_invocations_success ON capability_invocations(success);
CREATE INDEX IF NOT EXISTS idx_invocations_chitty ON capability_invocations(chitty_id);
CREATE INDEX IF NOT EXISTS idx_invocations_context ON capability_invocations(context_id);
CREATE INDEX IF NOT EXISTS idx_status_history_capability ON capability_status_history(capability_id);
CREATE INDEX IF NOT EXISTS idx_status_history_timestamp ON capability_status_history(timestamp);

-- Cleanup: delete invocations older than 90 days (run via cron)
-- DELETE FROM capability_invocations WHERE timestamp < datetime('now', '-90 days');
