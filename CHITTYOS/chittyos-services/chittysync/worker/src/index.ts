/**
 * ChittyOS Todo Sync Hub - Main Worker Entry Point
 * Version: 1.0.0
 * Deployment: gateway.chitty.cc/api/todos
 */

import type {
  Env,
  Todo,
  CreateTodoRequest,
  UpdateTodoRequest,
  ApiResponse,
  HealthCheckResponse,
  BulkSyncRequest,
  BulkSyncResponse,
  SyncLogEntry,
  TodoPlatform,
} from "./types";
import { ChittyIdClient } from "./chittyid-client";
import {
  requireAuth,
  jsonResponse,
  handleCors,
  extractBearerToken,
} from "./auth";
import {
  MemorySyncOrchestrator,
  type MemorySyncRequest,
  type MemorySyncResponse,
  type AgentMemory,
} from "./memory-sync";
import {
  handleCreateDirection,
  handleClaimDirection,
  handleCompleteDirection,
} from "./integrations/claude-code";
import { SessionRegistry } from "./sessions/session-registry";
import { SessionSync } from "./sessions/session-sync";
import { ProjectSyncOrchestrator } from "./projects/project-sync";
import { GitIntegrationService } from "./projects/git-integration";
import { handleTopicRequest } from "./topics/topic-routes";
import { topicDetector } from "./topics/topic-detector";
import { TopicRegistry } from "./topics/topic-registry";
import type {
  RegisterSessionRequest,
  SessionSyncRequest,
  ProjectConsolidationRequest,
  ProjectConsolidationResponse,
} from "./types";
import { OPENAPI_YAML } from "./docs/openapi.yaml";
import { HTML_DOCS } from "./docs/html-docs";

