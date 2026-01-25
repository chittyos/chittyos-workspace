-- ============================================
-- EDRM TERMINOLOGY MIGRATION
-- Migration: 0008_edrm_terminology
-- Aligns database terminology with EDRM standard
-- https://edrm.net/resources/frameworks-and-standards/edrm-model/
-- ============================================

-- ============================================
-- RENAME: evidence_intake_log → evidence_preservation_log
-- EDRM Stage: Preservation - formally securing documents
-- ============================================

-- Create new table with EDRM terminology
CREATE TABLE IF NOT EXISTS evidence_preservation_log (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  preservation_id TEXT NOT NULL,
  -- Backwards compatibility alias
  intake_id TEXT GENERATED ALWAYS AS (preservation_id) VIRTUAL,
  source TEXT NOT NULL,
  qualification_reason TEXT NOT NULL,
  qualification_score REAL NOT NULL,
  result_status TEXT NOT NULL,  -- 'processing', 'duplicate', 'failed'
  result_details TEXT,          -- JSON with details
  recorded_at TEXT DEFAULT (datetime('now'))
);

-- Copy data from old table (if exists and has data)
INSERT OR IGNORE INTO evidence_preservation_log (id, submission_id, preservation_id, source, qualification_reason, qualification_score, result_status, result_details, recorded_at)
SELECT id, submission_id, intake_id, source, qualification_reason, qualification_score, result_status, result_details, recorded_at
FROM evidence_intake_log;

-- Create indexes on new table
CREATE INDEX IF NOT EXISTS idx_evidence_preservation_log_submission ON evidence_preservation_log(submission_id);
CREATE INDEX IF NOT EXISTS idx_evidence_preservation_log_preservation ON evidence_preservation_log(preservation_id);
CREATE INDEX IF NOT EXISTS idx_evidence_preservation_log_source ON evidence_preservation_log(source);
CREATE INDEX IF NOT EXISTS idx_evidence_preservation_log_status ON evidence_preservation_log(result_status);
CREATE INDEX IF NOT EXISTS idx_evidence_preservation_log_recorded ON evidence_preservation_log(recorded_at);

-- Create view for backwards compatibility
CREATE VIEW IF NOT EXISTS evidence_intake_log_view AS
SELECT
  id,
  submission_id,
  preservation_id AS intake_id,
  source,
  qualification_reason,
  qualification_score,
  result_status,
  result_details,
  recorded_at
FROM evidence_preservation_log;

-- Note: Cannot drop old table until all code is migrated
-- DROP TABLE IF EXISTS evidence_intake_log;

-- ============================================
-- ADD EDRM METADATA COLUMNS
-- ============================================

-- Add EDRM stage tracking to documents
-- SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we use a workaround
-- This will fail silently if columns already exist

-- Track EDRM stage progression
-- collection → culling → preservation → processing → review → analysis → production
