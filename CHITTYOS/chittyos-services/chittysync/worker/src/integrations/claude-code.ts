import { ChittyIdClient } from "../chittyid-client";
import { jsonResponse } from "../auth";
import type {
  Env,
  ApiResponse,
  CreateDirectionRequest,
  ClaimDirectionRequest,
  CompleteDirectionRequest,
  Direction,
} from "../types";

/**
 * Claude Code → Agent Directions Integration
 * REST endpoints to enqueue, claim, and complete "directions" for agents.
 */

export async function handleCreateDirection(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = (await request.json()) as CreateDirectionRequest;

    if (!body.agent_id || !body.content) {
      return jsonResponse<ApiResponse>({
        success: false,
        error: "Missing required fields: agent_id, content",
        timestamp: Date.now(),
      }, 400);
    }

    const now = Date.now();
    const chitty = new ChittyIdClient(env.CHITTYID_SERVICE_URL, env.CHITTY_ID_TOKEN);

    const idMint = await chitty.mint(
      "direction",
      body.type || "instruction",
      {
        agent_id: body.agent_id,
        session_id: body.session_id,
        source: body.source || "claude-code",
      },
    );

    // Ensure table exists (safe no-op if already created)
    await ensureDirectionsTable(env);

    const direction: Direction = {
      id: idMint.id,
      agent_id: body.agent_id,
      session_id: body.session_id,
      source: (body.source || "claude-code") as Direction["source"],
      content: body.content,
      type: (body.type || "instruction") as Direction["type"],
      status: "queued",
      priority: body.priority ?? 0,
      created_at: now,
      updated_at: now,
      metadata: body.metadata,
    };

    await env.DB.prepare(
      `INSERT INTO agent_directions
        (id, agent_id, session_id, source, content, type, status, priority, created_at, updated_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        direction.id,
        direction.agent_id,
        direction.session_id || null,
        direction.source,
        direction.content,
        direction.type,
        direction.status,
        direction.priority ?? 0,
        direction.created_at,
        direction.updated_at,
        direction.metadata ? JSON.stringify(direction.metadata) : null,
      )
      .run();

    return jsonResponse<ApiResponse<Direction>>({
      success: true,
      data: direction,
      timestamp: Date.now(),
    }, 201);
  } catch (err) {
    console.error("Create direction error:", err);
    return jsonResponse<ApiResponse>({
      success: false,
      error: err instanceof Error ? err.message : "Failed to create direction",
      timestamp: Date.now(),
    }, 500);
  }
}

export async function handleClaimDirection(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = (await request.json()) as ClaimDirectionRequest;

    if (!body.agent_id) {
      return jsonResponse<ApiResponse>({
        success: false,
        error: "Missing required field: agent_id",
        timestamp: Date.now(),
      }, 400);
    }

    await ensureDirectionsTable(env);

    // Select next queued direction for this agent (session-scoped first, else global)
    const next = await env.DB.prepare(
      `SELECT * FROM agent_directions
       WHERE agent_id = ? AND status = 'queued' AND (
         (session_id IS NULL) OR (session_id = COALESCE(?, session_id))
       )
       ORDER BY priority DESC, created_at ASC
       LIMIT 1`,
    )
      .bind(body.agent_id, body.session_id || null)
      .first();

    if (!next) {
      return jsonResponse<ApiResponse>({
        success: true,
        data: null,
        timestamp: Date.now(),
      });
    }

    const now = Date.now();

    if (!body.peek) {
      // Attempt to claim atomically (only if still queued)
      await env.DB.prepare(
        `UPDATE agent_directions
         SET status = 'in_progress', claimed_at = ?, updated_at = ?
         WHERE id = ? AND status = 'queued'`,
      )
        .bind(now, now, next.id as string)
        .run();
    }

    const claimed = await env.DB.prepare(
      `SELECT * FROM agent_directions WHERE id = ?`,
    )
      .bind(next.id as string)
      .first();

    return jsonResponse<ApiResponse<Direction>>({
      success: true,
      data: rowToDirection(claimed),
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("Claim direction error:", err);
    return jsonResponse<ApiResponse>({
      success: false,
      error: err instanceof Error ? err.message : "Failed to claim direction",
      timestamp: Date.now(),
    }, 500);
  }
}

export async function handleCompleteDirection(
  id: string,
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = (await request.json()) as CompleteDirectionRequest;

    await ensureDirectionsTable(env);

    // Ensure it exists
    const existing = await env.DB.prepare(
      `SELECT * FROM agent_directions WHERE id = ?`,
    )
      .bind(id)
      .first();

    if (!existing) {
      return jsonResponse<ApiResponse>({
        success: false,
        error: "Direction not found",
        timestamp: Date.now(),
      }, 404);
    }

    const now = Date.now();
    const status = body.error ? "failed" : "completed";

    await env.DB.prepare(
      `UPDATE agent_directions
       SET status = ?, result = COALESCE(?, result), error = COALESCE(?, error),
           updated_at = ?, completed_at = ?
       WHERE id = ?`,
    )
      .bind(
        status,
        body.result || null,
        body.error || null,
        now,
        now,
        id,
      )
      .run();

    const updated = await env.DB.prepare(
      `SELECT * FROM agent_directions WHERE id = ?`,
    )
      .bind(id)
      .first();

    return jsonResponse<ApiResponse<Direction>>({
      success: true,
      data: rowToDirection(updated),
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("Complete direction error:", err);
    return jsonResponse<ApiResponse>({
      success: false,
      error: err instanceof Error ? err.message : "Failed to complete direction",
      timestamp: Date.now(),
    }, 500);
  }
}

function rowToDirection(r: any): Direction {
  return {
    id: r.id as string,
    agent_id: r.agent_id as string,
    session_id: (r.session_id as string) || undefined,
    source: r.source as Direction["source"],
    content: r.content as string,
    type: r.type as Direction["type"],
    status: r.status as Direction["status"],
    priority: (r.priority as number) ?? 0,
    result: (r.result as string) || undefined,
    error: (r.error as string) || undefined,
    created_at: r.created_at as number,
    updated_at: r.updated_at as number,
    claimed_at: (r.claimed_at as number) || undefined,
    completed_at: (r.completed_at as number) || undefined,
    metadata: r.metadata ? JSON.parse(r.metadata as string) : undefined,
  };
}

async function ensureDirectionsTable(env: Env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS agent_directions (
       id TEXT PRIMARY KEY,
       agent_id TEXT NOT NULL,
       session_id TEXT,
       source TEXT NOT NULL,
       content TEXT NOT NULL,
       type TEXT NOT NULL,
       status TEXT NOT NULL,
       priority INTEGER DEFAULT 0,
       result TEXT,
       error TEXT,
       created_at INTEGER NOT NULL,
       updated_at INTEGER NOT NULL,
       claimed_at INTEGER,
       completed_at INTEGER,
       metadata TEXT
     );`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_agent_directions_agent_status
     ON agent_directions(agent_id, status);`,
  ).run();

  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_agent_directions_created
     ON agent_directions(created_at);`,
  ).run();
}

