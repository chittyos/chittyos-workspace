/**
 * ChittySweep - Intelligent Janitor Agent Group
 *
 * Multi-agent system powered by Cloudflare Workers AI
 * Coordinates Scout, Analyzer, Predictor, Context-Mapper, and Role-Discoverer agents
 *
 * @see https://developers.cloudflare.com/workers-ai/
 */

import { AgentOrchestrator } from './agents/orchestrator';
import { ScoutAgent } from './agents/scout';
import { AnalyzerAgent } from './agents/analyzer';
import { PredictorAgent } from './agents/predictor';
import { ContextMapperAgent } from './agents/context-mapper';
import { RoleDiscovererAgent } from './agents/role-discoverer';
import { renderDashboard } from './dashboard';

export { AgentOrchestrator, AgentState } from './agents/orchestrator';

/**
 * Main worker entry point
 */
export default {
  /**
   * Handle HTTP requests
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check
      if (path === '/health') {
        return Response.json({
          status: 'healthy',
          service: 'ChittySweep',
          version: '1.0.0',
          agents: {
            scout: 'active',
            analyzer: 'active',
            predictor: 'active',
            contextMapper: 'active',
            roleDiscoverer: 'active'
          },
          timestamp: new Date().toISOString()
        }, { headers: corsHeaders });
      }

      // Agent status
      if (path === '/api/agents/status') {
        const orchestratorId = env.AGENT_ORCHESTRATOR.idFromName('default');
        const orchestrator = env.AGENT_ORCHESTRATOR.get(orchestratorId);
        const status = await orchestrator.fetch(new Request('https://internal/status'));

        return new Response(status.body, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Trigger sweep (manual or via API)
      if (path === '/api/sweep' && request.method === 'POST') {
        const body = await request.json();
        const mode = body.mode || 'full'; // 'full', 'quick', 'targeted'
        const targets = body.targets || [];

        const orchestratorId = env.AGENT_ORCHESTRATOR.idFromName('default');
        const orchestrator = env.AGENT_ORCHESTRATOR.get(orchestratorId);

        const sweepRequest = new Request('https://internal/sweep', {
          method: 'POST',
          body: JSON.stringify({ mode, targets })
        });

        const result = await orchestrator.fetch(sweepRequest);

        return new Response(result.body, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get discoveries
      if (path === '/api/discoveries') {
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const type = url.searchParams.get('type');

        const discoveries = await getDiscoveries(env, { limit, type });

        return Response.json({
          discoveries,
          count: discoveries.length,
          timestamp: new Date().toISOString()
        }, { headers: corsHeaders });
      }

      // Get metrics
      if (path === '/api/metrics') {
        const period = url.searchParams.get('period') || '24h';
        const metrics = await getMetrics(env, period);

        return Response.json({
          metrics,
          period,
          timestamp: new Date().toISOString()
        }, { headers: corsHeaders });
      }

      // Cleanup action endpoint
      if (path === '/api/cleanup' && request.method === 'POST') {
        const body = await request.json();
        const { path: filePath, action } = body;

        try {
          // Call local cleanup service
          const response = await fetch('http://localhost:8788/cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath, action })
          });

          const result = await response.json();

          return Response.json(result, { headers: corsHeaders });
        } catch (error) {
          return Response.json({
            success: false,
            error: 'Cleanup service unavailable: ' + error.message
          }, {
            status: 503,
            headers: corsHeaders
          });
        }
      }

      // Agent-specific endpoints
      if (path.startsWith('/api/agent/')) {
        const agentName = path.split('/')[3];
        const action = path.split('/')[4];

        return await handleAgentRequest(env, agentName, action, request);
      }

      // Dashboard/UI
      if (path === '/' || path === '/dashboard') {
        return new Response(renderDashboard(), {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' }
        });
      }

      return Response.json({ error: 'Not found' }, {
        status: 404,
        headers: corsHeaders
      });

    } catch (error) {
      console.error('ChittySweep error:', error);
      return Response.json({
        error: error.message,
        timestamp: new Date().toISOString()
      }, {
        status: 500,
        headers: corsHeaders
      });
    }
  },

  /**
   * Handle scheduled events (cron triggers)
   */
  async scheduled(event, env, ctx) {
    const cron = event.cron;

    console.log(`ChittySweep scheduled run: ${cron}`);

    try {
      const orchestratorId = env.AGENT_ORCHESTRATOR.idFromName('default');
      const orchestrator = env.AGENT_ORCHESTRATOR.get(orchestratorId);

      let mode = 'quick';

      // Determine sweep mode based on cron schedule
      if (cron === '0 2 * * *') {
        mode = 'full'; // Daily full sweep at 2 AM
      } else if (cron.startsWith('*/15')) {
        mode = 'metrics'; // Metric collection only
      }

      const sweepRequest = new Request('https://internal/sweep', {
        method: 'POST',
        body: JSON.stringify({ mode, scheduled: true })
      });

      ctx.waitUntil(orchestrator.fetch(sweepRequest));

      console.log(`ChittySweep ${mode} sweep initiated`);

    } catch (error) {
      console.error('Scheduled sweep error:', error);
    }
  }
};

