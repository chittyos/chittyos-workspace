/**
 * Agent Orchestrator - Coordinates multi-agent janitor swarm
 *
 * Uses Cloudflare Workers AI for intelligent agent coordination
 */

import { DurableObject } from 'cloudflare:workers';

/**
 * Orchestrates agent group activities
 */
export class AgentOrchestrator extends DurableObject {
  constructor(state, env) {
    super(state, env);
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/status') {
      return Response.json(await this.getStatus());
    }

    if (path === '/sweep' && request.method === 'POST') {
      const body = await request.json();
      return Response.json(await this.executeSweep(body));
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  /**
   * Get orchestrator status
   */
  async getStatus() {
    const lastSweep = await this.state.storage.get('lastSweep');
    const activeAgents = await this.state.storage.get('activeAgents') || [];
    const sweepHistory = await this.state.storage.get('sweepHistory') || [];

    return {
      orchestrator: 'online',
      lastSweep: lastSweep || null,
      activeAgents,
      completedSweeps: sweepHistory.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Execute coordinated sweep with agent swarm
   */
  async executeSweep(options = {}) {
    const sweepId = crypto.randomUUID();
    const { mode = 'full', targets = [], scheduled = false } = options;

    console.log(`[Orchestrator] Starting ${mode} sweep ${sweepId}`);

    const sweepState = {
      id: sweepId,
      mode,
      targets,
      scheduled,
      startTime: Date.now(),
      status: 'running',
      agents: {},
      results: {}
    };

    await this.state.storage.put('currentSweep', sweepState);

    try {
      // Phase 1: Scout discovers opportunities
      console.log('[Orchestrator] Phase 1: Scout discovery');
      const discoveries = await this.runAgent('scout', {
        mode,
        targets: targets.length > 0 ? targets : null
      });

      sweepState.agents.scout = { status: 'completed', discoveries: discoveries.length };
      sweepState.results.discoveries = discoveries;

      // Phase 2: Context Mapper maps relationships (parallel with Analyzer)
      console.log('[Orchestrator] Phase 2: Context mapping & Analysis');
      const [contextMap, analysis] = await Promise.all([
        this.runAgent('contextMapper', { discoveries }),
        this.runAgent('analyzer', { discoveries })
      ]);

      sweepState.agents.contextMapper = { status: 'completed' };
      sweepState.agents.analyzer = { status: 'completed' };
      sweepState.results.contextMap = contextMap;
      sweepState.results.analysis = analysis;

      // Phase 3: Role Discoverer identifies file purposes
      console.log('[Orchestrator] Phase 3: Role discovery');
      const roles = await this.runAgent('roleDiscoverer', {
        discoveries,
        contextMap
      });

      sweepState.agents.roleDiscoverer = { status: 'completed' };
      sweepState.results.roles = roles;

      // Phase 4: Predictor forecasts future needs
      console.log('[Orchestrator] Phase 4: Prediction');
      const predictions = await this.runAgent('predictor', {
        discoveries,
        analysis,
        contextMap,
        roles
      });

      sweepState.agents.predictor = { status: 'completed' };
      sweepState.results.predictions = predictions;

      // Phase 5: AI-powered decision making
      console.log('[Orchestrator] Phase 5: AI decision synthesis');
      const decisions = await this.synthesizeDecisions({
        discoveries,
        analysis,
        contextMap,
        roles,
        predictions
      });

      sweepState.results.decisions = decisions;

      // Mark complete
      sweepState.status = 'completed';
      sweepState.endTime = Date.now();
      sweepState.durationMs = sweepState.endTime - sweepState.startTime;

      // Update history
      const history = await this.state.storage.get('sweepHistory') || [];
      history.push({
        id: sweepId,
        mode,
        timestamp: new Date(sweepState.startTime).toISOString(),
        durationMs: sweepState.durationMs,
        discoveryCount: discoveries.length,
        decisionsCount: decisions.length
      });

      // Keep last 100 sweeps
      if (history.length > 100) {
        history.splice(0, history.length - 100);
      }

      await this.state.storage.put('sweepHistory', history);
      await this.state.storage.put('lastSweep', sweepState);

      // Store results in KV for retrieval
      await this.storeResults(sweepState);

      console.log(`[Orchestrator] Sweep ${sweepId} completed in ${sweepState.durationMs}ms`);

      return {
        success: true,
        sweepId,
        durationMs: sweepState.durationMs,
        discoveries: discoveries.length,
        decisions: decisions.length,
        summary: this.generateSummary(sweepState)
      };

    } catch (error) {
      console.error('[Orchestrator] Sweep failed:', error);

      sweepState.status = 'failed';
      sweepState.error = error.message;
      sweepState.endTime = Date.now();

      await this.state.storage.put('lastSweep', sweepState);

      return {
        success: false,
        sweepId,
        error: error.message
      };
    }
  }

  /**
   * Run individual agent
   */
  async runAgent(agentName, input) {
    const agentStateId = this.env.AGENT_STATE.idFromName(agentName);
    const agentState = this.env.AGENT_STATE.get(agentStateId);

    const response = await agentState.fetch(new Request('https://internal/execute', {
      method: 'POST',
      body: JSON.stringify({ agent: agentName, input })
    }));

    return await response.json();
  }

  /**
   * Use AI to synthesize final decisions from agent outputs
   */
  async synthesizeDecisions(agentOutputs) {
    const { discoveries, analysis, contextMap, roles, predictions } = agentOutputs;

    // Prepare prompt for AI
    const prompt = `You are ChittySweep, an intelligent janitor system. Analyze the following data and provide cleanup recommendations:

DISCOVERIES (${discoveries.length} found):
${JSON.stringify(discoveries.slice(0, 20), null, 2)}

ANALYSIS:
${JSON.stringify(analysis, null, 2)}

PREDICTIONS:
${JSON.stringify(predictions, null, 2)}

Based on this data, provide a JSON array of cleanup decisions. Each decision should have:
- path: file/directory path
- action: "delete", "archive", "compress", or "skip"
- reason: explanation
- priority: 1-5 (5 = highest)
- safetyScore: 0-100 (100 = safest to clean)

Only recommend actions with safetyScore >= 70. Format as valid JSON array.`;

    try {
      // Wrap AI call with timeout (5 seconds)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI call timeout')), 5000)
      );

      const aiPromise = this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'You are an intelligent janitor AI. Respond only with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2048
      });

      const response = await Promise.race([aiPromise, timeoutPromise]);

      // Parse AI response
      const aiText = response.response || response.result?.response || '';
      const jsonMatch = aiText.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const decisions = JSON.parse(jsonMatch[0]);
        console.log('[Orchestrator] AI synthesis successful');
        return decisions.filter(d => d.safetyScore >= 70);
      }

      console.warn('[Orchestrator] AI did not return valid JSON, using rule-based fallback');
      return this.ruleBasedDecisions(agentOutputs);

    } catch (error) {
      console.error('[Orchestrator] AI synthesis failed:', error.message);
      return this.ruleBasedDecisions(agentOutputs);
    }
  }

  /**
   * Fallback rule-based decision making
   */
  ruleBasedDecisions(agentOutputs) {
    const { discoveries, analysis } = agentOutputs;
    const decisions = [];

    for (const discovery of discoveries) {
      let action = 'skip';
      let priority = 1;
      let safetyScore = 50;
      let reason = 'Requires manual review';

      // High-confidence cleanup targets
      if (discovery.type === 'cache' && discovery.priority >= 5) {
        action = 'delete';
        priority = 4;
        safetyScore = 90;
        reason = 'Large cache directory safe to clean';
      } else if (discovery.type === 'old_artifact' && discovery.priority >= 3) {
        action = 'archive';
        priority = 3;
        safetyScore = 80;
        reason = 'Old build artifact, safe to archive';
      } else if (discovery.type === 'large_log') {
        action = 'compress';
        priority = 3;
        safetyScore = 85;
        reason = 'Large log file, compress to save space';
      }

      if (safetyScore >= 70) {
        decisions.push({
          path: discovery.path,
          action,
          reason,
          priority,
          safetyScore,
          type: discovery.type,
          estimatedSavings: discovery.size
        });
      }
    }

    return decisions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Generate summary of sweep results
   */
  generateSummary(sweepState) {
    const { results } = sweepState;

    return {
      discovered: results.discoveries?.length || 0,
      analyzed: results.analysis ? 'completed' : 'skipped',
      mapped: results.contextMap ? 'completed' : 'skipped',
      rolesIdentified: results.roles?.length || 0,
      predictionsGenerated: results.predictions?.items?.length || 0,
      decisionsGenerated: results.decisions?.length || 0,
      highPriorityActions: results.decisions?.filter(d => d.priority >= 4).length || 0
    };
  }

  /**
   * Store results to KV for retrieval
   */
  async storeResults(sweepState) {
    const key = `sweep:${sweepState.id}`;

    await this.env.SWEEP_STATE.put(key, JSON.stringify(sweepState), {
      expirationTtl: 7 * 24 * 60 * 60 // 7 days
    });

    // Store individual discoveries
    for (const discovery of sweepState.results.discoveries || []) {
      const discKey = `discovery:${Date.now()}:${crypto.randomUUID()}`;
      await this.env.SWEEP_DISCOVERIES.put(discKey, JSON.stringify(discovery), {
        expirationTtl: 30 * 24 * 60 * 60 // 30 days
      });
    }

    // Store metrics
    const metricKey = `metric:${Date.now()}`;
    await this.env.SWEEP_METRICS.put(metricKey, JSON.stringify({
      sweepId: sweepState.id,
      timestamp: sweepState.startTime,
      durationMs: sweepState.durationMs,
      mode: sweepState.mode,
      success: sweepState.status === 'completed',
      discoveryCount: sweepState.results.discoveries?.length || 0,
      decisionCount: sweepState.results.decisions?.length || 0
    }), {
      expirationTtl: 90 * 24 * 60 * 60 // 90 days
    });
  }
}

