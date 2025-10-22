/**
 * Topic API Routes Handler
 * Handles all topic-related HTTP endpoints
 *
 * Version: 1.0.0
 * Part of: Three-Tier Sync Architecture (Tier 3)
 */

import type { Env, ApiResponse } from "../types";
import { jsonResponse } from "../auth";
import { topicDetector } from "./topic-detector";
import { TopicRegistry } from "./topic-registry";
import { CrossProjectTracker } from "./cross-project-tracker";
import type { TopicView, TopicDashboard } from "./topic-registry";
import type { CrossProjectTopicView, TopicComparison, SessionTopicSummary } from "./cross-project-tracker";

/**
 * Route topic-related requests
 */
export async function handleTopicRequest(
  request: Request,
  env: Env,
  pathname: string,
): Promise<Response | null> {
  const registry = new TopicRegistry(env, env.DB);
  const tracker = new CrossProjectTracker(env, env.DB);

  // POST /api/topics - Create or register topic
  if (pathname === "/api/topics" && request.method === "POST") {
    return await handleCreateTopic(request, registry);
  }

  // GET /api/topics - List all topics
  if (pathname === "/api/topics" && request.method === "GET") {
    return await handleListTopics(request, registry);
  }

  // GET /api/topics/:topic_id - Get topic metadata
  const getTopicMatch = pathname.match(/^\/api\/topics\/([^\/]+)$/);
  if (getTopicMatch && request.method === "GET") {
    return await handleGetTopic(getTopicMatch[1], registry);
  }

  // GET /api/topics/:topic_id/todos - Get todos for topic
  const getTodosMatch = pathname.match(/^\/api\/topics\/([^\/]+)\/todos$/);
  if (getTodosMatch && request.method === "GET") {
    return await handleGetTopicTodos(getTodosMatch[1], request, tracker);
  }

  // GET /api/topics/:topic_id/projects - Get projects for topic
  const getProjectsMatch = pathname.match(/^\/api\/topics\/([^\/]+)\/projects$/);
  if (getProjectsMatch && request.method === "GET") {
    return await handleGetTopicProjects(getProjectsMatch[1], tracker);
  }

  // GET /api/topics/:topic_id/dashboard - Get topic dashboard
  const getDashboardMatch = pathname.match(/^\/api\/topics\/([^\/]+)\/dashboard$/);
  if (getDashboardMatch && request.method === "GET") {
    return await handleGetTopicDashboard(getDashboardMatch[1], registry);
  }

  // POST /api/topics/:topic_id/relationships - Create topic relationship
  const relationshipMatch = pathname.match(/^\/api\/topics\/([^\/]+)\/relationships$/);
  if (relationshipMatch && request.method === "POST") {
    return await handleCreateTopicRelationship(relationshipMatch[1], request, registry);
  }

  // GET /api/topics/compare - Compare multiple topics
  if (pathname === "/api/topics/compare" && request.method === "GET") {
    return await handleCompareTopics(request, tracker);
  }

  // GET /api/projects/:project_id/topics - Get topics for project
  const projectTopicsMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/topics$/);
  if (projectTopicsMatch && request.method === "GET") {
    return await handleGetProjectTopics(projectTopicsMatch[1], registry);
  }

  // GET /api/projects/:project_id/topics/:topic_id - Get todos for topic in project
  const projectTopicTodosMatch = pathname.match(/^\/api\/projects\/([^\/]+)\/topics\/([^\/]+)$/);
  if (projectTopicTodosMatch && request.method === "GET") {
    return await handleGetProjectTopicTodos(
      projectTopicTodosMatch[1],
      projectTopicTodosMatch[2],
      tracker,
    );
  }

  // GET /api/sessions/:session_id/topics - Get topics for session
  const sessionTopicsMatch = pathname.match(/^\/api\/sessions\/([^\/]+)\/topics$/);
  if (sessionTopicsMatch && request.method === "GET") {
    return await handleGetSessionTopics(sessionTopicsMatch[1], tracker);
  }

  // GET /api/topics/alignments - Find cross-project topic alignments
  if (pathname === "/api/topics/alignments" && request.method === "GET") {
    return await handleGetTopicAlignments(request, tracker);
  }

  // POST /api/topics/detect - Detect topics from text
  if (pathname === "/api/topics/detect" && request.method === "POST") {
    return await handleDetectTopics(request);
  }

  // No match
  return null;
}

