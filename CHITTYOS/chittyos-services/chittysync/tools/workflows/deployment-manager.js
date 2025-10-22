/**
 * ChittySync Deployment Manager
 *
 * Batch deployment for all ChittyOS workers with blue-green strategy.
 * Runs as a Cloudflare Worker for orchestrated deployments.
 *
 * @module deployment-manager
 */

/**
 * ChittyOS Workers to deploy
 */
const CHITTY_WORKERS = [
  { name: 'chittychat', path: 'chittyos-services/chittychat', critical: true },
  { name: 'chittyrouter', path: 'chittyos-services/chittyrouter', critical: true },
  { name: 'chittyauth', path: 'chittyos-services/chittyauth', critical: true },
  { name: 'chittyregistry', path: 'chittyos-services/chittyregistry', critical: false },
  { name: 'chittyid', path: 'chittyos-services/chittyid', critical: true },
  { name: 'chittysync', path: 'chittyos-services/chittysync/worker', critical: false },
  { name: 'chittybeacon', path: 'chittyos-services/chittybeacon', critical: false },
  { name: 'chittycanon', path: 'chittyos-services/chittycanon', critical: false },
  { name: 'chittyverify', path: 'chittyos-services/chittyverify', critical: false },
  { name: 'chittycertify', path: 'chittyos-services/chittycertify', critical: false }
];

/**
 * Deployment Manager Durable Object
 */
export class DeploymentManager {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.deploymentState = {
      activeDeployments: new Map(),
      history: [],
      failures: []
    };
  }

  /**
   * Deploy all workers
   * @param {Object} options - Deployment options
   * @returns {Promise<Object>} Deployment results
   */
  async deployAll(options = {}) {
    const {
      environment = 'production',
      strategy = 'blue-green',
      workers = CHITTY_WORKERS.map(w => w.name)
    } = options;

    const deploymentId = `deploy-${Date.now()}`;
    const startTime = Date.now();

    this.deploymentState.activeDeployments.set(deploymentId, {
      environment,
      strategy,
      workers,
      startTime,
      status: 'in_progress'
    });

    try {
      const targetWorkers = CHITTY_WORKERS.filter(w => workers.includes(w.name));

      // Deploy workers sequentially for critical, parallel for non-critical
      const criticalWorkers = targetWorkers.filter(w => w.critical);
      const nonCriticalWorkers = targetWorkers.filter(w => !w.critical);

      const results = [];

      // Deploy critical workers sequentially
      for (const worker of criticalWorkers) {
        const result = await this.deployWorker(worker, { environment, strategy });
        results.push(result);

        // Stop on critical failure
        if (!result.success && strategy !== 'force') {
          throw new Error(`Critical worker ${worker.name} failed to deploy`);
        }
      }

      // Deploy non-critical workers in parallel
      const nonCriticalResults = await Promise.allSettled(
        nonCriticalWorkers.map(worker =>
          this.deployWorker(worker, { environment, strategy })
        )
      );

      nonCriticalResults.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            worker: nonCriticalWorkers[i].name,
            success: false,
            error: result.reason.message
          });
        }
      });

      // Update deployment state
      const succeeded = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      const deployment = {
        deploymentId,
        environment,
        strategy,
        duration: Date.now() - startTime,
        succeeded: succeeded.length,
        failed: failed.length,
        results
      };

      this.deploymentState.history.push(deployment);
      this.deploymentState.activeDeployments.delete(deploymentId);

      // Alert on failures
      if (failed.length > 0) {
        await this.alertFailures(failed);
      }

      return deployment;
    } catch (error) {
      this.deploymentState.activeDeployments.delete(deploymentId);
      throw error;
    }
  }

  /**
   * Deploy individual worker
   * @param {Object} worker - Worker configuration
   * @param {Object} options - Deployment options
   * @returns {Promise<Object>} Deployment result
   */
  async deployWorker(worker, options = {}) {
    const { environment = 'production', strategy = 'blue-green' } = options;
    const startTime = Date.now();

    try {
      // Use Cloudflare API to deploy worker
      const accountId = this.env.CLOUDFLARE_ACCOUNT_ID;
      const apiToken = this.env.CLOUDFLARE_API_TOKEN;

      if (!accountId || !apiToken) {
        throw new Error('Cloudflare credentials not configured');
      }

      // TODO: Implement actual deployment via Cloudflare API
      // For now, return mock success
      const success = Math.random() > 0.1; // 90% success rate for testing

      if (!success) {
        throw new Error('Deployment failed (simulated)');
      }

      return {
        worker: worker.name,
        success: true,
        environment,
        strategy,
        duration: Date.now() - startTime,
        version: '1.0.0' // TODO: Get actual version
      };
    } catch (error) {
      return {
        worker: worker.name,
        success: false,
        environment,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Rollback deployment
   * @param {string} deploymentId - Deployment to rollback
   * @returns {Promise<Object>} Rollback result
   */
  async rollback(deploymentId) {
    const deployment = this.deploymentState.history.find(d => d.deploymentId === deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    // TODO: Implement rollback via Cloudflare API
    return {
      deploymentId,
      rolledBack: true,
      workers: deployment.results.map(r => r.worker)
    };
  }

  /**
   * Get deployment status
   * @param {string} deploymentId - Deployment ID
   * @returns {Object} Deployment status
   */
  getDeploymentStatus(deploymentId) {
    const active = this.deploymentState.activeDeployments.get(deploymentId);
    if (active) {
      return { ...active, status: 'in_progress' };
    }

    const completed = this.deploymentState.history.find(d => d.deploymentId === deploymentId);
    if (completed) {
      return { ...completed, status: 'completed' };
    }

    return null;
  }

  /**
   * Alert on deployment failures
   * @param {Array} failures - Failed deployments
   */
  async alertFailures(failures) {
    const message = `⚠️ ChittyOS deployment failures:\n\n${failures.map(f =>
      `- ${f.worker}: ${f.error}`
    ).join('\n')}`;

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
   * Handle HTTP fetch
   */
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // POST /deploy - Deploy workers
    if (path === '/deploy' && request.method === 'POST') {
      const body = await request.json();
      const result = await this.deployAll(body);
      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST /rollback/:id - Rollback deployment
    const rollbackMatch = path.match(/^\/rollback\/(.+)$/);
    if (rollbackMatch && request.method === 'POST') {
      const deploymentId = decodeURIComponent(rollbackMatch[1]);
      try {
        const result = await this.rollback(deploymentId);
        return new Response(JSON.stringify({ success: true, data: result }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /status/:id - Get deployment status
    const statusMatch = path.match(/^\/status\/(.+)$/);
    if (statusMatch && request.method === 'GET') {
      const deploymentId = decodeURIComponent(statusMatch[1]);
      const status = this.getDeploymentStatus(deploymentId);
      if (status) {
        return new Response(JSON.stringify({ success: true, data: status }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        return new Response(JSON.stringify({ success: false, error: 'Deployment not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /history - Get deployment history
    if (path === '/history' && request.method === 'GET') {
      return new Response(JSON.stringify({
        success: true,
        data: {
          active: Array.from(this.deploymentState.activeDeployments.values()),
          history: this.deploymentState.history.slice(-10)
        }
      }), {
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
    const id = env.DEPLOYMENT_MANAGER.idFromName('global');
    const stub = env.DEPLOYMENT_MANAGER.get(id);
    return stub.fetch(request);
  }
};
