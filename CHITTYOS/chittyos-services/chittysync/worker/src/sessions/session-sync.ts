/**
 * ChittySync Session Sync Engine
 * Version: 2.2.0
 *
 * Implements real-time synchronization between multiple sessions in same project.
 * Uses three-way merge for conflict resolution and maintains singular project state.
 */

import type {
  Env,
  Todo,
  SessionSyncRequest,
  SessionSyncResponse,
  ProjectState,
  MergeStrategyType,
  Conflict,
} from "../types";
import { SessionRegistry } from "./session-registry";
import { MergeEngine, type TodoWithClock, type MergeResult } from "../merge-engine";
import { VectorClockManager } from "../vector-clock";

/**
 * Session Sync Engine for multi-session coordination
 */
export class SessionSync {
  private readonly registry: SessionRegistry;

  constructor(
    private readonly env: Env,
    private readonly db: D1Database,
  ) {
    this.registry = new SessionRegistry(env, db);
  }

  /**
   * Sync todos from a session to all other sessions in same project
   */
  async syncSession(
    request: SessionSyncRequest,
    bearerToken?: string,
  ): Promise<SessionSyncResponse> {
    const { session_id, project_id, todos, strategy } = request;

    // 1. Get or register session
    let session = await this.registry.getSessionBySessionId(session_id);
    if (!session) {
      // Auto-register session if not exists
      session = await this.registry.registerSession(
        {
          session_id,
          project_id,
          project_path: "", // Will be updated by client
          platform: "claude-code",
        },
        bearerToken,
      );
    }

    // 2. Update last active timestamp
    await this.registry.updateLastActive(session_id);

    // 3. If todos provided, sync them to hub
    if (todos && todos.length > 0) {
      for (const todo of todos) {
        await this.syncTodoToHub(session_id, project_id, todo);
      }
    }

    // 4. Get all active sessions in this project
    const allSessions = await this.registry.getActiveSessionsForProject(
      project_id,
    );

    // 5. If only one session, no merge needed
    if (allSessions.length === 1) {
      const sessionTodos = await this.getSessionTodos(session_id, project_id);
      return {
        sessions_synced: 1,
        todos_merged: sessionTodos.length,
        conflicts: 0,
        project_state: "synchronized",
        canonical_state: sessionTodos,
      };
    }

    // 6. Merge todos from all sessions into canonical project state
    const mergeResult = await this.consolidateProjectState(
      project_id,
      allSessions.map((s) => s.session_id),
      strategy || "timestamp",
    );

    // 7. Write canonical state back to all sessions
    await this.broadcastCanonicalState(
      project_id,
      allSessions.map((s) => s.session_id),
      mergeResult.canonical_state,
    );

    return {
      sessions_synced: allSessions.length,
      todos_merged: mergeResult.canonical_state.length,
      conflicts: mergeResult.conflicts.length,
      project_state:
        mergeResult.conflicts.length > 0 ? "conflicts" : "synchronized",
      canonical_state: mergeResult.canonical_state,
      conflicts_detected: mergeResult.conflicts,
    };
  }

