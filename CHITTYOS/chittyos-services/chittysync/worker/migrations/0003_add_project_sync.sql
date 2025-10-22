-- ChittySync - Project Sync (Tier 2) Migration
-- Version: 2.0.0
-- Created: 2025-10-18
-- Purpose: Enable singular canonical project state across sessions

-- Projects table: Maintains canonical state per Git repository
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,                      -- ChittyID for project
  project_name TEXT NOT NULL,               -- e.g. "chittyrouter", "legal/schatz"
  git_root TEXT NOT NULL UNIQUE,            -- Absolute path to Git root
  git_remote_url TEXT,                      -- Remote Git URL
  git_branch TEXT NOT NULL DEFAULT 'main',  -- Main branch name
  canonical_state TEXT,                     -- JSON array of canonical todos
  last_consolidated_at INTEGER,             -- Last consolidation timestamp
  created_at INTEGER NOT NULL,              -- Unix timestamp
  updated_at INTEGER NOT NULL,              -- Unix timestamp
  metadata TEXT                             -- JSON blob for extensibility
);

CREATE INDEX IF NOT EXISTS idx_projects_git_root ON projects(git_root);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(project_name);
CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at);

-- Project-Session mapping: Track which sessions contribute to which projects
CREATE TABLE IF NOT EXISTS project_sessions (
  project_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  branch_id TEXT,                           -- Git worktree branch
  todos_contributed INTEGER DEFAULT 0,
  last_contribution_at INTEGER,
  is_active BOOLEAN DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, session_id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_project_sessions_session ON project_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_project_sessions_active ON project_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_project_sessions_contribution ON project_sessions(last_contribution_at);

-- Add project_id to todos table for project attribution
ALTER TABLE todos ADD COLUMN project_id TEXT;
ALTER TABLE todos ADD COLUMN project_git_root TEXT;
ALTER TABLE todos ADD COLUMN project_git_branch TEXT;
ALTER TABLE todos ADD COLUMN project_git_commit TEXT;

CREATE INDEX IF NOT EXISTS idx_todos_project_id ON todos(project_id);
CREATE INDEX IF NOT EXISTS idx_todos_git_root ON todos(project_git_root);

-- Project consolidation log: Track when projects were consolidated
CREATE TABLE IF NOT EXISTS project_consolidation_log (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  sessions_merged INTEGER NOT NULL,
  todos_merged INTEGER NOT NULL,
  conflicts_detected INTEGER DEFAULT 0,
  conflicts_resolved INTEGER DEFAULT 0,
  consolidation_strategy TEXT,
  timestamp INTEGER NOT NULL,
  metadata TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_consolidation_project ON project_consolidation_log(project_id);
CREATE INDEX IF NOT EXISTS idx_consolidation_timestamp ON project_consolidation_log(timestamp);

-- Update schema_migrations if exists
INSERT INTO schema_migrations (version, applied_at)
VALUES ('0003_add_project_sync', strftime('%s', 'now'))
ON CONFLICT (version) DO NOTHING;