/**
 * Main request handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return handleCors();
    }

    // Health check endpoint - no auth required
    if (url.pathname === "/api/todos/health" && request.method === "GET") {
      return handleHealthCheck(env);
    }

    // Documentation endpoints - no auth required
    if (url.pathname === "/docs" && request.method === "GET") {
      return new Response(HTML_DOCS, {
        headers: {
          "Content-Type": "text/html",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (url.pathname === "/docs/openapi.yaml" && request.method === "GET") {
      return new Response(OPENAPI_YAML, {
        headers: {
          "Content-Type": "text/yaml",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (url.pathname === "/docs/openapi.json" && request.method === "GET") {
      // Convert YAML to JSON (simple string replacement for this use case)
      const json = convertYamlToJson(OPENAPI_YAML);
      return new Response(json, {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // All other endpoints require authentication
    const authError = requireAuth(request, env.CHITTY_ID_TOKEN);
    if (authError) {
      return authError;
    }

    // Route to appropriate handler
    try {
      // POST /api/todos - Create todo
      if (url.pathname === "/api/todos" && request.method === "POST") {
        return await handleCreateTodo(request, env);
      }

      // GET /api/todos - List all todos
      if (url.pathname === "/api/todos" && request.method === "GET") {
        return await handleListTodos(request, env);
      }

      // GET /api/todos/:id - Get single todo
      const getTodoMatch = url.pathname.match(/^\/api\/todos\/([^\/]+)$/);
      if (getTodoMatch && request.method === "GET") {
        return await handleGetTodo(getTodoMatch[1], env);
      }

      // PUT /api/todos/:id - Update todo
      const updateTodoMatch = url.pathname.match(/^\/api\/todos\/([^\/]+)$/);
      if (updateTodoMatch && request.method === "PUT") {
        return await handleUpdateTodo(updateTodoMatch[1], request, env);
      }

      // DELETE /api/todos/:id - Delete todo
      const deleteTodoMatch = url.pathname.match(/^\/api\/todos\/([^\/]+)$/);
      if (deleteTodoMatch && request.method === "DELETE") {
        return await handleDeleteTodo(deleteTodoMatch[1], env);
      }

      // GET /api/todos/since/:timestamp - Delta sync
      const sinceMatch = url.pathname.match(/^\/api\/todos\/since\/(\d+)$/);
      if (sinceMatch && request.method === "GET") {
        return await handleGetTodosSince(parseInt(sinceMatch[1]), env);
      }

      // POST /api/todos/sync - Bulk sync
      if (url.pathname === "/api/todos/sync" && request.method === "POST") {
        return await handleBulkSync(request, env);
      }

      // POST /api/memory/sync - Sync agent memory
      if (url.pathname === "/api/memory/sync" && request.method === "POST") {
        return await handleMemorySync(request, env);
      }

      // GET /api/memory/:agent_id/:session_id - Pull agent memory
      const memoryMatch = url.pathname.match(
        /^\/api\/memory\/([^\/]+)\/([^\/]+)$/,
      );
      if (memoryMatch && request.method === "GET") {
        return await handleMemoryPull(
          memoryMatch[1],
          memoryMatch[2],
          url.searchParams,
          env,
        );
      }

      // === Claude Code Directions Integration ===
      // POST /api/directions - enqueue a direction
      if (url.pathname === "/api/directions" && request.method === "POST") {
        return await handleCreateDirection(request, env);
      }

      // POST /api/directions/claim - claim next direction for an agent
      if (url.pathname === "/api/directions/claim" && request.method === "POST") {
        return await handleClaimDirection(request, env);
      }

      // POST /api/directions/:id/complete - complete or fail a direction
      const completeMatch = url.pathname.match(/^\/api\/directions\/([^\/]+)\/complete$/);
      if (completeMatch && request.method === "POST") {
        return await handleCompleteDirection(completeMatch[1], request, env);
      }

      // === Session Sync Endpoints (Tier 1) ===
      // POST /api/sessions/register - register or update session
      if (url.pathname === "/api/sessions/register" && request.method === "POST") {
        return await handleRegisterSession(request, env);
      }

      // POST /api/sessions/:id/sync - sync session to project canonical state
      const sessionSyncMatch = url.pathname.match(/^\/api\/sessions\/([^\/]+)\/sync$/);
      if (sessionSyncMatch && request.method === "POST") {
        return await handleSessionSync(sessionSyncMatch[1], request, env);
      }

      // GET /api/sessions/:id - get session details
      const getSessionMatch = url.pathname.match(/^\/api\/sessions\/([^\/]+)$/);
      if (getSessionMatch && request.method === "GET") {
        return await handleGetSession(getSessionMatch[1], env);
      }

      // GET /api/projects/:id/sessions - get all sessions for project
      const projectSessionsMatch = url.pathname.match(/^\/api\/projects\/([^\/]+)\/sessions$/);
      if (projectSessionsMatch && request.method === "GET") {
        return await handleGetProjectSessions(projectSessionsMatch[1], env);
      }

      // GET /api/projects/:id/canonical - get project canonical state
      const projectCanonicalMatch = url.pathname.match(/^\/api\/projects\/([^\/]+)\/canonical$/);
      if (projectCanonicalMatch && request.method === "GET") {
        return await handleGetProjectCanonical(projectCanonicalMatch[1], env);
      }

      // POST /api/sessions/:id/end - end a session
      const endSessionMatch = url.pathname.match(/^\/api\/sessions\/([^\/]+)\/end$/);
      if (endSessionMatch && request.method === "POST") {
        return await handleEndSession(endSessionMatch[1], env);
      }

      // === Project Sync Endpoints (Tier 2) ===
      // POST /api/projects/:id/consolidate - consolidate all sessions into canonical state
      const consolidateMatch = url.pathname.match(/^\/api\/projects\/([^\/]+)\/consolidate$/);
      if (consolidateMatch && request.method === "POST") {
        return await handleProjectConsolidate(consolidateMatch[1], request, env);
      }

      // GET /api/projects/:id/canonical-state - get canonical project state
      const canonicalStateMatch = url.pathname.match(/^\/api\/projects\/([^\/]+)\/canonical-state$/);
      if (canonicalStateMatch && request.method === "GET") {
        return await handleGetCanonicalState(canonicalStateMatch[1], env);
      }

      // === Topic Sync Endpoints (Tier 3) ===
      // Try topic routes handler
      const topicResponse = await handleTopicRequest(request, env, url.pathname);
      if (topicResponse) {
        return topicResponse;
      }

      // No matching route
      return jsonResponse<ApiResponse>(
        {
          success: false,
          error: "Not Found",
          timestamp: Date.now(),
        },
        404,
      );
    } catch (error) {
      console.error("Request handler error:", error);
      return jsonResponse<ApiResponse>(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Internal Server Error",
          timestamp: Date.now(),
        },
        500,
      );
    }
  },
};

/**
 * Simple YAML to JSON converter for OpenAPI spec
 */