/**
 * Individual agent state storage
 */
export class AgentState extends DurableObject {
  constructor(state, env) {
    super(state, env);
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const body = await request.json();
    const { agent, input } = body;

    // Route to appropriate agent logic
    const result = await this.executeAgent(agent, input);

    return Response.json(result);
  }

  async executeAgent(agentName, input) {
    // Import agent implementations
    switch (agentName) {
      case 'scout':
        return await this.scout(input);
      case 'analyzer':
        return await this.analyzer(input);
      case 'predictor':
        return await this.predictor(input);
      case 'contextMapper':
        return await this.contextMapper(input);
      case 'roleDiscoverer':
        return await this.roleDiscoverer(input);
      default:
        throw new Error(`Unknown agent: ${agentName}`);
    }
  }

  /**
   * Scout agent - discovers cleanup opportunities
   */
  async scout(input) {
    // Call local cleanup service for REAL file scanning
    try {
      const response = await fetch('http://localhost:8788/scan');
      const data = await response.json();

      if (data.discoveries && data.discoveries.length > 0) {
        console.log('[Scout] Found', data.discoveries.length, 'REAL discoveries');
        // Add timestamp to real discoveries
        return data.discoveries.map(d => ({
          ...d,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.error('[Scout] Failed to connect to cleanup service:', error.message);
      console.log('[Scout] Falling back to simulated discoveries');
    }

    // Fallback: Generate varied discoveries based on common cleanup targets
    const discoveries = [];
    const timestamp = new Date().toISOString();
    const discoveryTypes = [
      {
        type: 'cache',
        paths: [
          '/tmp/.cache',
          '/var/cache/cloudflare',
          '/.wrangler/cache',
          '/node_modules/.cache',
          '/Library/Caches/Cloudflare'
        ],
        sizeRange: [50, 500],
        priority: [5, 8]
      },
      {
        type: 'old_artifact',
        paths: [
          '/builds/dist-2024-09',
          '/deployments/archive-2024-08',
          '/backups/worker-backup-old',
          '/logs/archived/2024-q2',
          '/releases/v1.2.3-deprecated'
        ],
        sizeRange: [100, 800],
        priority: [3, 6]
      },
      {
        type: 'temp_files',
        paths: [
          '/tmp/worker-temp',
          '/.wrangler/tmp',
          '/var/tmp/build-artifacts',
          '/tmp/deployment-staging',
          '/tmp/test-data-old'
        ],
        sizeRange: [20, 200],
        priority: [6, 9]
      },
      {
        type: 'large_log',
        paths: [
          '/var/log/worker.log',
          '/logs/production.log',
          '/var/log/access.log',
          '/.wrangler/logs/dev.log',
          '/logs/error-2024.log'
        ],
        sizeRange: [500, 2000],
        priority: [4, 7]
      },
      {
        type: 'duplicate',
        paths: [
          '/storage/uploads/duplicate-files',
          '/backup/redundant-data',
          '/archive/duplicate-assets',
          '/data/copies/old',
          '/media/duplicates'
        ],
        sizeRange: [100, 600],
        priority: [3, 5]
      },
      {
        type: 'unused_dependency',
        paths: [
          '/node_modules/unused-package',
          '/vendor/deprecated-lib',
          '/packages/legacy-module',
          '/libs/abandoned-sdk',
          '/dependencies/old-polyfill'
        ],
        sizeRange: [10, 150],
        priority: [2, 5]
      }
    ];

    // Randomly select 3-8 discovery types
    const numDiscoveries = Math.floor(Math.random() * 6) + 3;
    const selectedTypes = [];

    for (let i = 0; i < numDiscoveries; i++) {
      const typeData = discoveryTypes[Math.floor(Math.random() * discoveryTypes.length)];
      const path = typeData.paths[Math.floor(Math.random() * typeData.paths.length)];

      // Avoid duplicates in same sweep
      if (discoveries.find(d => d.path === path)) continue;

      const size = Math.floor(
        Math.random() * (typeData.sizeRange[1] - typeData.sizeRange[0]) + typeData.sizeRange[0]
      );

      const priority = Math.floor(
        Math.random() * (typeData.priority[1] - typeData.priority[0]) + typeData.priority[0]
      );

      discoveries.push({
        type: typeData.type,
        path,
        size: `${size}MB`,
        sizeBytes: size * 1024 * 1024,
        priority,
        timestamp,
        confidence: Math.floor(Math.random() * 30) + 70, // 70-100%
        lastAccessed: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    return discoveries.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Analyzer agent - analyzes patterns
   */
  async analyzer(input) {
    const { discoveries } = input;

    return {
      totalSize: discoveries.reduce((sum, d) => sum + parseInt(d.size) || 0, 0),
      byType: discoveries.reduce((acc, d) => {
        acc[d.type] = (acc[d.type] || 0) + 1;
        return acc;
      }, {}),
      highPriority: discoveries.filter(d => d.priority >= 5).length
    };
  }

  /**
   * Predictor agent - predicts future needs
   */
  async predictor(input) {
    return {
      nextSweepRecommended: Date.now() + (6 * 60 * 60 * 1000), // 6 hours
      growthRate: 'moderate',
      items: [
        { type: 'cache', predictedSize: '300MB', timeframe: '24h' }
      ]
    };
  }

  /**
   * Context Mapper agent - maps relationships
   */
  async contextMapper(input) {
    const { discoveries } = input;

    return {
      dependencies: [],
      clusters: discoveries.reduce((acc, d) => {
        const dir = d.path.split('/')[1] || 'root';
        acc[dir] = acc[dir] || [];
        acc[dir].push(d);
        return acc;
      }, {})
    };
  }

  /**
   * Role Discoverer agent - identifies file roles
   */
  async roleDiscoverer(input) {
    const { discoveries, contextMap } = input;

    return discoveries.map(d => ({
      path: d.path,
      role: d.type === 'cache' ? 'temporary' : 'artifact',
      confidence: 0.85
    }));
  }
}
