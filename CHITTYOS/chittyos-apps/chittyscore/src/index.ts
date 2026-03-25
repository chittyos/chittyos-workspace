/**
 * ChittyScore Worker — DRL Reckoning Endpoint
 * URL: https://score.chitty.cc
 * Version: 2.0.0
 *
 * Per TY-VY-RY White Paper v2.1:
 * "Reckoning, not record" — DRL is assembled at query time from every
 * ledger entry that touched the entity, weighted by credibility.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import { reckon, getCachedReckoning } from "./drl";
import { anchorReckoning } from "./anchor";

const app = new Hono<{ Bindings: Env }>();

/** ChittyID format: VV-G-LLL-SSSS-T-YM-C-X (loose validation) */
const CHITTY_ID_PATTERN = /^[A-Z0-9]{2,}-[A-Z0-9]+-[A-Z0-9]{3,}-[A-Z0-9]{4,}-[PLTEA]-/;

app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Source-Service"],
  }),
);

/** Auth middleware for mutating routes — requires CHITTYLEDGER_TOKEN */
app.use("/v1/reckon/*", async (c, next) => {
  if (c.req.method !== "POST") return next();
  const token = c.env.CHITTYLEDGER_TOKEN;
  if (!token) return next(); // no token configured = open (dev)
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ") || auth.slice(7) !== token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
});
app.use("/v1/anchor/*", async (c, next) => {
  const token = c.env.CHITTYLEDGER_TOKEN;
  if (!token) return next();
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ") || auth.slice(7) !== token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
});

/** Health check */
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    service: c.env.SERVICE_NAME || "ChittyScore",
    version: c.env.VERSION || "2.0.0",
    model: "TY/VY/RY DRL",
    timestamp: new Date().toISOString(),
  });
});

/** Service info */
app.get("/", (c) => {
  return c.json({
    service: "ChittyScore",
    version: "2.0.0",
    description: "DRL Reckoning Endpoint — TY/VY/RY trust model",
    model: "TY-VY-RY White Paper v2.1",
    endpoints: {
      "POST /v1/reckon/:chittyId": "Compute DRL reckoning (TY/VY/RY) from ledger entries",
      "GET /v1/reckon/:chittyId": "Get cached reckoning (60s TTL) or compute fresh",
      "POST /v1/anchor/:chittyId": "Hard-Mint current reckoning to ChittyChain",
      "GET /health": "Health check",
    },
  });
});

/**
 * POST /v1/reckon/:chittyId — Compute fresh DRL reckoning
 *
 * Always queries ChittyLedger and computes TY/VY/RY from scratch.
 * If material mutation detected (>5% delta), optionally anchors to ChittyChain.
 */
app.post("/v1/reckon/:chittyId", async (c) => {
  const chittyId = c.req.param("chittyId");
  if (!chittyId || !CHITTY_ID_PATTERN.test(chittyId)) {
    return c.json({ error: "Invalid or missing chittyId" }, 400);
  }

  try {
    const reckoning = await reckon(chittyId, c.env);

    // Auto-anchor on material mutation — surface failures explicitly
    if (reckoning.materialMutation) {
      const anchor = await anchorReckoning(reckoning, c.env);
      // Persist anchored payload back to KV so GET returns anchor data
      if (anchor.success) {
        try {
          await c.env.SCORE_CACHE.put(
            `reckoning:${chittyId}`,
            JSON.stringify(anchor.reckoning),
            { expirationTtl: 60 },
          );
        } catch { /* best-effort */ }
      }
      return c.json({
        ...anchor.reckoning,
        anchorError: anchor.success ? undefined : anchor.error,
      }, 200);
    }

    return c.json(reckoning, 200);
  } catch (err) {
    console.error(`[ChittyScore] Reckoning failed for ${chittyId}:`, err);
    return c.json(
      { error: "Reckoning failed", message: err instanceof Error ? err.message : "Unknown error" },
      500,
    );
  }
});

/**
 * GET /v1/reckon/:chittyId — Get cached reckoning or compute fresh
 *
 * Returns KV-cached reckoning if available (60s TTL).
 * Falls back to fresh computation if no cache.
 */
app.get("/v1/reckon/:chittyId", async (c) => {
  const chittyId = c.req.param("chittyId");
  if (!chittyId || !CHITTY_ID_PATTERN.test(chittyId)) {
    return c.json({ error: "Invalid or missing chittyId" }, 400);
  }

  try {
    // Try cache first
    const cached = await getCachedReckoning(chittyId, c.env);
    if (cached) {
      return c.json({ ...cached, cached: true }, 200);
    }

    // No cache — compute fresh
    const reckoning = await reckon(chittyId, c.env);
    return c.json(reckoning, 200);
  } catch (err) {
    console.error(`[ChittyScore] Reckoning failed for ${chittyId}:`, err);
    return c.json(
      { error: "Reckoning failed", message: err instanceof Error ? err.message : "Unknown error" },
      500,
    );
  }
});

/**
 * POST /v1/anchor/:chittyId — Hard-Mint reckoning to ChittyChain
 *
 * Forces a fresh reckoning and anchors it regardless of mutation status.
 */
app.post("/v1/anchor/:chittyId", async (c) => {
  const chittyId = c.req.param("chittyId");
  if (!chittyId || !CHITTY_ID_PATTERN.test(chittyId)) {
    return c.json({ error: "Invalid or missing chittyId" }, 400);
  }

  try {
    const reckoning = await reckon(chittyId, c.env);
    const anchor = await anchorReckoning(reckoning, c.env);
    if (!anchor.success) {
      return c.json(
        { error: "Anchor failed", message: anchor.error, reckoning: anchor.reckoning },
        502,
      );
    }
    // Persist anchored payload back to KV
    try {
      await c.env.SCORE_CACHE.put(
        `reckoning:${chittyId}`,
        JSON.stringify(anchor.reckoning),
        { expirationTtl: 60 },
      );
    } catch { /* best-effort */ }
    return c.json(anchor.reckoning, 200);
  } catch (err) {
    console.error(`[ChittyScore] Anchor failed for ${chittyId}:`, err);
    return c.json(
      { error: "Anchor failed", message: err instanceof Error ? err.message : "Unknown error" },
      500,
    );
  }
});

/** 404 handler */
app.notFound((c) => {
  return c.json(
    {
      error: "Not found",
      message: "Endpoint not found",
      available_endpoints: {
        "GET /": "Service information",
        "GET /health": "Health check",
        "POST /v1/reckon/:chittyId": "Compute DRL reckoning",
        "GET /v1/reckon/:chittyId": "Get cached reckoning",
        "POST /v1/anchor/:chittyId": "Anchor reckoning to ChittyChain",
      },
    },
    404,
  );
});

/** Error handler */
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    { error: "Internal server error", message: err.message || "An unexpected error occurred" },
    500,
  );
});

export default app;