function convertYamlToJson(yaml: string): string {
  // For OpenAPI spec, we can use a simple heuristic conversion
  // This is a minimal implementation that handles the basic structure
  try {
    // Parse YAML manually (basic implementation)
    const lines = yaml.split('\n');
    const result: any = {};
    let current: any = result;
    const stack: any[] = [result];
    let lastIndent = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const indent = line.search(/\S/);
      const [key, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();

      if (indent < lastIndent) {
        stack.pop();
        current = stack[stack.length - 1];
      }

      if (value) {
        current[key] = value;
      } else {
        current[key] = {};
        stack.push(current[key]);
        current = current[key];
      }

      lastIndent = indent;
    }

    return JSON.stringify(result, null, 2);
  } catch (e) {
    // Fallback: return a basic JSON structure
    return JSON.stringify({
      openapi: "3.0.3",
      info: {
        title: "ChittySync Hub API",
        version: "2.2.0",
        description: "See /docs/openapi.yaml for full specification"
      },
      servers: [
        { url: "https://sync.chitty.cc", description: "Production" },
        { url: "https://gateway.chitty.cc/api/todos", description: "Gateway" }
      ],
      paths: {
        "/docs/openapi.yaml": {
          description: "Download full OpenAPI YAML specification"
        }
      }
    }, null, 2);
  }
}

/**
 * Health check endpoint
 */
async function handleHealthCheck(env: Env): Promise<Response> {
  const dbStart = Date.now();
  let dbConnected = false;
  let dbLatency: number | undefined;

  try {
    await env.DB.prepare("SELECT 1").first();
    dbConnected = true;
    dbLatency = Date.now() - dbStart;
  } catch (error) {
    console.error("Database health check failed:", error);
  }

  const chittyIdClient = new ChittyIdClient(
    env.CHITTYID_SERVICE_URL,
    env.CHITTY_ID_TOKEN,
  );
  const chittyIdHealth = await chittyIdClient.healthCheck();

  const status: HealthCheckResponse["status"] =
    dbConnected && chittyIdHealth.reachable
      ? "healthy"
      : dbConnected || chittyIdHealth.reachable
        ? "degraded"
        : "unhealthy";

  const response: HealthCheckResponse = {
    status,
    service: env.SERVICE_NAME,
    version: env.SERVICE_VERSION,
    environment: env.CHITTYOS_ENVIRONMENT,
    timestamp: Date.now(),
    database: {
      connected: dbConnected,
      latency_ms: dbLatency,
    },
    chittyid: chittyIdHealth,
  };

  return jsonResponse(response);
}

/**
 * POST /api/todos - Create new todo
 */
