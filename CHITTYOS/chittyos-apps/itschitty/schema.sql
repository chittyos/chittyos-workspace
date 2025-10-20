-- MemoryCloude Database Schema
-- D1 database for It's Chitty consciousness and memory

-- Context Memory: Store user's context sessions
CREATE TABLE IF NOT EXISTS context_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  chitty_id TEXT,
  context_type TEXT NOT NULL,
  session_id TEXT NOT NULL,
  data JSON,
  summary TEXT,
  entities JSON, -- Extracted entities and relationships
  created_at INTEGER NOT NULL,
  last_accessed INTEGER NOT NULL,
  access_count INTEGER DEFAULT 1
);

CREATE INDEX idx_context_memory_user ON context_memory(user_id, context_type);
CREATE INDEX idx_context_memory_session ON context_memory(session_id);
CREATE INDEX idx_context_memory_accessed ON context_memory(last_accessed DESC);

-- Context Switches: Track context transitions for learning
CREATE TABLE IF NOT EXISTS context_switches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  from_context TEXT,
  to_context TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  preserved_data JSON,
  success BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_context_switches_user ON context_switches(user_id, timestamp DESC);
CREATE INDEX idx_context_switches_pattern ON context_switches(from_context, to_context);

-- Learning Patterns: Store learned user behaviors
CREATE TABLE IF NOT EXISTS learning_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  pattern_type TEXT NOT NULL, -- 'context_switch', 'time_based', 'sequence', 'preference'
  from_context TEXT,
  to_context TEXT,
  data JSON, -- Pattern-specific data
  confidence REAL DEFAULT 0.5, -- 0.0 to 1.0
  occurrence_count INTEGER DEFAULT 1,
  last_occurred INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_learning_patterns_user ON learning_patterns(user_id, pattern_type);
CREATE INDEX idx_learning_patterns_confidence ON learning_patterns(confidence DESC);

-- Conversation History: Full conversation logs
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  chitty_id TEXT,
  context_type TEXT NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  message TEXT NOT NULL,
  metadata JSON, -- Token count, model used, etc.
  timestamp INTEGER NOT NULL
);

CREATE INDEX idx_conversations_user ON conversations(user_id, timestamp DESC);
CREATE INDEX idx_conversations_session ON conversations(session_id);
CREATE INDEX idx_conversations_context ON conversations(context_type, timestamp DESC);

-- User Preferences: Learned and explicit preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  chitty_id TEXT,
  preference_key TEXT NOT NULL,
  preference_value TEXT NOT NULL,
  context_scope TEXT, -- NULL = global, or specific context
  source TEXT DEFAULT 'learned', -- 'learned', 'explicit', 'inferred'
  confidence REAL DEFAULT 1.0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_user_prefs_key ON user_preferences(user_id, preference_key, context_scope);
CREATE INDEX idx_user_prefs_context ON user_preferences(context_scope);

-- Relationships: Entity relationships from ChittyDNA
CREATE TABLE IF NOT EXISTS relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  entity_1_id TEXT NOT NULL,
  entity_1_type TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  entity_2_id TEXT NOT NULL,
  entity_2_type TEXT NOT NULL,
  context TEXT, -- Which contexts this relationship is relevant to
  strength REAL DEFAULT 0.5, -- 0.0 to 1.0
  metadata JSON,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_relationships_user ON relationships(user_id);
CREATE INDEX idx_relationships_entity1 ON relationships(entity_1_id, entity_1_type);
CREATE INDEX idx_relationships_entity2 ON relationships(entity_2_id, entity_2_type);
CREATE INDEX idx_relationships_context ON relationships(context);

-- Context Access Log: Track which contexts are accessed when
CREATE TABLE IF NOT EXISTS context_access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  context_type TEXT NOT NULL,
  accessed_at INTEGER NOT NULL,
  duration_seconds INTEGER,
  actions_performed JSON,
  outcome TEXT, -- 'completed', 'interrupted', 'failed'
  metadata JSON
);

CREATE INDEX idx_context_access_user ON context_access_log(user_id, accessed_at DESC);
CREATE INDEX idx_context_access_type ON context_access_log(context_type, accessed_at DESC);

-- Predictive Suggestions: Store and track suggestion performance
CREATE TABLE IF NOT EXISTS predictive_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  context_type TEXT NOT NULL,
  suggestion_text TEXT NOT NULL,
  suggestion_action JSON,
  presented_at INTEGER NOT NULL,
  accepted BOOLEAN,
  accepted_at INTEGER,
  confidence REAL DEFAULT 0.5
);

