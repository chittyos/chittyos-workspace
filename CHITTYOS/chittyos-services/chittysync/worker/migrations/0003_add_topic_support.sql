-- ChittyOS Todo Sync Hub - Topic Support Migration
-- Version: 1.0.0
-- Phase: Tier 3 (Sessions → Projects → Topics)
-- Created: 2025-10-18

-- ============================================================================
-- Topics: Global topic registry
-- ============================================================================
CREATE TABLE IF NOT EXISTS topics (
  topic_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  keywords TEXT NOT NULL,                   -- JSON array of keywords
  parent_topic_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT,                            -- JSON blob for extensibility
  FOREIGN KEY (parent_topic_id) REFERENCES topics(topic_id)
);

CREATE INDEX IF NOT EXISTS idx_topics_parent ON topics(parent_topic_id);

-- ============================================================================
-- Project Topics: Many-to-many relationship between projects and topics
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_topics (
  project_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  todos_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  in_progress_count INTEGER DEFAULT 0,
  pending_count INTEGER DEFAULT 0,
  last_updated INTEGER NOT NULL,
  metadata TEXT,
  PRIMARY KEY (project_id, topic_id),
  FOREIGN KEY (topic_id) REFERENCES topics(topic_id)
);

CREATE INDEX IF NOT EXISTS idx_project_topics_project ON project_topics(project_id);
CREATE INDEX IF NOT EXISTS idx_project_topics_topic ON project_topics(topic_id);
CREATE INDEX IF NOT EXISTS idx_project_topics_updated ON project_topics(last_updated);

-- ============================================================================
-- Topic Relationships: Cross-topic relationships
-- ============================================================================
CREATE TABLE IF NOT EXISTS topic_relationships (
  topic_a_id TEXT NOT NULL,
  topic_b_id TEXT NOT NULL,
  relationship_type TEXT DEFAULT 'related',  -- 'related', 'depends_on', 'conflicts_with'
  strength REAL DEFAULT 0.5,                 -- 0.0 to 1.0
  created_at INTEGER NOT NULL,
  metadata TEXT,
  PRIMARY KEY (topic_a_id, topic_b_id),
  FOREIGN KEY (topic_a_id) REFERENCES topics(topic_id),
  FOREIGN KEY (topic_b_id) REFERENCES topics(topic_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_relationships_a ON topic_relationships(topic_a_id);
CREATE INDEX IF NOT EXISTS idx_topic_relationships_b ON topic_relationships(topic_b_id);

-- ============================================================================
-- Extend Todos Table: Add topic columns
-- ============================================================================
ALTER TABLE todos ADD COLUMN primary_topic TEXT;
ALTER TABLE todos ADD COLUMN topics TEXT;           -- JSON array of topic IDs
ALTER TABLE todos ADD COLUMN related_todos TEXT;    -- JSON array of related ChittyIDs
ALTER TABLE todos ADD COLUMN project_id TEXT;       -- Project identifier (e.g., 'chittyrouter')

CREATE INDEX IF NOT EXISTS idx_todos_primary_topic ON todos(primary_topic);
CREATE INDEX IF NOT EXISTS idx_todos_project_id ON todos(project_id);

-- Full-text search index on content for topic detection (if supported by D1)
-- Note: D1 may not support FTS5 yet, so this is aspirational
-- CREATE VIRTUAL TABLE IF NOT EXISTS todos_fts USING fts5(content, content=todos, content_rowid=rowid);

-- ============================================================================
-- Seed Default Topics
-- ============================================================================

-- Core technical topics
INSERT OR IGNORE INTO topics (topic_id, name, description, keywords, created_at, updated_at)
VALUES
  ('auth', 'Authentication', 'Authentication flows, OAuth, JWT, and token management', '["auth", "authentication", "oauth", "jwt", "token", "login", "session", "credential"]', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('id', 'Identity', 'ChittyID integration and identity management', '["chittyid", "identity", "mint", "identifier", "uuid", "id"]', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('security', 'Security', 'Security measures, encryption, and verification', '["security", "encryption", "hash", "signature", "verify", "secure", "crypto"]', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('database', 'Database', 'Database operations, queries, and schema management', '["database", "db", "sql", "query", "schema", "migration", "d1"]', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('api', 'API', 'REST APIs, endpoints, and HTTP operations', '["api", "rest", "graphql", "endpoint", "request", "response", "http"]', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('testing', 'Testing', 'Unit tests, integration tests, and test frameworks', '["test", "spec", "mock", "fixture", "assert", "jest", "vitest"]', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('deployment', 'Deployment', 'Deployment, releases, and production operations', '["deploy", "production", "staging", "release", "build", "wrangler"]', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('ui', 'User Interface', 'Frontend, UI components, and design', '["ui", "frontend", "component", "interface", "design", "ux", "react"]', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('performance', 'Performance', 'Performance optimization, caching, and speed improvements', '["performance", "optimize", "cache", "latency", "speed", "fast"]', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('ai', 'Artificial Intelligence', 'AI integration, LLM operations, and ML features', '["ai", "llm", "claude", "gpt", "openai", "model", "prompt", "ml"]', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('routing', 'Routing', 'Request routing, gateway operations, and path handling', '["route", "router", "gateway", "endpoint", "path", "routing"]', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('sync', 'Synchronization', 'Data sync, conflict resolution, and distributed systems', '["sync", "synchronization", "conflict", "merge", "distributed", "replication"]', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('music', 'Music', 'Music streaming, playlists, and audio features', '["music", "audio", "playlist", "track", "spotify", "soundcloud", "streaming"]', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('docs', 'Documentation', 'Documentation, guides, and technical writing', '["docs", "documentation", "readme", "guide", "tutorial", "manual"]', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('bug', 'Bug Fix', 'Bug fixes and issue resolution', '["bug", "fix", "issue", "error", "broken", "problem"]', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- Topic relationships (auth-related)
INSERT OR IGNORE INTO topic_relationships (topic_a_id, topic_b_id, relationship_type, strength, created_at)
VALUES
  ('auth', 'security', 'related', 0.9, strftime('%s', 'now') * 1000),
  ('auth', 'id', 'related', 0.8, strftime('%s', 'now') * 1000),
  ('auth', 'api', 'related', 0.7, strftime('%s', 'now') * 1000);

-- Topic relationships (infrastructure)
INSERT OR IGNORE INTO topic_relationships (topic_a_id, topic_b_id, relationship_type, strength, created_at)
VALUES
  ('database', 'api', 'related', 0.8, strftime('%s', 'now') * 1000),
  ('database', 'performance', 'related', 0.7, strftime('%s', 'now') * 1000),
  ('deployment', 'performance', 'related', 0.6, strftime('%s', 'now') * 1000);

-- Topic relationships (AI & routing)
INSERT OR IGNORE INTO topic_relationships (topic_a_id, topic_b_id, relationship_type, strength, created_at)
VALUES
  ('ai', 'routing', 'related', 0.9, strftime('%s', 'now') * 1000),
  ('ai', 'api', 'related', 0.7, strftime('%s', 'now') * 1000);
