/**
 * Cross-Project Topic Tracker
 * Queries and aggregates topics across multiple projects
 *
 * Version: 1.0.0
 * Part of: Three-Tier Sync Architecture (Tier 3)
 */

import type { Env, Todo } from "../types";
import type { TopicStats, ProjectTopicInfo, TopicDashboard } from "./topic-registry";

/**
 * Cross-project topic view
 */
export interface CrossProjectTopicView {
  topic_id: string;
  todos_by_project: Record<string, Todo[]>;
  statistics: TopicStats;
  updated_at: number;
}

/**
 * Topic comparison result
 */
export interface TopicComparison {
  topics: {
    topic_id: string;
    name: string;
    total_todos: number;
    completed: number;
    progress_percentage: number;
    projects: string[];
  }[];
  timestamp: number;
}

/**
 * Session topic summary
 */
export interface SessionTopicSummary {
  session_id: string;
  topics: {
    topic_id: string;
    name: string;
    todos_count: number;
    projects: string[];
  }[];
  total_todos: number;
  updated_at: number;
}

/**
 * Cross-Project Topic Tracker
 */
export class CrossProjectTracker {
  constructor(
    private env: Env,
    private db: D1Database,
  ) {}

  /**
   * Get topic across all projects
   */
  async getTopicAcrossProjects(topicId: string): Promise<CrossProjectTopicView> {
    // Query all projects for this topic
    const projectTodosResult = await this.db
      .prepare(
        `SELECT project_id, id, content, status, active_form, platform, session_id, agent_id,
                created_at, updated_at, deleted_at, metadata, primary_topic, topics
         FROM todos
         WHERE deleted_at IS NULL
         AND (primary_topic = ? OR topics LIKE ?)
         ORDER BY project_id, updated_at DESC`,
      )
      .bind(topicId, `%${topicId}%`)
      .all();

    const todos = projectTodosResult.results as unknown[];

    // Group by project
    const todosByProject: Record<string, Todo[]> = {};
    for (const row of todos) {
      const todo = this.parseTodoFromDb(row);
      const projectId = todo.metadata?.project_id || 'unknown';

      if (!todosByProject[projectId]) {
        todosByProject[projectId] = [];
      }
      todosByProject[projectId].push(todo);
    }

    // Calculate statistics
    const allTodos = Object.values(todosByProject).flat();
    const stats: TopicStats = {
      total_todos: allTodos.length,
      completed: allTodos.filter(t => t.status === 'completed').length,
      in_progress: allTodos.filter(t => t.status === 'in_progress').length,
      pending: allTodos.filter(t => t.status === 'pending').length,
      projects_count: Object.keys(todosByProject).length,
    };

    return {
      topic_id: topicId,
      todos_by_project: todosByProject,
      statistics: stats,
      updated_at: Date.now(),
    };
  }

  /**
   * Get all projects that have a specific topic
   */
  async getProjectsForTopic(topicId: string): Promise<ProjectTopicInfo[]> {
    const result = await this.db
      .prepare(
        `SELECT project_id, COUNT(*) as count, MAX(updated_at) as last_updated
         FROM todos
         WHERE deleted_at IS NULL
         AND (primary_topic = ? OR topics LIKE ?)
         GROUP BY project_id
         ORDER BY count DESC`,
      )
      .bind(topicId, `%${topicId}%`)
      .all();

    return (result.results as unknown[]).map((row: any) => ({
      project_id: row.project_id || 'unknown',
      todos_count: row.count,
      last_updated: row.last_updated,
    }));
  }

