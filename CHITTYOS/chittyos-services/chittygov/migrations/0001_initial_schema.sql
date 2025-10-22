-- ChittyGov Service Database Schema
-- D1 SQLite database for compliance, evidence, and audit records

-- Compliance Records
CREATE TABLE IF NOT EXISTS compliance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT NOT NULL,
  standards TEXT NOT NULL,  -- JSON array of standards checked
  compliant INTEGER NOT NULL,  -- 1 = compliant, 0 = non-compliant
  timestamp TEXT NOT NULL,
  report_id TEXT,
  metadata TEXT  -- JSON metadata
);

CREATE INDEX idx_compliance_entity ON compliance_records(entity_id);
CREATE INDEX idx_compliance_timestamp ON compliance_records(timestamp);

-- Evidence Records
CREATE TABLE IF NOT EXISTS evidence_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evidence_id TEXT NOT NULL UNIQUE,  -- ChittyID (CHITTY-EVNT-*)
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata TEXT NOT NULL,  -- JSON metadata
  related_entities TEXT,  -- JSON array of related ChittyIDs
  case_id TEXT,  -- Link to legal case
  collected_at TEXT NOT NULL,
  status TEXT DEFAULT 'collected'
);

CREATE INDEX idx_evidence_id ON evidence_records(evidence_id);
CREATE INDEX idx_evidence_case ON evidence_records(case_id);
CREATE INDEX idx_evidence_collected ON evidence_records(collected_at);

-- Audit Trail
CREATE TABLE IF NOT EXISTS audit_trail (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id TEXT NOT NULL UNIQUE,  -- ChittyID (CHITTY-EVNT-*)
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,  -- ChittyID of actor
  metadata TEXT NOT NULL,  -- JSON metadata
  timestamp TEXT NOT NULL
);

CREATE INDEX idx_audit_entity ON audit_trail(entity_id);
CREATE INDEX idx_audit_timestamp ON audit_trail(timestamp);
CREATE INDEX idx_audit_actor ON audit_trail(actor);

-- Governance Reports
CREATE TABLE IF NOT EXISTS governance_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id TEXT NOT NULL UNIQUE,  -- ChittyID (CHITTY-INFO-*)
  entity_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  report_data TEXT NOT NULL,  -- JSON report data
  generated_at TEXT NOT NULL,
  generated_by TEXT NOT NULL  -- ChittyID of generator
);

CREATE INDEX idx_reports_entity ON governance_reports(entity_id);
CREATE INDEX idx_reports_generated ON governance_reports(generated_at);
