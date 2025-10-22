-- ChittyOS Todo Sync Hub - Phase 2.2 Project Sync (Tier 2)
-- Version: 2.1.0
-- Migration: 0004
-- Description: Add tables for Project-level sync with sessions and canonical state

-- ============================================================================
-- PROJECTS TABLE
-- Tracks project directories with canonical merged state across all sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,                      -- Project identifier (e.g., "chittyrouter")
  project_path TEXT NOT NULL UNIQUE,        -- Full path to project directory
  git_root TEXT,                            -- Git repository root path
  git_branch TEXT,                          -- Default branch (e.g., "main")
  git_remote TEXT,                          -- Remote URL
  canonical_state TEXT,                     -- JSON array of merged todos from all sessions
  last_consolidated INTEGER,                -- Last consolidation timestamp
  created_at INTEGER NOT NULL,              -- Unix timestamp
  updated_at INTEGER NOT NULL,              -- Unix timestamp
  metadata TEXT                             -- JSON blob for extensibility
);

CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(project_path);
CREATE INDEX IF NOT EXISTS idx_projects_git_root ON projects(git_root);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);

-- ============================================================================
-- SESSIONS TABLE
-- Tracks working sessions (temporal dimension) with project attribution
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                      -- ChittyID for session
  session_id TEXT NOT NULL UNIQUE,          -- Session identifier (e.g., "session-abc123")
  project_id TEXT NOT NULL,                 -- Reference to projects.id
  project_path TEXT NOT NULL,               -- Full path (denormalized for queries)
  git_branch TEXT,                          -- Git branch for this session
  git_commit TEXT,                          -- Current commit hash
  platform TEXT NOT NULL,                   -- claude-code, chatgpt, desktop
  agent_id TEXT,                            -- Agent identifier
  status TEXT NOT NULL CHECK(status IN ('active', 'inactive', 'archived')),
  started_at INTEGER NOT NULL,              -- Unix timestamp
  last_active_at INTEGER NOT NULL,          -- Unix timestamp
  ended_at INTEGER,                         -- Unix timestamp (when session ends)
  metadata TEXT,                            -- JSON blob
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active_at);
CREATE INDEX IF NOT EXISTS idx_sessions_platform ON sessions(platform);
CREATE INDEX IF NOT EXISTS idx_sessions_project_status ON sessions(project_id, status);

-- ============================================================================
-- PROJECT_TODOS TABLE
-- Maps todos to projects (many-to-many since a todo may relate to multiple projects)
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_todos (
  project_id TEXT NOT NULL,                 -- Reference to projects.id
  todo_id TEXT NOT NULL,                    -- Reference to todos.id
  session_id TEXT,                          -- Session that contributed this todo
  contributed_at INTEGER NOT NULL,          -- When todo was added to project
  removed_at INTEGER,                       -- Soft delete from project
  PRIMARY KEY (project_id, todo_id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (todo_id) REFERENCES todos(id)
);

CREATE INDEX IF NOT EXISTS idx_project_todos_project ON project_todos(project_id);
CREATE INDEX IF NOT EXISTS idx_project_todos_todo ON project_todos(todo_id);
CREATE INDEX IF NOT EXISTS idx_project_todos_session ON project_todos(session_id);
CREATE INDEX IF NOT EXISTS idx_project_todos_removed ON project_todos(removed_at);

-- ============================================================================
-- SESSION_CONTRIBUTIONS TABLE
-- Track which sessions contributed which todos (for attribution)
-- ============================================================================
CREATE TABLE IF NOT EXISTS session_contributions (
  session_id TEXT NOT NULL,                 -- Reference to sessions.id
  todo_id TEXT NOT NULL,                    -- Reference to todos.id
  action TEXT NOT NULL,                     -- create, update, complete, delete
  timestamp INTEGER NOT NULL,               -- Unix timestamp
  metadata TEXT,                            -- JSON blob
  PRIMARY KEY (session_id, todo_id, timestamp),
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (todo_id) REFERENCES todos(id)
);

CREATE INDEX IF NOT EXISTS idx_session_contributions_session ON session_contributions(session_id);
CREATE INDEX IF NOT EXISTS idx_session_contributions_todo ON session_contributions(todo_id);
CREATE INDEX IF NOT EXISTS idx_session_contributions_timestamp ON session_contributions(timestamp);

-- ============================================================================
-- PROJECT_GIT_COMMITS TABLE
-- Track auto-commits to project Git repositories
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_git_commits (
  id TEXT PRIMARY KEY,                      -- ChittyID for commit record
  project_id TEXT NOT NULL,                 -- Reference to projects.id
  git_commit_hash TEXT NOT NULL,            -- Git SHA hash
  commit_message TEXT NOT NULL,             -- Commit message
  todos_snapshot TEXT NOT NULL,             -- JSON snapshot of todos at commit
  committed_at INTEGER NOT NULL,            -- Unix timestamp
  metadata TEXT,                            -- JSON blob
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_project_git_commits_project ON project_git_commits(project_id);
CREATE INDEX IF NOT EXISTS idx_project_git_commits_hash ON project_git_commits(git_commit_hash);
CREATE INDEX IF NOT EXISTS idx_project_git_commits_committed ON project_git_commits(committed_at);

-- ============================================================================
-- ALTER EXISTING TABLES
-- Add project/session foreign keys to todos table
-- ============================================================================
-- Note: Metadata-based approach for Phase 2.2
-- project_id and session_id already exist in todos table
-- We'll enhance their usage with foreign key constraints in later phase

-- ============================================================================
-- MIGRATION METADATA
-- ============================================================================
INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES ('0004', 'add_project_tier', strftime('%s', 'now') * 1000);