CREATE INDEX idx_suggestions_user ON predictive_suggestions(user_id, presented_at DESC);
CREATE INDEX idx_suggestions_performance ON predictive_suggestions(accepted, confidence);

-- Session State: Active session tracking
CREATE TABLE IF NOT EXISTS active_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  session_id TEXT UNIQUE NOT NULL,
  context_type TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  last_activity INTEGER NOT NULL,
  state JSON, -- Current session state
  metadata JSON
);

CREATE INDEX idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX idx_active_sessions_activity ON active_sessions(last_activity DESC);

-- Context Performance Metrics: Track how well contexts work for users
CREATE TABLE IF NOT EXISTS context_performance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  context_type TEXT NOT NULL,
  metric_date DATE NOT NULL,
  load_time_ms INTEGER,
  accuracy_score REAL, -- How accurate was context detection
  user_satisfaction REAL, -- Implicit or explicit feedback
  suggestion_acceptance_rate REAL,
  switch_success_rate REAL,
  total_uses INTEGER DEFAULT 0
);

CREATE UNIQUE INDEX idx_context_perf_unique ON context_performance(user_id, context_type, metric_date);
CREATE INDEX idx_context_perf_scores ON context_performance(accuracy_score DESC, user_satisfaction DESC);

-- Entity Mentions: Track entity references across conversations
CREATE TABLE IF NOT EXISTS entity_mentions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  context_type TEXT NOT NULL,
  mentioned_at INTEGER NOT NULL,
  mention_text TEXT,
  sentiment TEXT, -- 'positive', 'negative', 'neutral'
  importance REAL DEFAULT 0.5 -- 0.0 to 1.0
);

CREATE INDEX idx_entity_mentions_user ON entity_mentions(user_id, mentioned_at DESC);
CREATE INDEX idx_entity_mentions_entity ON entity_mentions(entity_id, entity_type);
CREATE INDEX idx_entity_mentions_context ON entity_mentions(context_type);

-- Knowledge Graph Edges: Store learned connections between concepts
CREATE TABLE IF NOT EXISTS knowledge_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  from_concept TEXT NOT NULL,
  to_concept TEXT NOT NULL,
  edge_type TEXT NOT NULL, -- 'leads_to', 'requires', 'related_to', 'causes'
  strength REAL DEFAULT 0.5,
  evidence_count INTEGER DEFAULT 1,
  last_observed INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_knowledge_edges_user ON knowledge_edges(user_id);
CREATE INDEX idx_knowledge_edges_from ON knowledge_edges(from_concept);
CREATE INDEX idx_knowledge_edges_to ON knowledge_edges(to_concept);
CREATE INDEX idx_knowledge_edges_strength ON knowledge_edges(strength DESC);

-- Views for common queries

-- Recent context history per user
CREATE VIEW IF NOT EXISTS v_recent_contexts AS
SELECT
  user_id,
  context_type,
  MAX(accessed_at) as last_access,
  COUNT(*) as access_count,
  AVG(duration_seconds) as avg_duration
FROM context_access_log
WHERE accessed_at > (strftime('%s', 'now') - 86400 * 7) * 1000 -- Last 7 days
GROUP BY user_id, context_type
ORDER BY last_access DESC;

-- User context preferences (most used contexts)
CREATE VIEW IF NOT EXISTS v_user_context_preferences AS
SELECT
  user_id,
  context_type,
  COUNT(*) as usage_count,
  AVG(duration_seconds) as avg_duration,
  SUM(CASE WHEN outcome = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as completion_rate
FROM context_access_log
GROUP BY user_id, context_type
ORDER BY usage_count DESC;

-- Common context switches (patterns)
CREATE VIEW IF NOT EXISTS v_common_switches AS
SELECT
  from_context,
  to_context,
  COUNT(*) as occurrence_count,
  AVG(CASE WHEN success THEN 1 ELSE 0 END) as success_rate
FROM context_switches
WHERE timestamp > (strftime('%s', 'now') - 86400 * 30) * 1000 -- Last 30 days
GROUP BY from_context, to_context
HAVING occurrence_count > 3
ORDER BY occurrence_count DESC;

-- High-performing suggestions
CREATE VIEW IF NOT EXISTS v_suggestion_performance AS
SELECT
  context_type,
  suggestion_text,
  COUNT(*) as times_shown,
  SUM(CASE WHEN accepted THEN 1 ELSE 0 END) as times_accepted,
  SUM(CASE WHEN accepted THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as acceptance_rate,
  AVG(confidence) as avg_confidence
FROM predictive_suggestions
GROUP BY context_type, suggestion_text
HAVING times_shown > 5
ORDER BY acceptance_rate DESC, times_shown DESC;