  /**
   * Sync a single todo from session to hub
   */
  private async syncTodoToHub(
    sessionId: string,
    projectId: string,
    todo: Todo,
  ): Promise<void> {
    // Add project attribution
    const todoWithProject = {
      ...todo,
      project_id: projectId,
      session_id: sessionId,
    };

    // Check if todo already exists
    const existing = await this.db
      .prepare("SELECT * FROM todos WHERE id = ?")
      .bind(todo.id)
      .first();

    if (existing) {
      // Update existing
      await this.db
        .prepare(
          `UPDATE todos
           SET content = ?, status = ?, active_form = ?, updated_at = ?,
               project_id = ?, session_id = ?, metadata = ?
           WHERE id = ?`,
        )
        .bind(
          todoWithProject.content,
          todoWithProject.status,
          todoWithProject.active_form || null,
          todoWithProject.updated_at,
          todoWithProject.project_id,
          todoWithProject.session_id,
          todoWithProject.metadata
            ? JSON.stringify(todoWithProject.metadata)
            : null,
          todo.id,
        )
        .run();
    } else {
      // Insert new
      await this.db
        .prepare(
          `INSERT INTO todos (id, content, status, active_form, platform, session_id, agent_id, project_id, created_at, updated_at, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          todo.id,
          todo.content,
          todo.status,
          todo.active_form || null,
          todo.platform,
          todo.session_id || null,
          todo.agent_id || null,
          projectId,
          todo.created_at,
          todo.updated_at,
          todo.metadata ? JSON.stringify(todo.metadata) : null,
        )
        .run();
    }

    // Associate with session
    await this.registry.addTodoToSession(sessionId, projectId, todo.id);
  }

  /**
   * Get all todos for a session in a project
   */
  private async getSessionTodos(
    sessionId: string,
    projectId: string,
  ): Promise<Todo[]> {
    const result = await this.db
      .prepare(
        `SELECT t.* FROM todos t
         INNER JOIN session_todos st ON t.id = st.todo_id
         WHERE st.session_id = ? AND st.project_id = ? AND t.deleted_at IS NULL
         ORDER BY t.updated_at DESC`,
      )
      .bind(sessionId, projectId)
      .all();

    return (result.results as unknown[]).map((row) => this.parseTodoFromDb(row));
  }

  /**
   * Consolidate todos from all sessions into singular project state
   */
  private async consolidateProjectState(
    projectId: string,
    sessionIds: string[],
    strategy: MergeStrategyType,
  ): Promise<{
    canonical_state: Todo[];
    conflicts: Conflict[];
  }> {
    // 1. Collect todos from all sessions
    const allTodosBySession: Map<string, Todo[]> = new Map();

    for (const sessionId of sessionIds) {
      const todos = await this.getSessionTodos(sessionId, projectId);
      allTodosBySession.set(sessionId, todos);
    }

    // 2. Flatten all todos into single list (with duplicates)
    const allTodos: TodoWithClock[] = [];
    for (const [sessionId, todos] of allTodosBySession) {
      for (const todo of todos) {
        // Get vector clock for this todo
        const clock = await this.getVectorClock(todo.id, sessionId);
        allTodos.push({ ...todo, vectorClock: clock });
      }
    }

    // 3. Group todos by ID for merge
    const todoGroups: Map<string, TodoWithClock[]> = new Map();
    for (const todo of allTodos) {
      const existing = todoGroups.get(todo.id) || [];
      existing.push(todo);
      todoGroups.set(todo.id, existing);
    }

    // 4. Merge each group
    const mergedTodos: Todo[] = [];
    const conflicts: Conflict[] = [];

    for (const [todoId, versions] of todoGroups) {
      if (versions.length === 1) {
        // Only one version - no merge needed
        mergedTodos.push(versions[0]);
      } else {
        // Multiple versions - perform merge
        const mergeResult = await this.mergeTodoVersions(
          versions,
          strategy,
          projectId,
        );

        if (Array.isArray(mergeResult.merged)) {
          mergedTodos.push(...mergeResult.merged);
        } else {
          mergedTodos.push(mergeResult.merged);
        }

        if (mergeResult.conflict && mergeResult.conflictRecord) {
          // Store conflict record
          await this.storeConflict(mergeResult.conflictRecord);
          conflicts.push(this.conflictRecordToApiConflict(mergeResult.conflictRecord));
        }
      }
    }

    // 5. Update project canonical state
    await this.updateProjectCanonicalState(projectId, mergedTodos, sessionIds);

    return {
      canonical_state: mergedTodos,
      conflicts,
    };
  }

  /**
   * Merge multiple versions of same todo from different sessions
   */
  private async mergeTodoVersions(
    versions: TodoWithClock[],
    strategy: MergeStrategyType,
    projectId: string,
  ): Promise<MergeResult> {
    if (versions.length === 0) {
      throw new Error("No versions to merge");
    }

    if (versions.length === 1) {
      return {
        merged: versions[0],
        conflict: false,
        strategy: MergeEngine.MergeStrategy.THREE_WAY,
        autoResolved: true,
      };
    }

    // Use first two versions for merge (can be extended to N-way merge)
    const local = versions[0];
    const remote = versions[1];

    // Get base version (common ancestor from project canonical state)
    const base = await this.getProjectTodoBase(projectId, local.id);

    // Perform three-way merge
    return MergeEngine.threeWayMerge(
      local,
      remote,
      base,
      this.mapStrategyToMergeEngine(strategy),
    );
  }

  /**
   * Get base version of todo from project canonical state
   */
  private async getProjectTodoBase(
    projectId: string,
    todoId: string,
  ): Promise<TodoWithClock | null> {
    const state = await this.getProjectCanonicalState(projectId);
    if (!state) return null;

    const baseTodo = state.canonical_todos.find((t) => t.id === todoId);
    if (!baseTodo) return null;

    const clock = await this.getVectorClock(todoId, "canonical");
    return { ...baseTodo, vectorClock: clock };
  }

  /**
   * Update project canonical state in database
   */
  private async updateProjectCanonicalState(
    projectId: string,
    todos: Todo[],
    contributingSessions: string[],
  ): Promise<void> {
    const now = Date.now();

    const state = {
      canonical_todos: todos,
      last_consolidated: now,
      contributing_sessions: contributingSessions.map((sid) => ({
        session_id: sid,
        todos_count: todos.filter((t) => t.session_id === sid).length,
        last_contribution: now,
      })),
    };

    const existing = await this.db
      .prepare("SELECT project_id FROM project_states WHERE project_id = ?")
      .bind(projectId)
      .first();

    if (existing) {
      await this.db
        .prepare(
          `UPDATE project_states
           SET canonical_state = ?, last_consolidated = ?, contributing_sessions = ?
           WHERE project_id = ?`,
        )
        .bind(
          JSON.stringify(state.canonical_todos),
          now,
          JSON.stringify(state.contributing_sessions),
          projectId,
        )
        .run();
    } else {
      await this.db
        .prepare(
          `INSERT INTO project_states (project_id, canonical_state, last_consolidated, contributing_sessions)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(
          projectId,
          JSON.stringify(state.canonical_todos),
          now,
          JSON.stringify(state.contributing_sessions),
        )
        .run();
    }
  }

  /**
   * Get project canonical state
   */
  private async getProjectCanonicalState(
    projectId: string,
  ): Promise<ProjectState | null> {
    const result = await this.db
      .prepare("SELECT * FROM project_states WHERE project_id = ?")
      .bind(projectId)
      .first();

    if (!result) return null;

    const r = result as Record<string, unknown>;
    return {
      project_id: r.project_id as string,
      canonical_todos: JSON.parse(r.canonical_state as string),
      contributing_sessions: JSON.parse(r.contributing_sessions as string),
      last_consolidated: r.last_consolidated as number,
      metadata: r.metadata ? JSON.parse(r.metadata as string) : undefined,
    };
  }

  /**
   * Broadcast canonical state to all sessions
   */
  private async broadcastCanonicalState(
    projectId: string,
    sessionIds: string[],
    canonicalTodos: Todo[],
  ): Promise<void> {
    // For each session, update session_todos to reflect canonical state
    for (const sessionId of sessionIds) {
      // Clear existing session_todos
      await this.db
        .prepare(
          "DELETE FROM session_todos WHERE session_id = ? AND project_id = ?",
        )
        .bind(sessionId, projectId)
        .run();

      // Re-add all canonical todos to session
      const now = Date.now();
      for (const todo of canonicalTodos) {
        await this.db
          .prepare(
            "INSERT INTO session_todos (session_id, project_id, todo_id, created_at) VALUES (?, ?, ?, ?)",
          )
          .bind(sessionId, projectId, todo.id, now)
          .run();
      }
    }
  }

  /**
   * Get vector clock for todo/session
   */
  private async getVectorClock(
    todoId: string,
    platform: string,
  ): Promise<Record<string, number> | undefined> {
    const result = await this.db
      .prepare(
        "SELECT clock_value FROM vector_clocks WHERE todo_id = ? AND platform = ?",
      )
      .bind(todoId, platform)
      .first<{ clock_value: number }>();

    if (!result) return undefined;

    return { [platform]: result.clock_value };
  }

  /**
   * Store conflict record
   */
  private async storeConflict(conflict: any): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO conflicts (id, todo_id, base_version, local_version, remote_version, conflict_type, detected_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        conflict.id,
        conflict.todoId,
        conflict.baseVersion ? JSON.stringify(conflict.baseVersion) : null,
        JSON.stringify(conflict.localVersion),
        JSON.stringify(conflict.remoteVersion),
        conflict.conflictType,
        conflict.detectedAt,
        conflict.metadata ? JSON.stringify(conflict.metadata) : null,
      )
      .run();
  }

