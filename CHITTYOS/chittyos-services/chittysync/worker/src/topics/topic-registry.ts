/**
 * Topic Registry
 * Global registry for managing topics across projects
 *
 * Version: 1.0.0
 * Part of: Three-Tier Sync Architecture (Tier 3)
 */

import type { Env, Todo } from "../types";
import type { TopicMetadata } from "./topic-detector";
import { TOPIC_REGISTRY } from "./topic-detector";

/**
 * Topic statistics
 */
export interface TopicStats {
  total_todos: number;
  completed: number;
  in_progress: number;
  pending: number;
  projects_count: number;
}

/**
 * Project-specific topic info
 */
export interface ProjectTopicInfo {
  project_id: string;
  todos_count: number;
  last_updated: number;
}

/**
 * Complete topic view
 */
export interface TopicView {
  topic_id: string;
  name: string;
  description: string;
  keywords: string[];
  parent_topic?: string;
  projects: ProjectTopicInfo[];
  statistics: TopicStats;
  created_at: number;
  updated_at: number;
  related_topics: string[];
}

/**
 * Topic Dashboard
 */
export interface TopicDashboard {
  topic_id: string;
  name: string;
  description: string;
  projects: {
    project_id: string;
    project_name: string;
    todos_count: number;
    completed_count: number;
    progress_percentage: number;
  }[];
  total_todos: number;
  overall_progress: number;
  recent_todos: Todo[];
  recent_completions: Todo[];
  related_topics: {
    topic_id: string;
    relevance_score: number;
  }[];
}

/**
 * Topic Registry Manager
 */
export class TopicRegistry {
  constructor(
    private env: Env,
    private db: D1Database,
  ) {}

