/**
 * ChittySync Orchestrator
 *
 * Master coordinator using Durable Objects to manage all platform syncs.
 * Runs as a Cloudflare Worker at the edge for 24/7 availability.
 *
 * @module sync-orchestrator
 */

import { ChittyIdClient } from '../../worker/src/chittyid-client.js';

/**
 * Durable Object for coordinating sync operations across all platforms
 */
export class SyncOrchestrator {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.syncState = {
      lastSync: {},
      activeSyncs: new Set(),
      failures: []
    };
  }

  /**
   * Orchestrate sync across multiple platforms
   * @param {string[]} platforms - Platforms to sync (or ['all'])
   * @returns {Promise<Object>} Sync results
   */
  async sync(platforms = ['all']) {
    const startTime = Date.now();
    const syncId = `sync-${startTime}`;

    // Mark sync as active
    this.syncState.activeSyncs.add(syncId);

    try {
      // Determine which platforms to sync
      const targetPlatforms = platforms.includes('all')
        ? ['google', 'cloudflare', 'neon', 'github', 'mcp', 'docs']
        : platforms;

      // Execute syncs in parallel
      const syncPromises = targetPlatforms.map(platform =>
        this.syncPlatform(platform)
          .then(result => ({ platform, status: 'fulfilled', result }))
          .catch(error => ({ platform, status: 'rejected', error: error.message }))
      );

      const results = await Promise.all(syncPromises);

      // Update sync state
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      fulfilled.forEach(r => {
        this.syncState.lastSync[r.platform] = Date.now();
      });

      rejected.forEach(r => {
        this.syncState.failures.push({
          platform: r.platform,
          error: r.error,
          timestamp: Date.now()
        });
      });

      // Alert on failures
      if (rejected.length > 0) {
        await this.alertFailures(rejected);
      }

      return {
        syncId,
        duration: Date.now() - startTime,
        succeeded: fulfilled.length,
        failed: rejected.length,
        results,
        failures: rejected.map(r => ({ platform: r.platform, error: r.error }))
      };
    } finally {
      this.syncState.activeSyncs.delete(syncId);
    }
  }

  /**
   * Sync individual platform
   * @param {string} platform - Platform name
   * @returns {Promise<Object>} Sync result
   */
  async syncPlatform(platform) {
    switch (platform) {
      case 'google':
        return this.syncGoogle();
      case 'cloudflare':
        return this.syncCloudflare();
      case 'neon':
        return this.syncNeon();
      case 'github':
        return this.syncGitHub();
      case 'mcp':
        return this.syncMCP();
      case 'docs':
        return this.syncDocs();
      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
  }

  /**
   * Sync Google Workspace (Gmail, Calendar, Chat, Sheets)
   */
  async syncGoogle() {
    const apiKey = this.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY not configured');
    }

    // TODO: Implement Gmail, Calendar, Sheets sync
    // For now, return mock success
    return {
      gmail: { todos: 0, alerts: 0 },
      calendar: { events: 0 },
      sheets: { rows: 0 }
    };
  }

  /**
   * Sync Cloudflare (Workers, KV, D1, R2, DNS)
   */
  async syncCloudflare() {
    const accountId = this.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = this.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      throw new Error('Cloudflare credentials not configured');
    }

    // TODO: Implement Worker deployment, KV sync, D1 migration
    return {
      workers: { deployed: 0 },
      kv: { synced: 0 },
      d1: { migrated: 0 }
    };
  }

  /**
   * Sync Neon databases
   */
  async syncNeon() {
    const apiKey = this.env.NEON_API_KEY;
    if (!apiKey) {
      throw new Error('NEON_API_KEY not configured');
    }

    // TODO: Implement Neon sync
    return {
      databases: { synced: 0 },
      migrations: { applied: 0 }
    };
  }

  /**
   * Sync GitHub (Issues, PRs, Actions)
   */
  async syncGitHub() {
    const token = this.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN not configured');
    }

    // Fetch recent issues
    const repo = this.env.GITHUB_REPO || 'chittyos/chittyos';
    const response = await fetch(`https://api.github.com/repos/${repo}/issues?state=open&labels=todo`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ChittySync/2.0'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const issues = await response.json();

    // TODO: Convert issues to todos and sync to ChittySync Hub
    return {
      issues: { imported: issues.length },
      prs: { synced: 0 }
    };
  }

  /**
   * Sync MCP servers and context
   */
  async syncMCP() {
    const registryUrl = this.env.MCP_REGISTRY_URL || 'https://registry.chitty.cc';

    // TODO: Implement MCP server registry sync
    return {
      servers: { registered: 0 },
      context: { synced: 0 }
    };
  }

  /**
   * Sync documentation (Markdown, Notion)
   */
  async syncDocs() {
    // TODO: Implement doc sync
    return {
      markdown: { synced: 0 },
      notion: { pages: 0 }
    };
  }

  /**
   * Alert on sync failures
   * @param {Array} failures - Failed sync operations
   */
  async alertFailures(failures) {
    const message = `ChittySync failures:\n${failures.map(f =>
      `- ${f.platform}: ${f.error}`
    ).join('\n')}`;

    // Send to alert router
    try {
      await fetch(`${this.env.GATEWAY_SERVICE_URL}/api/alerts/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.CHITTY_ID_TOKEN}`
        },
        body: JSON.stringify({
          severity: 'warning',
          message,
          channels: ['chat', 'email']
        })
      });
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }

  /**
   * Get current sync status
   */
  async getStatus() {
    return {
      activeSyncs: Array.from(this.syncState.activeSyncs),
      lastSync: this.syncState.lastSync,
      recentFailures: this.syncState.failures.slice(-10)
    };
  }

  /**
   * Handle HTTP fetch
   */
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // POST /sync - Trigger sync
    if (path === '/sync' && request.method === 'POST') {
      const body = await request.json();
      const platforms = body.platforms || ['all'];
      const result = await this.sync(platforms);
      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET /status - Get sync status
    if (path === '/status' && request.method === 'GET') {
      const status = await this.getStatus();
      return new Response(JSON.stringify({ success: true, data: status }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
}

/**
 * Worker entry point
 */
export default {
  async fetch(request, env, ctx) {
    // Get Durable Object instance
    const id = env.SYNC_ORCHESTRATOR.idFromName('global');
    const stub = env.SYNC_ORCHESTRATOR.get(id);
    return stub.fetch(request);
  }
};
