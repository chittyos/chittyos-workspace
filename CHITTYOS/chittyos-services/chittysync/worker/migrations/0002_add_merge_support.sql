-- ChittyOS Todo Sync Hub - Phase 2.1 Merge Support
-- Version: 2.0.0
-- Migration: 0002
-- Description: Add tables for Git-like merge support with branches, commits, and conflicts

-- ============================================================================
-- BRANCHES TABLE
-- Tracks platform/session branches (like Git branches)
-- ============================================================================
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,                      -- Branch ID (e.g., "claude-code-session-abc")
  name TEXT NOT NULL,                       -- Human-readable name
  platform TEXT NOT NULL,                   -- claude-code, chatgpt, desktop
  session_id TEXT,                          -- Session identifier
  head_commit_id TEXT,                      -- ChittyID of latest commit
  created_at INTEGER NOT NULL,              -- Unix timestamp
  updated_at INTEGER NOT NULL,              -- Unix timestamp
  metadata TEXT                             -- JSON blob for extensibility
);

CREATE INDEX IF NOT EXISTS idx_branches_platform ON branches(platform);
CREATE INDEX IF NOT EXISTS idx_branches_session ON branches(session_id);
CREATE INDEX IF NOT EXISTS idx_branches_updated_at ON branches(updated_at);

-- ============================================================================
-- COMMITS TABLE
-- Event sourcing for all todo operations (like Git commits)
-- ============================================================================
CREATE TABLE IF NOT EXISTS commits (
  id TEXT PRIMARY KEY,                      -- ChittyID of commit
  branch_id TEXT NOT NULL,                  -- Branch this commit belongs to
  parent_commit_id TEXT,                    -- Parent commit (null for initial)
  merge_parent_commit_id TEXT,              -- Second parent for merge commits
  todo_snapshot TEXT NOT NULL,              -- JSON snapshot of todo state
  message TEXT,                             -- Commit message
  author TEXT NOT NULL,                     -- Platform that created commit
  timestamp INTEGER NOT NULL,               -- Unix timestamp
  vector_clock TEXT,                        -- Serialized vector clock
  metadata TEXT,                            -- JSON blob
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

CREATE INDEX IF NOT EXISTS idx_commits_branch ON commits(branch_id);
CREATE INDEX IF NOT EXISTS idx_commits_parent ON commits(parent_commit_id);
CREATE INDEX IF NOT EXISTS idx_commits_timestamp ON commits(timestamp);
CREATE INDEX IF NOT EXISTS idx_commits_author ON commits(author);

-- ============================================================================
-- CONFLICTS TABLE
-- Records unresolved and resolved conflicts
-- ============================================================================
CREATE TABLE IF NOT EXISTS conflicts (
  id TEXT PRIMARY KEY,                      -- Conflict ID
  todo_id TEXT NOT NULL,                    -- Todo involved in conflict
  base_version TEXT,                        -- JSON of base version
  local_version TEXT NOT NULL,              -- JSON of local version
  remote_version TEXT NOT NULL,             -- JSON of remote version
  conflict_type TEXT NOT NULL,              -- content_diff, status_diff, etc.
  detected_at INTEGER NOT NULL,             -- Unix timestamp
  resolved_at INTEGER,                      -- Unix timestamp when resolved
  resolution_strategy TEXT,                 -- Strategy used to resolve
  resolved_by TEXT,                         -- Platform/user that resolved
  metadata TEXT,                            -- JSON blob
  FOREIGN KEY (todo_id) REFERENCES todos(id)
);

CREATE INDEX IF NOT EXISTS idx_conflicts_todo ON conflicts(todo_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_detected ON conflicts(detected_at);
CREATE INDEX IF NOT EXISTS idx_conflicts_resolved ON conflicts(resolved_at);
CREATE INDEX IF NOT EXISTS idx_conflicts_unresolved ON conflicts(resolved_at) WHERE resolved_at IS NULL;

-- ============================================================================
-- VECTOR_CLOCKS TABLE
-- Causality tracking per todo per platform
-- ============================================================================
CREATE TABLE IF NOT EXISTS vector_clocks (
  todo_id TEXT NOT NULL,                    -- Todo ID
  platform TEXT NOT NULL,                   -- Platform identifier
  clock_value INTEGER NOT NULL,             -- Logical clock value
  updated_at INTEGER NOT NULL,              -- Unix timestamp
  PRIMARY KEY (todo_id, platform),
  FOREIGN KEY (todo_id) REFERENCES todos(id)
);

CREATE INDEX IF NOT EXISTS idx_vector_clocks_todo ON vector_clocks(todo_id);
CREATE INDEX IF NOT EXISTS idx_vector_clocks_updated ON vector_clocks(updated_at);

-- ============================================================================
-- ALTER EXISTING TABLES
-- Add vector clock support to todos table
-- ============================================================================
-- Note: D1 doesn't support ALTER TABLE ADD COLUMN directly, so we use a conditional approach
-- The vector_clock field will be added to metadata JSON in the application layer for Phase 2.1
-- Full schema migration will be in Phase 2.6

-- Add comment to todos table to indicate vector clock location
-- Vector clocks stored in: metadata.vectorClock (JSON field)

-- ============================================================================
-- MIGRATION METADATA
-- Track migration history
-- ============================================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,                 -- Migration version
  name TEXT NOT NULL,                       -- Migration name
  applied_at INTEGER NOT NULL,              -- Unix timestamp
  checksum TEXT                             -- SHA-256 of migration file
);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES ('0002', 'add_merge_support', strftime('%s', 'now') * 1000);
