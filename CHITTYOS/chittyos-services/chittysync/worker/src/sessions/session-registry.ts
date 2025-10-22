/**
 * ChittySync Session Registry
 * Version: 2.2.0
 *
 * Manages session lifecycle and project associations for multi-session sync.
 * Tracks active sessions within projects and enables real-time coordination.
 */

import type {
  Env,
  Session,
  RegisterSessionRequest,
  SessionStatus,
  TodoPlatform,
} from "../types";
import { ChittyIdClient } from "../chittyid-client";

/**
 * Session Registry for tracking and managing active sessions
 */
export class SessionRegistry {
  constructor(
    private readonly env: Env,
    private readonly db: D1Database,
  ) {}

  /**
   * Register a new session or update existing session
   */
  async registerSession(
    request: RegisterSessionRequest,
    bearerToken?: string,
  ): Promise<Session> {
    // Check if session already exists
    const existing = await this.getSessionBySessionId(request.session_id);

    if (existing) {
      // Update existing session
      return await this.updateSession(existing.id, {
        project_path: request.project_path,
        git_branch: request.git_branch,
        git_commit: request.git_commit,
        last_active_at: Date.now(),
        status: "active",
      });
    }

    // Mint ChittyID for new session
    const chittyIdClient = new ChittyIdClient(
      this.env.CHITTYID_SERVICE_URL,
      this.env.CHITTY_ID_TOKEN,
    );

    const chittyId = await chittyIdClient.mint(
      "session",
      "sync",
      {
        session_id: request.session_id,
        project_id: request.project_id,
        platform: request.platform || "custom",
      },
      bearerToken,
    );

    const now = Date.now();
    const session: Session = {
      id: chittyId.id,
      session_id: request.session_id,
      project_id: request.project_id,
      project_path: request.project_path,
      git_branch: request.git_branch,
      git_commit: request.git_commit,
      platform: request.platform || "custom",
      agent_id: request.agent_id,
      status: "active",
      started_at: now,
      last_active_at: now,
      metadata: request.metadata,
    };

    // Insert into database
    await this.db
      .prepare(
        `INSERT INTO sessions (id, session_id, project_id, project_path, git_branch, git_commit, platform, agent_id, status, started_at, last_active_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        session.id,
        session.session_id,
        session.project_id,
        session.project_path,
        session.git_branch || null,
        session.git_commit || null,
        session.platform,
        session.agent_id || null,
        session.status,
        session.started_at,
        session.last_active_at,
        session.metadata ? JSON.stringify(session.metadata) : null,
      )
      .run();

    return session;
  }

  /**
   * Get session by ChittyID
   */
  async getSession(id: string): Promise<Session | null> {
    const result = await this.db
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .bind(id)
      .first();

    return result ? this.parseSessionFromDb(result) : null;
  }

  /**
   * Get session by session_id (branch name)
   */
  async getSessionBySessionId(sessionId: string): Promise<Session | null> {
    const result = await this.db
      .prepare("SELECT * FROM sessions WHERE session_id = ?")
      .bind(sessionId)
      .first();

    return result ? this.parseSessionFromDb(result) : null;
  }

  /**
   * Get all active sessions for a project
   */
  async getActiveSessionsForProject(projectId: string): Promise<Session[]> {
    const result = await this.db
      .prepare(
        "SELECT * FROM sessions WHERE project_id = ? AND status = 'active' ORDER BY last_active_at DESC",
      )
      .bind(projectId)
      .all();

    return (result.results as unknown[]).map((row) =>
      this.parseSessionFromDb(row),
    );
  }

  /**
   * Get all sessions for a project (including inactive)
   */
  async getAllSessionsForProject(projectId: string): Promise<Session[]> {
    const result = await this.db
      .prepare(
        "SELECT * FROM sessions WHERE project_id = ? ORDER BY last_active_at DESC",
      )
      .bind(projectId)
      .all();

    return (result.results as unknown[]).map((row) =>
      this.parseSessionFromDb(row),
    );
  }

  /**
   * Update session activity timestamp
   */
  async updateLastActive(sessionId: string): Promise<void> {
    const now = Date.now();
    await this.db
      .prepare(
        "UPDATE sessions SET last_active_at = ? WHERE session_id = ?",
      )
      .bind(now, sessionId)
      .run();
  }

  /**
   * Update session fields
   */
  async updateSession(
    id: string,
    updates: Partial<Omit<Session, "id" | "session_id" | "project_id">>,
  ): Promise<Session> {
    const fields: string[] = [];
    const bindings: unknown[] = [];

    if (updates.project_path !== undefined) {
      fields.push("project_path = ?");
      bindings.push(updates.project_path);
    }

    if (updates.git_branch !== undefined) {
      fields.push("git_branch = ?");
      bindings.push(updates.git_branch);
    }

    if (updates.git_commit !== undefined) {
      fields.push("git_commit = ?");
      bindings.push(updates.git_commit);
    }

    if (updates.status !== undefined) {
      fields.push("status = ?");
      bindings.push(updates.status);
    }

    if (updates.last_active_at !== undefined) {
      fields.push("last_active_at = ?");
      bindings.push(updates.last_active_at);
    }

    if (updates.ended_at !== undefined) {
      fields.push("ended_at = ?");
      bindings.push(updates.ended_at);
    }

    if (updates.metadata !== undefined) {
      fields.push("metadata = ?");
      bindings.push(JSON.stringify(updates.metadata));
    }

    bindings.push(id);

    await this.db
      .prepare(`UPDATE sessions SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...bindings)
      .run();

    const updated = await this.getSession(id);
    if (!updated) {
      throw new Error(`Session ${id} not found after update`);
    }

    return updated;
  }