/**
 * POST /api/topics - Create or register topic
 */
async function handleCreateTopic(
  request: Request,
  registry: TopicRegistry,
): Promise<Response> {
  try {
    const body = await request.json() as {
      topic_id: string;
      name: string;
      description?: string;
      keywords?: string[];
    };

    if (!body.topic_id || !body.name) {
      return jsonResponse<ApiResponse>(
        {
          success: false,
          error: "Missing required fields: topic_id, name",
          timestamp: Date.now(),
        },
        400,
      );
    }

    const topic = await registry.getOrCreateTopic(body.topic_id);

    return jsonResponse<ApiResponse<TopicView>>({
      success: true,
      data: topic || undefined,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Create topic error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create topic",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * GET /api/topics - List all topics
 */
async function handleListTopics(
  request: Request,
  registry: TopicRegistry,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");

    const topics = await registry.listTopics(limit);

    return jsonResponse<ApiResponse<TopicView[]>>({
      success: true,
      data: topics,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("List topics error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list topics",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * GET /api/topics/:topic_id - Get topic metadata
 */
async function handleGetTopic(
  topicId: string,
  registry: TopicRegistry,
): Promise<Response> {
  try {
    const topic = await registry.getTopic(topicId);

    if (!topic) {
      return jsonResponse<ApiResponse>(
        {
          success: false,
          error: "Topic not found",
          timestamp: Date.now(),
        },
        404,
      );
    }

    return jsonResponse<ApiResponse<TopicView>>({
      success: true,
      data: topic,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Get topic error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get topic",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * GET /api/topics/:topic_id/todos - Get todos for topic
 */
async function handleGetTopicTodos(
  topicId: string,
  request: Request,
  tracker: CrossProjectTracker,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("project_id");

    if (projectId) {
      // Get todos for specific project
      const todos = await tracker.getProjectTodosByTopic(projectId, topicId);
      return jsonResponse<ApiResponse>({
        success: true,
        data: todos,
        timestamp: Date.now(),
      });
    } else {
      // Get todos across all projects
      const view = await tracker.getTopicAcrossProjects(topicId);
      return jsonResponse<ApiResponse<CrossProjectTopicView>>({
        success: true,
        data: view,
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    console.error("Get topic todos error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get todos",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * GET /api/topics/:topic_id/projects - Get projects for topic
 */
async function handleGetTopicProjects(
  topicId: string,
  tracker: CrossProjectTracker,
): Promise<Response> {
  try {
    const projects = await tracker.getProjectsForTopic(topicId);

    return jsonResponse<ApiResponse>({
      success: true,
      data: projects,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Get topic projects error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get projects",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * GET /api/topics/:topic_id/dashboard - Get topic dashboard
 */
async function handleGetTopicDashboard(
  topicId: string,
  registry: TopicRegistry,
): Promise<Response> {
  try {
    const dashboard = await registry.getTopicDashboard(topicId);

    if (!dashboard) {
      return jsonResponse<ApiResponse>(
        {
          success: false,
          error: "Topic not found",
          timestamp: Date.now(),
        },
        404,
      );
    }

    return jsonResponse<ApiResponse<TopicDashboard>>({
      success: true,
      data: dashboard,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Get topic dashboard error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get dashboard",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * POST /api/topics/:topic_id/relationships - Create topic relationship
 */
async function handleCreateTopicRelationship(
  topicId: string,
  request: Request,
  registry: TopicRegistry,
): Promise<Response> {
  try {
    const body = await request.json() as {
      related_topic_id: string;
      relationship_type?: string;
      strength?: number;
    };

    if (!body.related_topic_id) {
      return jsonResponse<ApiResponse>(
        {
          success: false,
          error: "Missing required field: related_topic_id",
          timestamp: Date.now(),
        },
        400,
      );
    }

    await registry.createTopicRelationship(
      topicId,
      body.related_topic_id,
      body.relationship_type || "related",
      body.strength || 0.5,
    );

    return jsonResponse<ApiResponse>({
      success: true,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Create topic relationship error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create relationship",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * GET /api/topics/compare - Compare multiple topics
 */
async function handleCompareTopics(
  request: Request,
  tracker: CrossProjectTracker,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const topicsParam = url.searchParams.get("topics");

    if (!topicsParam) {
      return jsonResponse<ApiResponse>(
        {
          success: false,
          error: "Missing required parameter: topics",
          timestamp: Date.now(),
        },
        400,
      );
    }

    const topicIds = topicsParam.split(",").map(t => t.trim());
    const comparison = await tracker.compareTopics(topicIds);

    return jsonResponse<ApiResponse<TopicComparison>>({
      success: true,
      data: comparison,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Compare topics error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to compare topics",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * GET /api/projects/:project_id/topics - Get topics for project
 */
async function handleGetProjectTopics(
  projectId: string,
  registry: TopicRegistry,
): Promise<Response> {
  try {
    const topics = await registry.getProjectTopics(projectId);

    return jsonResponse<ApiResponse<TopicView[]>>({
      success: true,
      data: topics,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Get project topics error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get project topics",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * GET /api/projects/:project_id/topics/:topic_id - Get todos for topic in project
 */
async function handleGetProjectTopicTodos(
  projectId: string,
  topicId: string,
  tracker: CrossProjectTracker,
): Promise<Response> {
  try {
    const todos = await tracker.getProjectTodosByTopic(projectId, topicId);

    return jsonResponse<ApiResponse>({
      success: true,
      data: todos,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Get project topic todos error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get todos",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * GET /api/sessions/:session_id/topics - Get topics for session
 */
async function handleGetSessionTopics(
  sessionId: string,
  tracker: CrossProjectTracker,
): Promise<Response> {
  try {
    const summary = await tracker.getSessionTopics(sessionId);

    return jsonResponse<ApiResponse<SessionTopicSummary>>({
      success: true,
      data: summary,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Get session topics error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get session topics",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * GET /api/topics/alignments - Find cross-project topic alignments
 */
async function handleGetTopicAlignments(
  request: Request,
  tracker: CrossProjectTracker,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const minProjects = parseInt(url.searchParams.get("min_projects") || "2");

    const alignments = await tracker.findCrossProjectAlignments(minProjects);

    return jsonResponse<ApiResponse>({
      success: true,
      data: alignments,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Get topic alignments error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get alignments",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * POST /api/topics/detect - Detect topics from text
 */
async function handleDetectTopics(request: Request): Promise<Response> {
  try {
    const body = await request.json() as {
      content: string;
      active_form?: string;
      project_id?: string;
    };

    if (!body.content) {
      return jsonResponse<ApiResponse>(
        {
          success: false,
          error: "Missing required field: content",
          timestamp: Date.now(),
        },
        400,
      );
    }

    // Create pseudo todo for detection
    const pseudoTodo = {
      id: "temp",
      content: body.content,
      status: "pending" as const,
      active_form: body.active_form,
      platform: "custom" as const,
      created_at: Date.now(),
      updated_at: Date.now(),
      metadata: body.project_id ? { project_id: body.project_id } : undefined,
    };

    const result = await topicDetector.detectTopics(pseudoTodo, body.project_id);

    return jsonResponse<ApiResponse>({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Detect topics error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to detect topics",
        timestamp: Date.now(),
      },
      500,
    );
  }
}
