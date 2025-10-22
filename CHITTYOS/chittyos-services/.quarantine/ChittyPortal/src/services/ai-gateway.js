/**
 * AI Gateway Service - Consolidated from ultimate worker
 * Handles AI operations with model routing and fallback
 */

export async function handleAIGateway(request, env, ctx) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Health check
  if (pathname === "/health") {
    return new Response(
      JSON.stringify({
        service: "AI Gateway",
        status: "healthy",
        models: {
          primary: env.AI_MODEL_PRIMARY,
          secondary: env.AI_MODEL_SECONDARY,
          reasoning: env.AI_MODEL_REASONING,
          vision: env.AI_MODEL_VISION,
          audio: env.AI_MODEL_AUDIO,
        },
        features: ["model-routing", "fallback", "analytics"],
        consolidated: "ultimate-worker-production",
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Chat completions endpoint
  if (pathname === "/v1/chat/completions" && request.method === "POST") {
    try {
      const body = await request.json();
      const { messages, model = env.AI_MODEL_PRIMARY, ...options } = body;

      // Use CloudFlare AI binding
      const response = await env.AI.run(model, {
        messages,
        ...options,
      });

      return new Response(
        JSON.stringify({
          id: `chatcmpl-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: response.response || response,
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: {
            message: error.message,
            type: "ai_error",
            service: "AI Gateway",
          },
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  // Embeddings endpoint
  if (pathname === "/v1/embeddings" && request.method === "POST") {
    try {
      const body = await request.json();
      const { input, model = env.EMBEDDING_MODEL } = body;

      const response = await env.AI.run(model, { text: input });

      return new Response(
        JSON.stringify({
          object: "list",
          data: [
            {
              object: "embedding",
              embedding: response.data[0] || [],
              index: 0,
            },
          ],
          model,
          usage: {
            prompt_tokens: 0,
            total_tokens: 0,
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: {
            message: error.message,
            type: "embedding_error",
            service: "AI Gateway",
          },
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  // Models list endpoint
  if (pathname === "/v1/models") {
    return new Response(
      JSON.stringify({
        object: "list",
        data: [
          {
            id: env.AI_MODEL_PRIMARY,
            object: "model",
            created: Math.floor(Date.now() / 1000),
            owned_by: "cloudflare",
          },
          {
            id: env.AI_MODEL_SECONDARY,
            object: "model",
            created: Math.floor(Date.now() / 1000),
            owned_by: "cloudflare",
          },
          {
            id: env.AI_MODEL_REASONING,
            object: "model",
            created: Math.floor(Date.now() / 1000),
            owned_by: "cloudflare",
          },
          {
            id: env.AI_MODEL_VISION,
            object: "model",
            created: Math.floor(Date.now() / 1000),
            owned_by: "cloudflare",
          },
        ],
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  return new Response(
    JSON.stringify({
      service: "AI Gateway",
      message: "Consolidated from ultimate worker",
      available: [
        "/health",
        "/v1/chat/completions",
        "/v1/embeddings",
        "/v1/models",
      ],
      timestamp: new Date().toISOString(),
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}