  /**
   * Get todos for a specific topic in a specific project
   */
  async getProjectTodosByTopic(
    projectId: string,
    topicId: string,
  ): Promise<Todo[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM todos
         WHERE deleted_at IS NULL
         AND project_id = ?
         AND (primary_topic = ? OR topics LIKE ?)
         ORDER BY updated_at DESC`,
      )
      .bind(projectId, topicId, `%${topicId}%`)
      .all();

    return (result.results as unknown[]).map(row => this.parseTodoFromDb(row));
  }

  /**
   * Compare multiple topics
   */
  async compareTopics(topicIds: string[]): Promise<TopicComparison> {
    const topicsData = await Promise.all(
      topicIds.map(async topicId => {
        const view = await this.getTopicAcrossProjects(topicId);
        const topicMeta = await this.getTopicMetadata(topicId);

        return {
          topic_id: topicId,
          name: topicMeta?.name || topicId,
          total_todos: view.statistics.total_todos,
          completed: view.statistics.completed,
          progress_percentage:
            view.statistics.total_todos > 0
              ? (view.statistics.completed / view.statistics.total_todos) * 100
              : 0,
          projects: Object.keys(view.todos_by_project),
        };
      }),
    );

    return {
      topics: topicsData,
      timestamp: Date.now(),
    };
  }

  /**
   * Get all topics worked on in a session
   */
  async getSessionTopics(sessionId: string): Promise<SessionTopicSummary> {
    const result = await this.db
      .prepare(
        `SELECT primary_topic, topics, project_id
         FROM todos
         WHERE deleted_at IS NULL
         AND session_id = ?`,
      )
      .bind(sessionId)
      .all();

    const todos = result.results as unknown[];

    // Aggregate topics
    const topicMap = new Map<string, { todos_count: number; projects: Set<string> }>();

    for (const row of todos) {
      const primaryTopic = (row as any).primary_topic;
      const topicsJson = (row as any).topics;
      const projectId = (row as any).project_id || 'unknown';

      const topics = topicsJson ? JSON.parse(topicsJson) : [primaryTopic];

      for (const topicId of topics) {
        if (!topicMap.has(topicId)) {
          topicMap.set(topicId, { todos_count: 0, projects: new Set() });
        }
        const entry = topicMap.get(topicId)!;
        entry.todos_count++;
        entry.projects.add(projectId);
      }
    }

    // Build summary
    const topicsArray = await Promise.all(
      Array.from(topicMap.entries()).map(async ([topic_id, data]) => {
        const meta = await this.getTopicMetadata(topic_id);
        return {
          topic_id,
          name: meta?.name || topic_id,
          todos_count: data.todos_count,
          projects: Array.from(data.projects),
        };
      }),
    );

    return {
      session_id: sessionId,
      topics: topicsArray.sort((a, b) => b.todos_count - a.todos_count),
      total_todos: todos.length,
      updated_at: Date.now(),
    };
  }

  /**
   * Aggregate topic across projects (update statistics)
   */
  async aggregateTopicAcrossProjects(topicId: string): Promise<void> {
    // Get all projects with this topic
    const projects = await this.getProjectsForTopic(topicId);

    // Collect todos from each project
    const allTodos: Todo[] = [];
    const byProject: Record<string, Todo[]> = {};

    for (const project of projects) {
      const todos = await this.getProjectTodosByTopic(project.project_id, topicId);
      allTodos.push(...todos);
      byProject[project.project_id] = todos;
    }

    // Calculate statistics
    const stats: TopicStats = {
      total_todos: allTodos.length,
      completed: allTodos.filter(t => t.status === 'completed').length,
      in_progress: allTodos.filter(t => t.status === 'in_progress').length,
      pending: allTodos.filter(t => t.status === 'pending').length,
      projects_count: projects.length,
    };

    // Update topic metadata
    const now = Date.now();
    await this.db
      .prepare(
        `UPDATE topics
         SET updated_at = ?,
             metadata = json_patch(
               metadata,
               json_object(
                 'projects', json(?),
                 'statistics', json(?),
                 'last_aggregated', ?
               )
             )
         WHERE topic_id = ?`,
      )
      .bind(
        now,
        JSON.stringify(
          projects.map(p => ({
            project_id: p.project_id,
            todos_count: p.todos_count,
            last_updated: p.last_updated,
          })),
        ),
        JSON.stringify(stats),
        now,
        topicId,
      )
      .run();
  }

  /**
   * Find cross-project topic alignments
   * Returns topics that span multiple projects
   */
  async findCrossProjectAlignments(
    minProjects: number = 2,
  ): Promise<
    {
      topic_id: string;
      name: string;
      projects: string[];
      total_todos: number;
    }[]
  > {
    const result = await this.db
      .prepare(
        `SELECT
           primary_topic as topic_id,
           COUNT(DISTINCT project_id) as project_count,
           COUNT(*) as todo_count,
           GROUP_CONCAT(DISTINCT project_id) as projects
         FROM todos
         WHERE deleted_at IS NULL
         AND project_id IS NOT NULL
         GROUP BY primary_topic
         HAVING project_count >= ?
         ORDER BY project_count DESC, todo_count DESC`,
      )
      .bind(minProjects)
      .all();

    return await Promise.all(
      (result.results as unknown[]).map(async (row: any) => {
        const meta = await this.getTopicMetadata(row.topic_id);
        return {
          topic_id: row.topic_id,
          name: meta?.name || row.topic_id,
          projects: row.projects.split(','),
          total_todos: row.todo_count,
        };
      }),
    );
  }

  /**
   * Get topic metadata from database
   */
  private async getTopicMetadata(
    topicId: string,
  ): Promise<{ name: string; description: string } | null> {
    const result = await this.db
      .prepare("SELECT name, description FROM topics WHERE topic_id = ?")
      .bind(topicId)
      .first();

    if (!result) {
      return null;
    }

    return {
      name: (result as any).name,
      description: (result as any).description,
    };
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