/**
 * Get discoveries from KV
 */
async function getDiscoveries(env, options = {}) {
  const { limit = 50, type = null } = options;

  const list = await env.SWEEP_DISCOVERIES.list({ limit: 100 });
  const discoveries = [];

  for (const key of list.keys) {
    const discovery = await env.SWEEP_DISCOVERIES.get(key.name, 'json');
    if (!type || discovery.type === type) {
      discoveries.push(discovery);
    }
    if (discoveries.length >= limit) break;
  }

  return discoveries.sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  );
}

/**
 * Get metrics from KV
 */
async function getMetrics(env, period) {
  const now = Date.now();
  const periodMs = parsePeriod(period);
  const cutoff = now - periodMs;

  const list = await env.SWEEP_METRICS.list({ limit: 1000 });
  const metrics = [];

  for (const key of list.keys) {
    const metric = await env.SWEEP_METRICS.get(key.name, 'json');
    if (metric && metric.timestamp >= cutoff) {
      metrics.push(metric);
    }
  }

  return aggregateMetrics(metrics);
}

/**
 * Parse period string to milliseconds
 */
function parsePeriod(period) {
  const match = period.match(/^(\d+)([hdwm])$/);
  if (!match) return 24 * 60 * 60 * 1000; // Default 24h

  const [, num, unit] = match;
  const value = parseInt(num);

  switch (unit) {
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'w': return value * 7 * 24 * 60 * 60 * 1000;
    case 'm': return value * 30 * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}

/**
 * Aggregate metrics for reporting
 */
function aggregateMetrics(metrics) {
  const stats = {
    totalSweeps: metrics.length,
    totalBytesCleaned: 0,
    totalFilesProcessed: 0,
    avgDurationMs: 0,
    successRate: 0,
    byAgent: {},
    byType: {}
  };

  let totalDuration = 0;
  let successCount = 0;

  for (const metric of metrics) {
    if (metric.bytesCleaned) stats.totalBytesCleaned += metric.bytesCleaned;
    if (metric.filesProcessed) stats.totalFilesProcessed += metric.filesProcessed;
    if (metric.durationMs) totalDuration += metric.durationMs;
    if (metric.success) successCount++;

    // By agent
    if (metric.agent) {
      stats.byAgent[metric.agent] = stats.byAgent[metric.agent] || { count: 0, bytes: 0 };
      stats.byAgent[metric.agent].count++;
      if (metric.bytesCleaned) {
        stats.byAgent[metric.agent].bytes += metric.bytesCleaned;
      }
    }

    // By type
    if (metric.type) {
      stats.byType[metric.type] = stats.byType[metric.type] || { count: 0, bytes: 0 };
      stats.byType[metric.type].count++;
      if (metric.bytesCleaned) {
        stats.byType[metric.type].bytes += metric.bytesCleaned;
      }
    }
  }

  if (metrics.length > 0) {
    stats.avgDurationMs = Math.round(totalDuration / metrics.length);
    stats.successRate = Math.round((successCount / metrics.length) * 100);
  }

  return stats;
}

/**
 * Handle agent-specific requests
 */
async function handleAgentRequest(env, agentName, action, request) {
  // Route to specific agent implementation
  const agents = {
    scout: ScoutAgent,
    analyzer: AnalyzerAgent,
    predictor: PredictorAgent,
    contextMapper: ContextMapperAgent,
    roleDiscoverer: RoleDiscovererAgent
  };

  const AgentClass = agents[agentName];
  if (!AgentClass) {
    return Response.json({ error: 'Unknown agent' }, { status: 404 });
  }

  const agent = new AgentClass(env);
  const result = await agent.handleRequest(action, request);

  return Response.json(result);
}

// Dashboard rendering is now handled by ./dashboard.js
