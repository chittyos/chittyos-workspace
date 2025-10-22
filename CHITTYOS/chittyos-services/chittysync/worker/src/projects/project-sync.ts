/**
 * ChittySync Project Sync Engine (Tier 2)
 * Maintains singular canonical project state across all sessions
 * Version: 2.1.0
 */

import type {
  Env,
  Todo,
  Project,
  ProjectState,
  Session,
  ProjectConsolidationResponse,
  MergeStrategyType,
  Conflict,
} from "../types";
import { ChittyIdClient } from "../chittyid-client";
import { MergeEngine } from "../merge-engine";
import { VectorClock } from "../vector-clock";

/**
 * Project Sync Orchestrator
 * Manages project-level synchronization and consolidation
 */
export class ProjectSyncOrchestrator {
  constructor(
    private env: Env,
    private db: D1Database,
  ) {}

  /**
   * Get or create project record
   */
  async getOrCreateProject(
    projectPath: string,
    gitRoot?: string,
    gitBranch?: string,
  ): Promise<Project> {
    // Try to find existing project by path
    const existing = await this.db
      .prepare("SELECT * FROM projects WHERE project_path = ?")
      .bind(projectPath)
      .first();

    if (existing) {
      return this.parseProjectFromDb(existing);
    }

    // Create new project
    const chittyIdClient = new ChittyIdClient(
      this.env.CHITTYID_SERVICE_URL,
      this.env.CHITTY_ID_TOKEN,
    );

    const chittyId = await chittyIdClient.mint(
      "project",
      "sync",
      {
        path: projectPath,
        git_root: gitRoot,
      },
      this.env.CHITTY_ID_TOKEN,
    );

    const now = Date.now();
    const projectId = this.generateProjectId(projectPath);

    const project: Project = {
      id: chittyId.id,
      project_path: projectPath,
      git_root: gitRoot,
      git_branch: gitBranch || "main",
      canonical_state: JSON.stringify([]),
      last_consolidated: now,
      created_at: now,
      updated_at: now,
    };

    await this.db
      .prepare(
        `INSERT INTO projects (id, project_path, git_root, git_branch, canonical_state, last_consolidated, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        project.id,
        project.project_path,
        project.git_root || null,
        project.git_branch || null,
        project.canonical_state,
        project.last_consolidated,
        project.created_at,
        project.updated_at,
      )
      .run();

    return project;
  }

  /**
   * Register a new session for a project
   */
  async registerSession(
    sessionId: string,
    projectPath: string,
    platform: string,
    agentId?: string,
    gitBranch?: string,
    gitCommit?: string,
  ): Promise<Session> {
    // Get or create project
    const project = await this.getOrCreateProject(projectPath);

    // Check if session already exists
    const existing = await this.db
      .prepare("SELECT * FROM sessions WHERE session_id = ?")
      .bind(sessionId)
      .first();

    if (existing) {
      // Update last_active_at
      const now = Date.now();
      await this.db
        .prepare("UPDATE sessions SET last_active_at = ?, status = ? WHERE session_id = ?")
        .bind(now, "active", sessionId)
        .run();

      return this.parseSessionFromDb(existing);
    }

    // Create new session
    const chittyIdClient = new ChittyIdClient(
      this.env.CHITTYID_SERVICE_URL,
      this.env.CHITTY_ID_TOKEN,
    );

    const chittyId = await chittyIdClient.mint(
      "session",
      "sync",
      {
        session_id: sessionId,
        project_path: projectPath,
        platform,
      },
      this.env.CHITTY_ID_TOKEN,
    );

    const now = Date.now();

    const session: Session = {
      id: chittyId.id,
      session_id: sessionId,
      project_id: project.id,
      project_path: projectPath,
      git_branch: gitBranch,
      git_commit: gitCommit,
      platform: platform as any,
      agent_id: agentId,
      status: "active",
      started_at: now,
      last_active_at: now,
    };

    await this.db
      .prepare(
        `INSERT INTO sessions (id, session_id, project_id, project_path, git_branch, git_commit, platform, agent_id, status, started_at, last_active_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      )
      .run();

    return session;
  }

  /**
   * Get all active sessions for a project
   */
  async getActiveSessionsForProject(projectId: string): Promise<Session[]> {
    const result = await this.db
      .prepare(
        "SELECT * FROM sessions WHERE project_id = ? AND status = ? ORDER BY last_active_at DESC",
      )
      .bind(projectId, "active")
      .all();

    return (result.results as unknown[]).map((row) =>
      this.parseSessionFromDb(row),
    );
  }

  /**
   * Get all todos for a session in a project
   */
  async getSessionProjectTodos(
    sessionId: string,
    projectId: string,
  ): Promise<Todo[]> {
    const result = await this.db
      .prepare(
        `SELECT t.* FROM todos t
         INNER JOIN project_todos pt ON t.id = pt.todo_id
         WHERE pt.project_id = ? AND pt.session_id = ? AND t.deleted_at IS NULL AND pt.removed_at IS NULL
         ORDER BY t.updated_at DESC`,
      )
      .bind(projectId, sessionId)
      .all();

    return (result.results as unknown[]).map((row) => this.parseTodoFromDb(row));
  }

  /**
   * Get canonical state for a project
   */
  async getProjectCanonicalState(projectId: string): Promise<Todo[]> {
    const project = await this.db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .bind(projectId)
      .first();

    if (!project) {
      return [];
    }

    const p = this.parseProjectFromDb(project);
    if (!p.canonical_state) {
      return [];
    }

    try {
      return JSON.parse(p.canonical_state);
    } catch (error) {
      console.error("Failed to parse canonical state:", error);
      return [];
    }
  }

  /**
   * Consolidate all sessions for a project into singular canonical state
   */
  async consolidateProject(
    projectId: string,
    strategy: MergeStrategyType = "timestamp",
  ): Promise<ProjectConsolidationResponse> {
    const startTime = Date.now();

    // Get all active sessions for this project
    const sessions = await this.getActiveSessionsForProject(projectId);

    // Get todos from all sessions
    const allTodos: Todo[] = [];
    for (const session of sessions) {
      const sessionTodos = await this.getSessionProjectTodos(
        session.session_id,
        projectId,
      );
      allTodos.push(...sessionTodos);
    }

    // Deduplicate todos by ID (same todo may appear in multiple sessions)
    const todoMap = new Map<string, Todo>();
    for (const todo of allTodos) {
      if (!todoMap.has(todo.id)) {
        todoMap.set(todo.id, todo);
      } else {
        // Todo exists in multiple sessions - merge with strategy
        const existing = todoMap.get(todo.id)!;
        const merged = await this.mergeTodos(existing, todo, strategy);
        todoMap.set(todo.id, merged);
      }
    }

    const deduplicatedTodos = Array.from(todoMap.values());

    // Get current canonical state
    const currentState = await this.getProjectCanonicalState(projectId);

    // Merge with existing canonical state
    const mergeEngine = new MergeEngine();
    const mergeResult = await mergeEngine.threeWayMerge(
      currentState, // base
      deduplicatedTodos, // local (all sessions)
      currentState, // remote (current canonical)
      strategy,
    );

    // Store conflicts if any
    let conflictsResolved = 0;
    if (mergeResult.conflicts.length > 0) {
      for (const conflict of mergeResult.conflicts) {
        await this.storeConflict(conflict);
      }
      conflictsResolved = mergeResult.conflicts.length;
    }

    // Update canonical state
    const canonicalTodos = mergeResult.merged_todos;
    const now = Date.now();

    await this.db
      .prepare(
        "UPDATE projects SET canonical_state = ?, last_consolidated = ?, updated_at = ? WHERE id = ?",
      )
      .bind(JSON.stringify(canonicalTodos), now, now, projectId)
      .run();

    // Sync canonical state back to all active sessions
    for (const session of sessions) {
      await this.syncCanonicalStateToSession(
        session.session_id,
        projectId,
        canonicalTodos,
      );
    }

    return {
      project_id: projectId,
      todos_count: canonicalTodos.length,
      sessions_synced: sessions.length,
      conflicts_resolved: conflictsResolved,
      canonical_state: canonicalTodos,
      timestamp: now,
    };
  }

  /**
   * Sync canonical state to a session (write back)
   */
  private async syncCanonicalStateToSession(
    sessionId: string,
    projectId: string,
    canonicalTodos: Todo[],
  ): Promise<void> {
    // Get existing session todos
    const sessionTodos = await this.getSessionProjectTodos(sessionId, projectId);
    const sessionTodoIds = new Set(sessionTodos.map((t) => t.id));

    // Add missing todos to session
    for (const todo of canonicalTodos) {
      if (!sessionTodoIds.has(todo.id)) {
        await this.db
          .prepare(
            "INSERT OR IGNORE INTO project_todos (project_id, todo_id, session_id, contributed_at) VALUES (?, ?, ?, ?)",
          )
          .bind(projectId, todo.id, sessionId, Date.now())
          .run();
      }
    }
  }

  /**
   * Merge two todos with strategy
   */
  private async mergeTodos(
    todo1: Todo,
    todo2: Todo,
    strategy: MergeStrategyType,
  ): Promise<Todo> {
    if (strategy === "timestamp") {
      return todo1.updated_at > todo2.updated_at ? todo1 : todo2;
    }

    if (strategy === "status_priority") {
      const priority = { completed: 3, in_progress: 2, pending: 1 };
      return priority[todo1.status] >= priority[todo2.status] ? todo1 : todo2;
    }

    // Default: keep most recent
    return todo1.updated_at > todo2.updated_at ? todo1 : todo2;
  }

  /**
   * Store conflict record
   */
  private async storeConflict(conflict: Conflict): Promise<void> {
    const chittyIdClient = new ChittyIdClient(
      this.env.CHITTYID_SERVICE_URL,
      this.env.CHITTY_ID_TOKEN,
    );

    const chittyId = await chittyIdClient.mint(
      "conflict",
      "merge",
      { todo_id: conflict.todo_id },
      this.env.CHITTY_ID_TOKEN,
    );

    await this.db
      .prepare(
        `INSERT INTO conflicts (id, todo_id, base_version, local_version, remote_version, conflict_type, detected_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        chittyId.id,
        conflict.todo_id,
        conflict.base_version || null,
        conflict.local_version,
        conflict.remote_version,
        conflict.conflict_type,
        conflict.detected_at,
      )
      .run();
  }

  /**
   * Generate project ID from path (e.g., "chittyrouter" from path)
   */
  private generateProjectId(projectPath: string): string {
    const parts = projectPath.split("/");
    return parts[parts.length - 1] || "unknown";
  }

  /**
   * Parse project from DB row
   */
  private parseProjectFromDb(row: unknown): Project {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      project_path: r.project_path as string,
      git_root: r.git_root as string | undefined,
      git_branch: r.git_branch as string | undefined,
      git_remote: r.git_remote as string | undefined,
      canonical_state: r.canonical_state as string | undefined,
      last_consolidated: r.last_consolidated as number | undefined,
      created_at: r.created_at as number,
      updated_at: r.updated_at as number,
      metadata: r.metadata
        ? JSON.parse(r.metadata as string)
        : undefined,
    };
  }

  /**
   * Parse session from DB row
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
      platform: r.platform as any,
      agent_id: r.agent_id as string | undefined,
      status: r.status as any,
      started_at: r.started_at as number,
      last_active_at: r.last_active_at as number,
      ended_at: r.ended_at as number | undefined,
      metadata: r.metadata ? JSON.parse(r.metadata as string) : undefined,
    };
  }

  /**
   * Parse todo from DB row
   */
  private parseTodoFromDb(row: unknown): Todo {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      content: r.content as string,
      status: r.status as Todo["status"],
      active_form: r.active_form as string | undefined,
      platform: r.platform as any,
      session_id: r.session_id as string | undefined,
      agent_id: r.agent_id as string | undefined,
      created_at: r.created_at as number,
      updated_at: r.updated_at as number,
      deleted_at: r.deleted_at as number | undefined,
      metadata: r.metadata ? JSON.parse(r.metadata as string) : undefined,
    };
  }
}