  /**
   * End a session (mark as inactive)
   */
  async endSession(sessionId: string): Promise<void> {
    const now = Date.now();
    await this.db
      .prepare(
        "UPDATE sessions SET status = 'inactive', ended_at = ? WHERE session_id = ?",
      )
      .bind(now, sessionId)
      .run();
  }

  /**
   * Archive old inactive sessions
   */
  async archiveOldSessions(olderThanMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = Date.now() - olderThanMs;
    const result = await this.db
      .prepare(
        "UPDATE sessions SET status = 'archived' WHERE status = 'inactive' AND ended_at < ?",
      )
      .bind(cutoff)
      .run();

    return result.meta?.changes || 0;
  }

  /**
   * Associate a todo with a session/project
   */
  async addTodoToSession(
    sessionId: string,
    projectId: string,
    todoId: string,
  ): Promise<void> {
    const now = Date.now();

    // Check if association already exists
    const existing = await this.db
      .prepare(
        "SELECT 1 FROM session_todos WHERE session_id = ? AND todo_id = ?",
      )
      .bind(sessionId, todoId)
      .first();

    if (!existing) {
      await this.db
        .prepare(
          "INSERT INTO session_todos (session_id, project_id, todo_id, created_at) VALUES (?, ?, ?, ?)",
        )
        .bind(sessionId, projectId, todoId, now)
        .run();
    }

    // Update session last active
    await this.updateLastActive(sessionId);
  }

  /**
   * Get all todos for a session in a specific project
   */
  async getTodosForSession(
    sessionId: string,
    projectId: string,
  ): Promise<string[]> {
    const result = await this.db
      .prepare(
        "SELECT todo_id FROM session_todos WHERE session_id = ? AND project_id = ?",
      )
      .bind(sessionId, projectId)
      .all();

    return (result.results as { todo_id: string }[]).map((row) => row.todo_id);
  }

  /**
   * Get count of active sessions in a project
   */
  async getActiveSessionCount(projectId: string): Promise<number> {
    const result = await this.db
      .prepare(
        "SELECT COUNT(*) as count FROM sessions WHERE project_id = ? AND status = 'active'",
      )
      .bind(projectId)
      .first<{ count: number }>();

    return result?.count || 0;
  }

  /**
   * Check if multiple sessions are active in same project
   */
  async hasMultipleSessions(projectId: string): Promise<boolean> {
    const count = await this.getActiveSessionCount(projectId);
    return count > 1;
  }

  /**
   * Get project path from any session in the project
   */
  async getProjectPath(projectId: string): Promise<string | null> {
    const result = await this.db
      .prepare(
        "SELECT project_path FROM sessions WHERE project_id = ? ORDER BY last_active_at DESC LIMIT 1",
      )
      .bind(projectId)
      .first<{ project_path: string }>();

    return result?.project_path || null;
  }

  /**
   * Parse session from database row
   */
  private parseSessionFromDb(row: unknown): Session {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      session_id: r.session_id as string,
      project_id: r.project_id as string,
      project_path: r.project_path as string,
      git_branch: r.git_branch as string | undefined,
      git_commit: r.git_commit as string | undefined,
      platform: r.platform as TodoPlatform,
      agent_id: r.agent_id as string | undefined,
      status: r.status as SessionStatus,
      started_at: r.started_at as number,
      last_active_at: r.last_active_at as number,
      ended_at: r.ended_at as number | undefined,
      metadata: r.metadata ? JSON.parse(r.metadata as string) : undefined,
    };
  }
}