  /**
   * Get or create topic metadata
   */
  async getOrCreateTopic(topicId: string): Promise<TopicView | null> {
    // Check if topic exists in database
    const existing = await this.db
      .prepare("SELECT * FROM topics WHERE topic_id = ?")
      .bind(topicId)
      .first();

    if (existing) {
      return this.parseTopicFromDb(existing);
    }

    // Get metadata from registry
    const metadata = TOPIC_REGISTRY[topicId];
    if (!metadata) {
      return null;
    }

    // Create new topic
    const now = Date.now();
    await this.db
      .prepare(
        `INSERT INTO topics (topic_id, name, description, keywords, parent_topic_id, created_at, updated_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        metadata.topic_id,
        metadata.name,
        metadata.description,
        JSON.stringify(metadata.keywords),
        metadata.parent_topic || null,
        now,
        now,
        JSON.stringify({}),
      )
      .run();

    return await this.getTopic(topicId);
  }

  /**
   * Get topic by ID
   */
  async getTopic(topicId: string): Promise<TopicView | null> {
    const result = await this.db
      .prepare("SELECT * FROM topics WHERE topic_id = ?")
      .bind(topicId)
      .first();

    if (!result) {
      return null;
    }

    return this.parseTopicFromDb(result);
  }

  /**
   * List all topics
   */
  async listTopics(limit: number = 100): Promise<TopicView[]> {
    const result = await this.db
      .prepare("SELECT * FROM topics ORDER BY updated_at DESC LIMIT ?")
      .bind(limit)
      .all();

    return (result.results as unknown[]).map(row => this.parseTopicFromDb(row));
  }

  /**
   * Update topic statistics
   */
  async updateTopicStats(topicId: string): Promise<void> {
    // Get all todos for this topic
    const todosResult = await this.db
      .prepare(
        `SELECT status, project_id FROM todos
         WHERE deleted_at IS NULL
         AND (primary_topic = ? OR topics LIKE ?)`,
      )
      .bind(topicId, `%${topicId}%`)
      .all();

    const todos = todosResult.results as unknown[];

    // Calculate statistics
    const stats: TopicStats = {
      total_todos: todos.length,
      completed: todos.filter((t: any) => t.status === 'completed').length,
      in_progress: todos.filter((t: any) => t.status === 'in_progress').length,
      pending: todos.filter((t: any) => t.status === 'pending').length,
      projects_count: new Set(todos.map((t: any) => t.project_id).filter(Boolean)).size,
    };

    // Update topic metadata
    const now = Date.now();
    await this.db
      .prepare(
        `UPDATE topics
         SET updated_at = ?,
             metadata = json_patch(metadata, ?)
         WHERE topic_id = ?`,
      )
      .bind(now, JSON.stringify({ statistics: stats }), topicId)
      .run();
  }

  /**
   * Get or create project-topic association
   */
  async associateProjectWithTopic(
    projectId: string,
    topicId: string,
  ): Promise<void> {
    // Ensure topic exists
    await this.getOrCreateTopic(topicId);

    // Check if association exists
    const existing = await this.db
      .prepare(
        "SELECT * FROM project_topics WHERE project_id = ? AND topic_id = ?",
      )
      .bind(projectId, topicId)
      .first();

    const now = Date.now();

    if (existing) {
      // Update last_updated
      await this.db
        .prepare(
          "UPDATE project_topics SET last_updated = ? WHERE project_id = ? AND topic_id = ?",
        )
        .bind(now, projectId, topicId)
        .run();
    } else {
      // Create new association
      await this.db
        .prepare(
          `INSERT INTO project_topics (project_id, topic_id, todos_count, last_updated)
           VALUES (?, ?, 0, ?)`,
        )
        .bind(projectId, topicId, now)
        .run();
    }

    // Update todo count
    await this.updateProjectTopicCount(projectId, topicId);
  }

  /**
   * Update todo count for project-topic
   */
  async updateProjectTopicCount(
    projectId: string,
    topicId: string,
  ): Promise<void> {
    // Count todos for this project and topic
    const result = await this.db
      .prepare(
        `SELECT COUNT(*) as count FROM todos
         WHERE deleted_at IS NULL
         AND project_id = ?
         AND (primary_topic = ? OR topics LIKE ?)`,
      )
      .bind(projectId, topicId, `%${topicId}%`)
      .first();

    const count = (result as any)?.count || 0;
    const now = Date.now();

    await this.db
      .prepare(
        `UPDATE project_topics
         SET todos_count = ?, last_updated = ?
         WHERE project_id = ? AND topic_id = ?`,
      )
      .bind(count, now, projectId, topicId)
      .run();
  }

  /**
   * Get topics for a project
   */
  async getProjectTopics(projectId: string): Promise<TopicView[]> {
    const result = await this.db
      .prepare(
        `SELECT t.* FROM topics t
         JOIN project_topics pt ON t.topic_id = pt.topic_id
         WHERE pt.project_id = ?
         ORDER BY pt.todos_count DESC`,
      )
      .bind(projectId)
      .all();

    return (result.results as unknown[]).map(row => this.parseTopicFromDb(row));
  }

  /**
   * Get projects for a topic
   */
  async getTopicProjects(topicId: string): Promise<ProjectTopicInfo[]> {
    const result = await this.db
      .prepare(
        `SELECT project_id, todos_count, last_updated
         FROM project_topics
         WHERE topic_id = ?
         ORDER BY todos_count DESC`,
      )
      .bind(topicId)
      .all();

    return (result.results as unknown[]).map(row => ({
      project_id: (row as any).project_id,
      todos_count: (row as any).todos_count,
      last_updated: (row as any).last_updated,
    }));
  }

  /**
   * Get topic dashboard view
   */
  async getTopicDashboard(topicId: string): Promise<TopicDashboard | null> {
    const topic = await this.getTopic(topicId);
    if (!topic) {
      return null;
    }

    // Get todos by project
    const todosByProject = await this.db
      .prepare(
        `SELECT project_id, status, id, content, created_at, updated_at
         FROM todos
         WHERE deleted_at IS NULL
         AND (primary_topic = ? OR topics LIKE ?)
         ORDER BY updated_at DESC`,
      )
      .bind(topicId, `%${topicId}%`)
      .all();

    const todos = todosByProject.results as unknown[];

    // Group by project
    const projectMap = new Map<string, any[]>();
    for (const todo of todos) {
      const projectId = (todo as any).project_id || 'unknown';
      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, []);
      }
      projectMap.get(projectId)!.push(todo);
    }

    // Build project statistics
    const projects = Array.from(projectMap.entries()).map(
      ([project_id, todos]) => {
        const completed_count = todos.filter(
          (t: any) => t.status === 'completed',
        ).length;
        return {
          project_id,
          project_name: project_id,
          todos_count: todos.length,
          completed_count,
          progress_percentage:
            todos.length > 0 ? (completed_count / todos.length) * 100 : 0,
        };
      },
    );

    // Recent todos
    const recent_todos = todos
      .sort((a: any, b: any) => b.created_at - a.created_at)
      .slice(0, 10) as Todo[];

    // Recent completions
    const recent_completions = todos
      .filter((t: any) => t.status === 'completed')
      .sort((a: any, b: any) => b.updated_at - a.updated_at)
      .slice(0, 10) as Todo[];

    // Calculate overall progress
    const total_todos = todos.length;
    const completed_count = todos.filter(
      (t: any) => t.status === 'completed',
    ).length;
    const overall_progress =
      total_todos > 0 ? (completed_count / total_todos) * 100 : 0;

    // Get related topics (topics that co-occur)
    const related_topics = await this.findRelatedTopics(topicId);

    return {
      topic_id: topic.topic_id,
      name: topic.name,
      description: topic.description,
      projects,
      total_todos,
      overall_progress,
      recent_todos,
      recent_completions,
      related_topics,
    };
  }

  /**
   * Find related topics based on co-occurrence
   */
  async findRelatedTopics(
    topicId: string,
  ): Promise<{ topic_id: string; relevance_score: number }[]> {
    // Find todos with this topic
    const todosResult = await this.db
      .prepare(
        `SELECT topics FROM todos
         WHERE deleted_at IS NULL
         AND (primary_topic = ? OR topics LIKE ?)`,
      )
      .bind(topicId, `%${topicId}%`)
      .all();

    const todos = todosResult.results as unknown[];

    // Count co-occurrences
    const cooccurrence = new Map<string, number>();
    for (const todo of todos) {
      const topics = JSON.parse((todo as any).topics || '[]') as string[];
      for (const otherTopic of topics) {
        if (otherTopic !== topicId) {
          cooccurrence.set(otherTopic, (cooccurrence.get(otherTopic) || 0) + 1);
        }
      }
    }

    // Calculate relevance scores
    const totalTodos = todos.length;
    const related = Array.from(cooccurrence.entries())
      .map(([topic_id, count]) => ({
        topic_id,
        relevance_score: count / totalTodos,
      }))
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, 10);

    return related;
  }

  /**
   * Create topic relationship
   */
  async createTopicRelationship(
    topicAId: string,
    topicBId: string,
    relationshipType: string = 'related',
    strength: number = 0.5,
  ): Promise<void> {
    const now = Date.now();

    // Ensure both topics exist
    await this.getOrCreateTopic(topicAId);
    await this.getOrCreateTopic(topicBId);

    // Insert relationship
    await this.db
      .prepare(
        `INSERT OR REPLACE INTO topic_relationships
         (topic_a_id, topic_b_id, relationship_type, strength, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(topicAId, topicBId, relationshipType, strength, now)
      .run();
  }

  /**
   * Parse topic from database row
   */
  private parseTopicFromDb(row: unknown): TopicView {
    const r = row as Record<string, unknown>;
    const metadata = r.metadata ? JSON.parse(r.metadata as string) : {};

    return {
      topic_id: r.topic_id as string,
      name: r.name as string,
      description: r.description as string,
      keywords: r.keywords ? JSON.parse(r.keywords as string) : [],
      parent_topic: r.parent_topic_id as string | undefined,
      projects: metadata.projects || [],
      statistics: metadata.statistics || {
        total_todos: 0,
        completed: 0,
        in_progress: 0,
        pending: 0,
        projects_count: 0,
      },
      created_at: r.created_at as number,
      updated_at: r.updated_at as number,
      related_topics: metadata.related_topics || [],
    };
  }
}
