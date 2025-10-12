/**
 * ChittySync Memory Orchestrator
 * Omnidirectional memory sync across ChittyRouter agents, ChittyContextual, and MCP tools
 * Version: 1.0.0
 */

import type { Env } from "./types";

export interface AgentMemory {
  agent_id: string;
  session_id: string;
  memories: ConversationMemory[];
  last_sync: number;
  project_id?: string;
}

export interface ConversationMemory {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  metadata?: {
    taskType?: string;
    provider?: string;
    cost?: number;
    entities?: any[];
    topics?: any[];
  };
}

export interface MemorySyncRequest {
  agent_id: string;
  session_id: string;
  memories: ConversationMemory[];
  since?: number; // Unix timestamp for delta sync
}

export interface MemorySyncResponse {
  success: boolean;
  synced_count: number;
  relevance_scores: Record<string, number>; // project_id -> score
  distributed_to: string[]; // List of services updated
  timestamp: number;
}

/**
 * Memory Sync Orchestrator
 */
export class MemorySyncOrchestrator {
  constructor(
    private env: Env,
    private db: D1Database,
  ) {}

  /**
   * Sync agent memory to central hub
   * Flow: Agent DO -> ChittySync D1 -> ChittyContextual PostgreSQL
   */
  async syncAgentMemory(
    request: MemorySyncRequest,
  ): Promise<MemorySyncResponse> {
    const { agent_id, session_id, memories, since } = request;
    const timestamp = Date.now();

    // 1. Store in D1 (ChittySync persistence)
    await this.storeInD1(agent_id, session_id, memories);

    // 2. Score project relevance
    const relevanceScores = await this.scoreProjectRelevance(memories);

    // 3. Distribute to ChittyContextual for analysis (top 3 projects)
    const topProjects = Object.entries(relevanceScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id]) => id);

    const distributedTo: string[] = ["chittysync"];

    // If ChittyContextual is available, send for deep analysis
    if (this.env.CHITTYCONTEXTUAL_URL) {
      await this.distributeToContextual(
        agent_id,
        session_id,
        memories,
        topProjects,
      );
      distributedTo.push("chittycontextual");
    }

    // 4. Broadcast to WebSocket subscribers (real-time updates)
    await this.broadcastMemoryUpdate(agent_id, session_id, memories.length);
    distributedTo.push("websocket");

    return {
      success: true,
      synced_count: memories.length,
      relevance_scores: relevanceScores,
      distributed_to: distributedTo,
      timestamp,
    };
  }

  /**
   * Pull memory for an agent (omnidirectional sync)
   * Flow: ChittySync D1 -> Agent DO
   */
  async pullMemoryForAgent(
    agent_id: string,
    session_id: string,
    since?: number,
  ): Promise<AgentMemory | null> {
    const query = since
      ? `SELECT * FROM agent_memories
         WHERE agent_id = ? AND session_id = ? AND timestamp > ?
         ORDER BY timestamp ASC`
      : `SELECT * FROM agent_memories
         WHERE agent_id = ? AND session_id = ?
         ORDER BY timestamp ASC`;

    const params = since
      ? [agent_id, session_id, since]
      : [agent_id, session_id];

    const result = await this.db
      .prepare(query)
      .bind(...params)
      .all();

    if (!result.results || result.results.length === 0) {
      return null;
    }

    const memories: ConversationMemory[] = result.results.map((row: any) => ({
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));

    return {
      agent_id,
      session_id,
      memories,
      last_sync: Date.now(),
      project_id: result.results[0]?.project_id,
    };
  }

  /**
   * Store memories in D1
   */
  private async storeInD1(
    agent_id: string,
    session_id: string,
    memories: ConversationMemory[],
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO agent_memories
      (agent_id, session_id, role, content, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const batch = memories.map((memory) =>
      stmt.bind(
        agent_id,
        session_id,
        memory.role,
        memory.content,
        memory.timestamp,
        JSON.stringify(memory.metadata || {}),
      ),
    );

    await this.db.batch(batch);
  }

  /**
   * Score project relevance based on memory content
   */
  private async scoreProjectRelevance(
    memories: ConversationMemory[],
  ): Promise<Record<string, number>> {
    // Get recent content for analysis
    const recentContent = memories
      .slice(-10)
      .map((m) => m.content)
      .join(" ");

    // Query project keywords from D1
    const projects = await this.db
      .prepare("SELECT project_id, keywords FROM projects")
      .all();

    const scores: Record<string, number> = {};

    if (!projects.results) {
      return scores;
    }

    for (const project of projects.results) {
      const keywords = JSON.parse((project.keywords as string) || "[]");
      let score = 0;

      for (const keyword of keywords) {
        const regex = new RegExp(keyword, "gi");
        const matches = recentContent.match(regex);
        if (matches) {
          score += matches.length;
        }
      }

      scores[project.project_id as string] = score;
    }

    return scores;
  }

  /**
   * Distribute to ChittyContextual for deep analysis
   */
  private async distributeToContextual(
    agent_id: string,
    session_id: string,
    memories: ConversationMemory[],
    projects: string[],
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.env.CHITTYCONTEXTUAL_URL}/api/memory/analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.env.CHITTY_ID_TOKEN}`,
          },
          body: JSON.stringify({
            agent_id,
            session_id,
            memories,
            projects,
          }),
        },
      );

      if (!response.ok) {
        console.error(
          "ChittyContextual distribution failed:",
          await response.text(),
        );
      }
    } catch (error) {
      console.error("Failed to distribute to ChittyContextual:", error);
    }
  }

  /**
   * Broadcast memory update via WebSocket
   */
  private async broadcastMemoryUpdate(
    agent_id: string,
    session_id: string,
    count: number,
  ): Promise<void> {
    // TODO: Implement WebSocket broadcasting
    // This will notify all connected clients that new memory is available
    console.log(
      `Broadcasting memory update: agent=${agent_id} session=${session_id} count=${count}`,
    );
  }
}

/**
 * Database schema migration for agent_memories table
 */
export const MEMORY_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS agent_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  metadata TEXT,
  project_id TEXT,
  synced_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(agent_id, session_id, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_agent_session ON agent_memories(agent_id, session_id);
CREATE INDEX IF NOT EXISTS idx_timestamp ON agent_memories(timestamp);
CREATE INDEX IF NOT EXISTS idx_project ON agent_memories(project_id);

CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  keywords TEXT NOT NULL, -- JSON array
  created_at INTEGER DEFAULT (unixepoch())
);
`;
