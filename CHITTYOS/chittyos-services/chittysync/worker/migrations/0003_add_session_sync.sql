-- ChittySync Phase 2.2: Session Sync (Tier 1)
-- Migration: Add sessions table for tracking multiple sessions in same project
-- Version: 2.2.0
-- Created: 2025-10-18

-- Sessions table: Track active sessions and their project associations
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                      -- ChittyID from id.chitty.cc
  session_id TEXT NOT NULL UNIQUE,          -- Git worktree branch name (e.g., "session-abc123")
  project_id TEXT NOT NULL,                 -- Project directory identifier (hash or path-based)
  project_path TEXT NOT NULL,               -- Full absolute path to project directory
  git_branch TEXT,                          -- Git branch name if available
  git_commit TEXT,                          -- Latest commit hash
  platform TEXT NOT NULL,                   -- claude-code, chatgpt, desktop, custom
  agent_id TEXT,                            -- Agent identifier
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'archived')),
  started_at INTEGER NOT NULL,              -- Session start timestamp
  last_active_at INTEGER NOT NULL,          -- Last activity timestamp
  ended_at INTEGER,                         -- Session end timestamp
  metadata TEXT                             -- JSON blob for extensibility
);

-- Indexes for efficient session queries
CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_platform ON sessions(platform);
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active_at);

-- Composite index for finding active sessions in same project
CREATE INDEX IF NOT EXISTS idx_sessions_project_active
  ON sessions(project_id, status)
  WHERE status = 'active';

-- Session-project todos relationship
-- Tracks which todos belong to which session/project combination
CREATE TABLE IF NOT EXISTS session_todos (
  session_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  todo_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, todo_id),
  FOREIGN KEY (session_id) REFERENCES sessions(session_id),
  FOREIGN KEY (todo_id) REFERENCES todos(id)
);

-- Indexes for session_todos
CREATE INDEX IF NOT EXISTS idx_session_todos_project ON session_todos(project_id);
CREATE INDEX IF NOT EXISTS idx_session_todos_todo ON session_todos(todo_id);

-- Project canonical state
-- Maintains singular merged state per project across all sessions
CREATE TABLE IF NOT EXISTS project_states (
  project_id TEXT PRIMARY KEY,
  canonical_state TEXT NOT NULL,            -- JSON array of todos (merged from all sessions)
  last_consolidated INTEGER NOT NULL,       -- Last consolidation timestamp
  contributing_sessions TEXT,               -- JSON array of contributing session IDs
  metadata TEXT                             -- Additional project metadata
);

-- Add project_id and session_id columns to todos if not already present
-- This allows todos to be directly associated with projects and sessions
ALTER TABLE todos ADD COLUMN project_id TEXT;
ALTER TABLE todos ADD COLUMN project_git_root TEXT;
ALTER TABLE todos ADD COLUMN project_git_branch TEXT;
ALTER TABLE todos ADD COLUMN project_git_commit TEXT;

-- Indexes for project-aware todo queries
CREATE INDEX IF NOT EXISTS idx_todos_project_id ON todos(project_id);
CREATE INDEX IF NOT EXISTS idx_todos_session_project
  ON todos(session_id, project_id)
  WHERE deleted_at IS NULL;
