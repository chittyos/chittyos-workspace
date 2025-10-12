-- ChittySync Agent Memories Schema
-- Supports omnidirectional memory synchronization

-- Agent memories table
CREATE TABLE IF NOT EXISTS agent_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  metadata TEXT, -- JSON
  project_id TEXT,
  synced_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(agent_id, session_id, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_agent_memories_agent_session 
  ON agent_memories(agent_id, session_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_timestamp 
  ON agent_memories(timestamp);
CREATE INDEX IF NOT EXISTS idx_agent_memories_project 
  ON agent_memories(project_id);

-- Projects table for relevance scoring
CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  keywords TEXT NOT NULL, -- JSON array
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Insert default projects
INSERT OR IGNORE INTO projects (project_id, name, keywords) VALUES
  ('legal-bianchi', 'ARIAS v. BIANCHI Case', '["bianchi", "arias", "divorce", "2024D007847", "cook county", "circuit court"]'),
  ('legal-schatz', 'Schatz ARDC Complaint', '["schatz", "ardc", "complaint", "attorney", "professional conduct"]'),
  ('chittyos-framework', 'ChittyOS Framework', '["chittyos", "cloudflare", "workers", "durable objects", "architecture"]'),
  ('legal-guzman', 'Guzman Case', '["guzman", "divorce", "family law"]'),
  ('derail-me', 'Derail.me Platform', '["derail", "video", "streaming", "webrtc", "quad player"]'),
  ('notion-sync', 'Notion Sync Integration', '["notion", "sync", "database", "api"]'),
  ('chittymcp', 'ChittyMCP Tools', '["mcp", "model context protocol", "tools", "claude"]'),
  ('chittyrouter', 'ChittyRouter AI Gateway', '["router", "ai", "agents", "gateway", "orchestration"]');

-- Memory sync log
CREATE TABLE IF NOT EXISTS memory_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  memory_count INTEGER NOT NULL,
  top_project TEXT,
  relevance_score REAL,
  distributed_to TEXT, -- JSON array
  synced_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_memory_sync_log_agent 
  ON memory_sync_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_sync_log_timestamp 
  ON memory_sync_log(synced_at);
