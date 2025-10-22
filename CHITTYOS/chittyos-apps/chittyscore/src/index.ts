/**
 * ChittyScore Worker - Multi-Factor Scoring System
 * URL: https://score.chitty.cc
 * Version: 1.0.0
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, ScoreRequest, ScoreResponse } from "./types";
import { calculateScores } from "./scoring";

const app = new Hono<{ Bindings: Env }>();

// Enable CORS
app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

/**
 * Health check endpoint
 */
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    service: c.env.SERVICE_NAME || "ChittyScore",
    version: c.env.VERSION || "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Service info endpoint
 */
app.get("/", (c) => {
  return c.json({
    service: "ChittyScore",
    version: "1.0.0",
    description: "Multi-Factor Scoring System for ChittyOS",
    endpoints: {
      "POST /v1/score": "Calculate entity scores",
      "GET /health": "Health check",
    },
    score_types: [
      "creditworthiness",
      "reliability",
      "compliance",
      "activity",
      "composite",
    ],
    time_ranges: ["30d", "90d", "1y", "all"],
  });
});

/**
 * POST /v1/score - Calculate entity scores
 *
 * Calculates 5 score types based on verification report, trust network,
 * entity data, and external signals. Returns overall score and breakdown.
 */
app.post("/v1/score", async (c) => {
  try {
    // Parse request body
    const body = (await c.req.json()) as Partial<ScoreRequest>;

    // Validate required fields
    if (
      !body.score_types ||
      !Array.isArray(body.score_types) ||
      body.score_types.length === 0
    ) {
      return c.json(
        {
          error: "Invalid request",
          message: "score_types array is required",
        },
        400,
      );
    }

    if (!body.verification_report) {
      return c.json(
        {
          error: "Invalid request",
          message: "verification_report is required",
        },
        400,
      );
    }

    if (!body.entity_data) {
      return c.json(
        {
          error: "Invalid request",
          message: "entity_data is required",
        },
        400,
      );
    }

    // Validate score types
    const validScoreTypes = [
      "creditworthiness",
      "reliability",
      "compliance",
      "activity",
      "composite",
    ];
    const invalidTypes = body.score_types.filter(
      (type) => !validScoreTypes.includes(type),
    );
    if (invalidTypes.length > 0) {
      return c.json(
        {
          error: "Invalid request",
          message: `Invalid score types: ${invalidTypes.join(", ")}`,
          valid_types: validScoreTypes,
        },
        400,
      );
    }

    // Set defaults
    const request: ScoreRequest = {
      score_types: body.score_types,
      verification_report: body.verification_report,
      trust_network: body.trust_network || {},
      entity_data: body.entity_data,
      time_range: body.time_range || "all",
      external_signals: body.external_signals || {},
    };

    // Calculate scores
    const result = calculateScores(request);

    // Build response
    const response: ScoreResponse = {
      overall_score: result.overall_score,
      breakdown: result.breakdown,
      score_details: result.score_details,
      factors: result.factors,
      timestamp: new Date().toISOString(),
      time_range: request.time_range,
    };

    return c.json(response, 200);
  } catch (error) {
    console.error("Error calculating scores:", error);
    return c.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

/**
 * 404 handler
 */
app.notFound((c) => {
  return c.json(
    {
      error: "Not found",
      message: "Endpoint not found",
      available_endpoints: {
        "GET /": "Service information",
        "GET /health": "Health check",
        "POST /v1/score": "Calculate scores",
      },
    },
    404,
  );
});

/**
 * Error handler
 */
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    {
      error: "Internal server error",
      message: err.message || "An unexpected error occurred",
    },
    500,
  );
});

export default app;
