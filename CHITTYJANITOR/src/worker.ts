/**
 * ChittyJanitor - Adaptive AI Cleanup Agent
 * Cloudflare Worker with multi-model support
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { JanitorCore } from './core/janitor';
import { ModelRouter } from './models/router';
import { PredictiveEngine } from './engines/predictor';
import { DashboardGenerator } from './ui/dashboard';

type Bindings = {
  JANITOR_STATE: KVNamespace;
  JANITOR_METRICS: R2Bucket;
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  GOOGLE_API_KEY: string;
  CHITTY_ID_TOKEN: string;
  ENVIRONMENT: string;
  VERSION: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS for ChittyOS integration
app.use('/*', cors({
  origin: ['https://chitty.cc', 'https://*.chitty.cc'],
  credentials: true
}));

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'chitty-janitor',
    version: c.env.VERSION,
    timestamp: new Date().toISOString()
  });
});

// Get current status and intelligence
app.get('/status', async (c) => {
  const janitor = new JanitorCore(c.env);
  const state = await janitor.getState();

  return c.json({
    intelligence_level: state.intelligence_level,
    total_runs: state.total_runs,
    total_saved_gb: (state.total_saved_bytes / 1024 / 1024 / 1024).toFixed(2),
    birth: state.birth,
    last_run: state.last_run,
    patterns: state.patterns
  });
});

// Get predictive analysis
app.get('/predict', async (c) => {
  const predictor = new PredictiveEngine(c.env);
  const prediction = await predictor.predictCleanupNeeds();

  return c.json(prediction);
});

// Trigger cleanup
app.post('/cleanup', async (c) => {
  const { level = 'smart' } = await c.req.json().catch(() => ({}));

  const janitor = new JanitorCore(c.env);
  const result = await janitor.performCleanup(level);

  return c.json(result);
});

// Get insights dashboard
app.get('/insights', async (c) => {
  const dashboard = new DashboardGenerator(c.env);
  const insights = await dashboard.generateInsights();

  return c.json(insights);
});

// Get full dashboard data
app.get('/dashboard', async (c) => {
  const dashboard = new DashboardGenerator(c.env);
  const data = await dashboard.generate();

  return c.json(data);
});

// Discover new roles
app.post('/discover', async (c) => {
  const janitor = new JanitorCore(c.env);
  const discoveries = await janitor.discoverRoles();

  return c.json(discoveries);
});

// Scheduled cleanup (cron)
async function handleScheduledCleanup(env: Bindings): Promise<void> {
  console.log('[ChittyJanitor] Scheduled cleanup triggered');

  const predictor = new PredictiveEngine(env);
  const prediction = await predictor.predictCleanupNeeds();

  // Proactive cleanup based on prediction
  if (prediction.priority > 7) {
    const janitor = new JanitorCore(env);
    await janitor.performCleanup('aggressive');
    console.log('[ChittyJanitor] Aggressive cleanup completed');
  } else if (prediction.priority > 4) {
    const janitor = new JanitorCore(env);
    await janitor.performCleanup('conservative');
    console.log('[ChittyJanitor] Conservative cleanup completed');
  } else {
    console.log('[ChittyJanitor] No cleanup needed (priority too low)');
  }
}

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },

  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduledCleanup(env));
  }
};