  /**
   * Convert internal conflict record to API format
   */
  private conflictRecordToApiConflict(record: any): Conflict {
    return {
      id: record.id,
      todo_id: record.todoId,
      base_version: record.baseVersion
        ? JSON.stringify(record.baseVersion)
        : undefined,
      local_version: JSON.stringify(record.localVersion),
      remote_version: JSON.stringify(record.remoteVersion),
      conflict_type: record.conflictType,
      detected_at: record.detectedAt,
      resolved_at: record.resolvedAt,
      resolution_strategy: record.resolutionStrategy,
      resolved_by: record.resolvedBy,
      metadata: record.metadata,
    };
  }

  /**
   * Map API strategy to MergeEngine strategy
   */
  private mapStrategyToMergeEngine(
    strategy: MergeStrategyType,
  ): typeof MergeEngine.MergeStrategy[keyof typeof MergeEngine.MergeStrategy] {
    const map: Record<
      MergeStrategyType,
      typeof MergeEngine.MergeStrategy[keyof typeof MergeEngine.MergeStrategy]
    > = {
      three_way: MergeEngine.MergeStrategy.THREE_WAY,
      timestamp: MergeEngine.MergeStrategy.TIMESTAMP,
      status_priority: MergeEngine.MergeStrategy.STATUS_PRIORITY,
      keep_local: MergeEngine.MergeStrategy.KEEP_LOCAL,
      keep_remote: MergeEngine.MergeStrategy.KEEP_REMOTE,
      keep_both: MergeEngine.MergeStrategy.KEEP_BOTH,
      manual: MergeEngine.MergeStrategy.MANUAL,
    };

    return map[strategy] || MergeEngine.MergeStrategy.TIMESTAMP;
  }

  /**
   * Parse todo from database row
   */
  private parseTodoFromDb(row: unknown): Todo {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      content: r.content as string,
      status: r.status as Todo["status"],
      active_form: r.active_form as string | undefined,
      platform: r.platform as Todo["platform"],
      session_id: r.session_id as string | undefined,
      agent_id: r.agent_id as string | undefined,
      created_at: r.created_at as number,
      updated_at: r.updated_at as number,
      deleted_at: r.deleted_at as number | undefined,
      metadata: r.metadata ? JSON.parse(r.metadata as string) : undefined,
    };
  }
}
