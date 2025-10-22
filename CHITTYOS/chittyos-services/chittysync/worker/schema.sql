-- ChittyOS Todo Sync Hub Database Schema
-- Version: 1.0.0
-- Created: 2025-10-11

-- Main todos table
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,                      -- ChittyID from id.chitty.cc
  content TEXT NOT NULL,                    -- Todo description
  status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'completed')),
  active_form TEXT,                         -- Present continuous form
  platform TEXT NOT NULL,                   -- claude-code, chatgpt, desktop, custom
  session_id TEXT,                          -- Original session ID
  agent_id TEXT,                            -- Original agent ID
  created_at INTEGER NOT NULL,              -- Unix timestamp
  updated_at INTEGER NOT NULL,              -- Unix timestamp
  deleted_at INTEGER,                       -- Soft delete timestamp
  metadata TEXT                             -- JSON blob for extensibility
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_updated_at ON todos(updated_at);
CREATE INDEX IF NOT EXISTS idx_platform ON todos(platform);
CREATE INDEX IF NOT EXISTS idx_status ON todos(status);
CREATE INDEX IF NOT EXISTS idx_deleted_at ON todos(deleted_at);
CREATE INDEX IF NOT EXISTS idx_session_id ON todos(session_id);

-- Sync log table for audit trail
CREATE TABLE IF NOT EXISTS sync_log (
  id TEXT PRIMARY KEY,                      -- Unique sync log ID
  todo_id TEXT NOT NULL,                    -- Reference to todos.id
  action TEXT NOT NULL,                     -- create, update, delete, sync
  platform TEXT NOT NULL,                   -- Platform that triggered action
  timestamp INTEGER NOT NULL,               -- Unix timestamp
  conflict_detected BOOLEAN DEFAULT FALSE,  -- Whether conflict was detected
  conflict_resolution TEXT,                 -- How conflict was resolved
  metadata TEXT,                            -- Additional metadata
  FOREIGN KEY (todo_id) REFERENCES todos(id)
);

-- Index for sync log queries
CREATE INDEX IF NOT EXISTS idx_sync_timestamp ON sync_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_sync_todo_id ON sync_log(todo_id);
CREATE INDEX IF NOT EXISTS idx_sync_platform ON sync_log(platform);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts ON sync_log(conflict_detected);

-- Agent directions: queue of instructions/tasks from Claude Code to agents
CREATE TABLE IF NOT EXISTS agent_directions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  session_id TEXT,
  source TEXT NOT NULL,                     -- claude-code, chatgpt, etc.
  content TEXT NOT NULL,
  type TEXT NOT NULL,                       -- instruction | task | message
  status TEXT NOT NULL,                     -- queued | in_progress | completed | failed
  priority INTEGER DEFAULT 0,
  result TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  claimed_at INTEGER,
  completed_at INTEGER,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_directions_agent_status
  ON agent_directions(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_directions_created
  ON agent_directions(created_at);