async function handleCreateTodo(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as CreateTodoRequest;

    // Validate required fields
    if (!body.content || !body.status) {
      return jsonResponse<ApiResponse>(
        {
          success: false,
          error: "Missing required fields: content, status",
          timestamp: Date.now(),
        },
        400,
      );
    }

    // Validate status
    if (!["pending", "in_progress", "completed"].includes(body.status)) {
      return jsonResponse<ApiResponse>(
        {
          success: false,
          error: "Invalid status. Must be: pending, in_progress, or completed",
          timestamp: Date.now(),
        },
        400,
      );
    }

    // Mint ChittyID
    const chittyIdClient = new ChittyIdClient(env.CHITTYID_SERVICE_URL);
    const bearerToken = extractBearerToken(request);

    const chittyId = await chittyIdClient.mint(
      "todo",
      "task",
      {
        content: body.content,
        status: body.status,
        platform: body.platform || "custom",
        ...body.metadata,
      },
      bearerToken || undefined,
    );

    const now = Date.now();
    const platform: TodoPlatform = body.platform || "custom";

    const todo: Todo = {
      id: chittyId.id,
      content: body.content,
      status: body.status,
      active_form: body.active_form,
      platform,
      session_id: body.session_id,
      agent_id: body.agent_id,
      created_at: now,
      updated_at: now,
      metadata: body.metadata,
    };

    // Auto-detect topics (Tier 3 integration)
    const projectId = body.metadata?.project_id as string | undefined;
    const topicDetection = await topicDetector.detectTopics(todo, projectId);
    const topics = topicDetection.topics;
    const primaryTopic = topicDetection.primary_topic;

    // Insert into database with topic information
    await env.DB.prepare(
      `INSERT INTO todos (id, content, status, active_form, platform, session_id, agent_id, created_at, updated_at, metadata, primary_topic, topics, project_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        todo.id,
        todo.content,
        todo.status,
        todo.active_form || null,
        todo.platform,
        todo.session_id || null,
        todo.agent_id || null,
        todo.created_at,
        todo.updated_at,
        todo.metadata ? JSON.stringify(todo.metadata) : null,
        primaryTopic,
        JSON.stringify(topics),
        projectId || null,
      )
      .run();

    // Update topic registry and associations
    if (projectId) {
      const topicRegistry = new TopicRegistry(env, env.DB);
      for (const topicId of topics) {
        await topicRegistry.associateProjectWithTopic(projectId, topicId);
      }
    }

    // Log sync action
    await logSyncAction(env, todo.id, "create", platform, false);

    return jsonResponse<ApiResponse<Todo>>(
      {
        success: true,
        data: todo,
        timestamp: Date.now(),
      },
      201,
    );
  } catch (error) {
    console.error("Create todo error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create todo",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * GET /api/todos - List all todos
 */
async function handleListTodos(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const platform = url.searchParams.get("platform");
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    let query = "SELECT * FROM todos WHERE deleted_at IS NULL";
    const bindings: unknown[] = [];

    if (platform) {
      query += " AND platform = ?";
      bindings.push(platform);
    }

    if (status) {
      query += " AND status = ?";
      bindings.push(status);
    }

    query += " ORDER BY updated_at DESC LIMIT ? OFFSET ?";
    bindings.push(limit, offset);

    const result = await env.DB.prepare(query)
      .bind(...bindings)
      .all();

    const todos: Todo[] = (result.results as unknown[]).map((row: unknown) =>
      parseTodoFromDb(row),
    );

    return jsonResponse<ApiResponse<Todo[]>>({
      success: true,
      data: todos,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("List todos error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list todos",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * GET /api/todos/:id - Get single todo
 */
async function handleGetTodo(id: string, env: Env): Promise<Response> {
  try {
    const result = await env.DB.prepare(
      "SELECT * FROM todos WHERE id = ? AND deleted_at IS NULL",
    )
      .bind(id)
      .first();

    if (!result) {
      return jsonResponse<ApiResponse>(
        {
          success: false,
          error: "Todo not found",
          timestamp: Date.now(),
        },
        404,
      );
    }

    const todo = parseTodoFromDb(result);

    return jsonResponse<ApiResponse<Todo>>({
      success: true,
      data: todo,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Get todo error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get todo",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * PUT /api/todos/:id - Update todo
 */
async function handleUpdateTodo(
  id: string,
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = (await request.json()) as UpdateTodoRequest;

    // Check if todo exists
    const existing = await env.DB.prepare(
      "SELECT * FROM todos WHERE id = ? AND deleted_at IS NULL",
    )
      .bind(id)
      .first();

    if (!existing) {
      return jsonResponse<ApiResponse>(
        {
          success: false,
          error: "Todo not found",
          timestamp: Date.now(),
        },
        404,
      );
    }

    // Build update query dynamically
    const updates: string[] = [];
    const bindings: unknown[] = [];

    if (body.content !== undefined) {
      updates.push("content = ?");
      bindings.push(body.content);
    }

    if (body.status !== undefined) {
      if (!["pending", "in_progress", "completed"].includes(body.status)) {
        return jsonResponse<ApiResponse>(
          {
            success: false,
            error:
              "Invalid status. Must be: pending, in_progress, or completed",
            timestamp: Date.now(),
          },
          400,
        );
      }
      updates.push("status = ?");
      bindings.push(body.status);
    }

    if (body.active_form !== undefined) {
      updates.push("active_form = ?");
      bindings.push(body.active_form);
    }

    if (body.metadata !== undefined) {
      updates.push("metadata = ?");
      bindings.push(JSON.stringify(body.metadata));
    }

    // Always update updated_at
    updates.push("updated_at = ?");
    const now = Date.now();
    bindings.push(now);

    // Add id for WHERE clause
    bindings.push(id);

    await env.DB.prepare(`UPDATE todos SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...bindings)
      .run();

    // Fetch updated todo
    const result = await env.DB.prepare("SELECT * FROM todos WHERE id = ?")
      .bind(id)
      .first();

    const todo = parseTodoFromDb(result);

    // Log sync action
    await logSyncAction(env, id, "update", todo.platform, false);

    return jsonResponse<ApiResponse<Todo>>({
      success: true,
      data: todo,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Update todo error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update todo",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * DELETE /api/todos/:id - Soft delete todo
 */
async function handleDeleteTodo(id: string, env: Env): Promise<Response> {
  try {
    // Check if todo exists
    const existing = await env.DB.prepare(
      "SELECT * FROM todos WHERE id = ? AND deleted_at IS NULL",
    )
      .bind(id)
      .first();

    if (!existing) {
      return jsonResponse<ApiResponse>(
        {
          success: false,
          error: "Todo not found",
          timestamp: Date.now(),
        },
        404,
      );
    }

    const existingTodo = parseTodoFromDb(existing);
    const now = Date.now();

    // Soft delete
    await env.DB.prepare(
      "UPDATE todos SET deleted_at = ?, updated_at = ? WHERE id = ?",
    )
      .bind(now, now, id)
      .run();

    // Log sync action
    await logSyncAction(env, id, "delete", existingTodo.platform, false);

    return jsonResponse<ApiResponse>(
      {
        success: true,
        timestamp: Date.now(),
      },
      204,
    );
  } catch (error) {
    console.error("Delete todo error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete todo",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * GET /api/todos/since/:timestamp - Get todos updated since timestamp
 */
async function handleGetTodosSince(since: number, env: Env): Promise<Response> {
  try {
    const result = await env.DB.prepare(
      "SELECT * FROM todos WHERE updated_at > ? ORDER BY updated_at ASC",
    )
      .bind(since)
      .all();

    const todos: Todo[] = (result.results as unknown[]).map((row: unknown) =>
      parseTodoFromDb(row),
    );

    return jsonResponse<ApiResponse<Todo[]>>({
      success: true,
      data: todos,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Get todos since error:", error);
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
 * POST /api/todos/sync - Bulk sync operation
 */
async function handleBulkSync(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as BulkSyncRequest;

    if (!Array.isArray(body.todos)) {
      return jsonResponse<ApiResponse>(
        {
          success: false,
          error: "Invalid request: todos must be an array",
          timestamp: Date.now(),
        },
        400,
      );
    }

    const chittyIdClient = new ChittyIdClient(env.CHITTYID_SERVICE_URL);
    const bearerToken = extractBearerToken(request);

    const syncedTodos: Todo[] = [];
    const errors: string[] = [];
    let conflictCount = 0;

    for (const todoReq of body.todos) {
      try {
        // Check if todo with same content already exists (simple conflict detection)
        const existingResult = await env.DB.prepare(
          "SELECT * FROM todos WHERE content = ? AND deleted_at IS NULL LIMIT 1",
        )
          .bind(todoReq.content)
          .first();

        if (existingResult) {
          conflictCount++;
          // Update existing todo instead of creating new one
          const existing = parseTodoFromDb(existingResult);
          const now = Date.now();

          await env.DB.prepare(
            "UPDATE todos SET status = ?, updated_at = ?, platform = ? WHERE id = ?",
          )
            .bind(
              todoReq.status,
              now,
              todoReq.platform || "custom",
              existing.id,
            )
            .run();

          await logSyncAction(
            env,
            existing.id,
            "sync",
            todoReq.platform || "custom",
            true,
          );

          const updated = await env.DB.prepare(
            "SELECT * FROM todos WHERE id = ?",
          )
            .bind(existing.id)
            .first();

          syncedTodos.push(parseTodoFromDb(updated));
        } else {
          // Create new todo
          const chittyId = await chittyIdClient.mint(
            "todo",
            "task",
            { content: todoReq.content, status: todoReq.status },
            bearerToken || undefined,
          );

          const now = Date.now();
          const platform: TodoPlatform = todoReq.platform || "custom";

          const todo: Todo = {
            id: chittyId.id,
            content: todoReq.content,
            status: todoReq.status,
            active_form: todoReq.active_form,
            platform,
            session_id: todoReq.session_id,
            agent_id: todoReq.agent_id,
            created_at: now,
            updated_at: now,
            metadata: todoReq.metadata,
          };

          await env.DB.prepare(
            `INSERT INTO todos (id, content, status, active_form, platform, session_id, agent_id, created_at, updated_at, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
            .bind(
              todo.id,
              todo.content,
              todo.status,
              todo.active_form || null,
              todo.platform,
              todo.session_id || null,
              todo.agent_id || null,
              todo.created_at,
              todo.updated_at,
              todo.metadata ? JSON.stringify(todo.metadata) : null,
            )
            .run();

          await logSyncAction(env, todo.id, "sync", platform, false);

          syncedTodos.push(todo);
        }
      } catch (error) {
        errors.push(
          `Failed to sync todo "${todoReq.content}": ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    const response: BulkSyncResponse = {
      synced: syncedTodos.length,
      conflicts: conflictCount,
      errors,
      todos: syncedTodos,
    };

    return jsonResponse<ApiResponse<BulkSyncResponse>>({
      success: true,
      data: response,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Bulk sync error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to sync todos",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * Helper: Parse todo from database row
 */
function parseTodoFromDb(row: unknown): Todo {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    content: r.content as string,
    status: r.status as Todo["status"],
    active_form: r.active_form as string | undefined,
    platform: r.platform as TodoPlatform,
    session_id: r.session_id as string | undefined,
    agent_id: r.agent_id as string | undefined,
    created_at: r.created_at as number,
    updated_at: r.updated_at as number,
    deleted_at: r.deleted_at as number | undefined,
    metadata: r.metadata ? JSON.parse(r.metadata as string) : undefined,
  };
}

/**
 * Helper: Log sync action to sync_log table
 */
async function logSyncAction(
  env: Env,
  todoId: string,
  action: SyncLogEntry["action"],
  platform: TodoPlatform,
  conflictDetected: boolean,
): Promise<void> {
  try {
    const now = Date.now();
    const rand =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? (crypto as any).randomUUID()
        : Math.random().toString(36).slice(2, 10);
    const logId = `sync_${now}_${rand}`;
    const timestamp = now;

    await env.DB.prepare(
      `INSERT INTO sync_log (id, todo_id, action, platform, timestamp, conflict_detected)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        logId,
        todoId,
        action,
        platform,
        timestamp,
        conflictDetected ? 1 : 0,
      )
      .run();
  } catch (error) {
    console.error("Failed to log sync action:", error);
    // Don't throw - logging failure shouldn't break the operation
  }
}

/**
 * POST /api/memory/sync - Sync agent memory to hub
 */
async function handleMemorySync(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = (await request.json()) as MemorySyncRequest;

    // Validate required fields
    if (!body.agent_id || !body.session_id || !body.memories) {
      return jsonResponse<ApiResponse>(
        {
          success: false,
          error: "Missing required fields: agent_id, session_id, memories",
          timestamp: Date.now(),
        },
        400,
      );
    }

    const orchestrator = new MemorySyncOrchestrator(env, env.DB);
    const result = await orchestrator.syncAgentMemory(body);

    return jsonResponse<MemorySyncResponse>(result);
  } catch (error) {
    console.error("Memory sync error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Memory sync failed",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * GET /api/memory/:agent_id/:session_id - Pull agent memory
 */
async function handleMemoryPull(
  agent_id: string,
  session_id: string,
  params: URLSearchParams,
  env: Env,
): Promise<Response> {
  try {
    const since = params.get("since")
      ? parseInt(params.get("since")!)
      : undefined;

    const orchestrator = new MemorySyncOrchestrator(env, env.DB);
    const memory = await orchestrator.pullMemoryForAgent(
      agent_id,
      session_id,
      since,
    );

    if (!memory) {
      return jsonResponse<ApiResponse>(
        {
          success: false,
          error: "No memory found for agent",
          timestamp: Date.now(),
        },
        404,
      );
    }

    return jsonResponse<ApiResponse<AgentMemory>>({
      success: true,
      data: memory,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Memory pull error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Memory pull failed",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * POST /api/sessions/register - Register or update session
 */
async function handleRegisterSession(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = (await request.json()) as RegisterSessionRequest;

    if (!body.session_id || !body.project_id || !body.project_path) {
      return jsonResponse<ApiResponse>(
        {
          success: false,
          error: "Missing required fields: session_id, project_id, project_path",
          timestamp: Date.now(),
        },
        400,
      );
    }

    const registry = new SessionRegistry(env, env.DB);
    const bearerToken = extractBearerToken(request);
    const session = await registry.registerSession(body, bearerToken || undefined);

    return jsonResponse<ApiResponse>(
      {
        success: true,
        data: session,
        timestamp: Date.now(),
      },
      201,
    );
  } catch (error) {
    console.error("Register session error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to register session",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * POST /api/sessions/:id/sync - Sync session to project canonical state
 */
async function handleSessionSync(
  sessionId: string,
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = (await request.json()) as Partial<SessionSyncRequest>;

    const syncRequest: SessionSyncRequest = {
      session_id: sessionId,
      project_id: body.project_id || "",
      todos: body.todos,
      strategy: body.strategy || "timestamp",
    };

    if (!syncRequest.project_id) {
      return jsonResponse<ApiResponse>(
        {
          success: false,
          error: "Missing required field: project_id",
          timestamp: Date.now(),
        },
        400,
      );
    }

    const sessionSync = new SessionSync(env, env.DB);
    const bearerToken = extractBearerToken(request);
    const result = await sessionSync.syncSession(syncRequest, bearerToken || undefined);

    return jsonResponse<ApiResponse>(
      {
        success: true,
        data: result,
        timestamp: Date.now(),
      },
    );
  } catch (error) {
    console.error("Session sync error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to sync session",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * GET /api/sessions/:id - Get session details
 */
async function handleGetSession(
  sessionId: string,
  env: Env,
): Promise<Response> {
  try {
    const registry = new SessionRegistry(env, env.DB);
    const session = await registry.getSessionBySessionId(sessionId);

    if (!session) {
      return jsonResponse<ApiResponse>(
        {
          success: false,
          error: "Session not found",
          timestamp: Date.now(),
        },
        404,
      );
    }

    return jsonResponse<ApiResponse>(
      {
        success: true,
        data: session,
        timestamp: Date.now(),
      },
    );
  } catch (error) {
    console.error("Get session error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get session",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * GET /api/projects/:id/sessions - Get all sessions for project
 */
async function handleGetProjectSessions(
  projectId: string,
  env: Env,
): Promise<Response> {
  try {
    const registry = new SessionRegistry(env, env.DB);
    const sessions = await registry.getActiveSessionsForProject(projectId);

    return jsonResponse<ApiResponse>(
      {
        success: true,
        data: {
          project_id: projectId,
          sessions,
          total: sessions.length,
        },
        timestamp: Date.now(),
      },
    );
  } catch (error) {
    console.error("Get project sessions error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get project sessions",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * GET /api/projects/:id/canonical - Get project canonical state
 */
async function handleGetProjectCanonical(
  projectId: string,
  env: Env,
): Promise<Response> {
  try {
    const result = await env.DB.prepare(
      "SELECT * FROM project_states WHERE project_id = ?",
    )
      .bind(projectId)
      .first();

    if (!result) {
      return jsonResponse<ApiResponse>(
        {
          success: false,
          error: "Project state not found",
          timestamp: Date.now(),
        },
        404,
      );
    }

    const r = result as Record<string, unknown>;
    const state = {
      project_id: r.project_id as string,
      canonical_todos: JSON.parse(r.canonical_state as string),
      last_consolidated: r.last_consolidated as number,
      contributing_sessions: JSON.parse(r.contributing_sessions as string),
      metadata: r.metadata ? JSON.parse(r.metadata as string) : undefined,
    };

    return jsonResponse<ApiResponse>(
      {
        success: true,
        data: state,
        timestamp: Date.now(),
      },
    );
  } catch (error) {
    console.error("Get project canonical error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get project state",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * POST /api/sessions/:id/end - End a session
 */
async function handleEndSession(
  sessionId: string,
  env: Env,
): Promise<Response> {
  try {
    const registry = new SessionRegistry(env, env.DB);
    await registry.endSession(sessionId);

    return jsonResponse<ApiResponse>(
      {
        success: true,
        timestamp: Date.now(),
      },
    );
  } catch (error) {
    console.error("End session error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to end session",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * POST /api/projects/:id/consolidate - Consolidate all sessions into canonical state
 */
async function handleProjectConsolidate(
  projectId: string,
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as ProjectConsolidationRequest;
    const strategy = body.force ? "timestamp" : "timestamp"; // Can be extended

    const orchestrator = new ProjectSyncOrchestrator(env, env.DB);
    const result = await orchestrator.consolidateProject(projectId, strategy);

    // Auto-commit to Git if enabled
    const gitService = new GitIntegrationService(env, env.DB);
    const commitResult = await gitService.autoCommitProjectTodos(
      projectId,
      result.canonical_state,
    );

    return jsonResponse<ApiResponse<ProjectConsolidationResponse>>({
      success: true,
      data: {
        ...result,
        metadata: commitResult.success
          ? { git_commit: commitResult.commit_hash }
          : { git_error: commitResult.error },
      } as any,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Project consolidate error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to consolidate project",
        timestamp: Date.now(),
      },
      500,
    );
  }
}

/**
 * GET /api/projects/:id/canonical-state - Get canonical project state
 */
async function handleGetCanonicalState(
  projectId: string,
  env: Env,
): Promise<Response> {
  try {
    const orchestrator = new ProjectSyncOrchestrator(env, env.DB);
    const canonicalState = await orchestrator.getProjectCanonicalState(projectId);

    return jsonResponse<ApiResponse<{ canonical_todos: Todo[] }>>({
      success: true,
      data: { canonical_todos: canonicalState },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Get canonical state error:", error);
    return jsonResponse<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get canonical state",
        timestamp: Date.now(),
      },
      500,
    );
  }
}
