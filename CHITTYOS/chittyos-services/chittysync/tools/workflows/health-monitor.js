/**
 * ChittySync Health Monitor
 *
 * Continuous health monitoring for all ChittyOS services with alerting.
 * Runs as a Cloudflare Worker with scheduled cron triggers.
 *
 * @module health-monitor
 */

/**
 * ChittyOS service registry
 */
const CHITTY_SERVICES = [
  { name: 'ChittyID', url: 'https://id.chitty.cc/v1/health', critical: true },
  { name: 'ChittyGateway', url: 'https://gateway.chitty.cc/health', critical: true },
  { name: 'ChittyRegistry', url: 'https://registry.chitty.cc/health', critical: false },
  { name: 'ChittyAuth', url: 'https://auth.chitty.cc/health', critical: true },
  { name: 'ChittyRouter', url: 'https://router.chitty.cc/health', critical: true },
  { name: 'ChittyChat', url: 'https://gateway.chitty.cc/health', critical: true },
  { name: 'ChittySync', url: 'https://gateway.chitty.cc/api/todos/health', critical: false },
  { name: 'ChittyBeacon', url: 'https://gateway.chitty.cc/api/beacon/health', critical: false },
  { name: 'ChittyCanon', url: 'https://canon.chitty.cc/health', critical: false }
];

/**
 * Health Monitor Durable Object
 */
export class HealthMonitor {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.healthState = {
      services: {},
      lastCheck: null,
      failures: [],
      alertsSent: []
    };
  }

  /**
   * Check health of all services
   * @returns {Promise<Object>} Health check results
   */
  async checkAll() {
    const startTime = Date.now();
    const results = await Promise.all(
      CHITTY_SERVICES.map(service => this.checkService(service))
    );

    // Update state
    results.forEach(result => {
      this.healthState.services[result.name] = {
        healthy: result.healthy,
        status: result.status,
        responseTime: result.responseTime,
        lastCheck: Date.now(),
        error: result.error
      };
    });

    this.healthState.lastCheck = Date.now();

    // Detect failures
    const failures = results.filter(r => !r.healthy);
    const criticalFailures = failures.filter(r => r.critical);

    // Alert on critical failures
    if (criticalFailures.length > 0) {
      await this.alertCriticalFailures(criticalFailures);
    }

    // Alert on degraded service
    if (failures.length > 0 && criticalFailures.length === 0) {
      await this.alertDegradedService(failures);
    }

    return {
      timestamp: Date.now(),
      duration: Date.now() - startTime,
      total: results.length,
      healthy: results.filter(r => r.healthy).length,
      unhealthy: failures.length,
      critical: criticalFailures.length,
      services: results
    };
  }

  /**
   * Check individual service health
   * @param {Object} service - Service configuration
   * @returns {Promise<Object>} Health check result
   */
  async checkService(service) {
    const startTime = Date.now();

    try {
      const response = await fetch(service.url, {
        method: 'GET',
        headers: {
          'User-Agent': 'ChittySync-HealthMonitor/2.0'
        },
        signal: AbortSignal.timeout(5000) // 5s timeout
      });

      const responseTime = Date.now() - startTime;
      const healthy = response.ok && response.status === 200;

      let data = null;
      try {
        data = await response.json();
      } catch (e) {
        // Response may not be JSON
      }

      return {
        name: service.name,
        url: service.url,
        critical: service.critical,
        healthy,
        status: response.status,
        responseTime,
        data,
        error: healthy ? null : `HTTP ${response.status}`
      };
    } catch (error) {
      return {
        name: service.name,
        url: service.url,
        critical: service.critical,
        healthy: false,
        status: 0,
        responseTime: Date.now() - startTime,
        data: null,
        error: error.message
      };
    }
  }

  /**
   * Alert on critical service failures
   * @param {Array} failures - Failed services
   */
  async alertCriticalFailures(failures) {
    const message = `🚨 CRITICAL: ChittyOS services down!\n\n${failures.map(f =>
      `- ${f.name}: ${f.error} (${f.url})`
    ).join('\n')}\n\nImmediate action required.`;

    await this.sendAlert({
      severity: 'critical',
      message,
      channels: ['chat', 'email', 'sms']
    });
  }

  /**
   * Alert on degraded service
   * @param {Array} failures - Failed non-critical services
   */
  async alertDegradedService(failures) {
    const message = `⚠️ Warning: ChittyOS services degraded\n\n${failures.map(f =>
      `- ${f.name}: ${f.error}`
    ).join('\n')}`;

    await this.sendAlert({
      severity: 'warning',
      message,
      channels: ['chat']
    });
  }

  /**
   * Send alert via alert router
   * @param {Object} alert - Alert configuration
   */
  async sendAlert(alert) {
    // Throttle alerts (max 1 per service per 5 minutes)
    const recentAlerts = this.healthState.alertsSent.filter(a =>
      Date.now() - a.timestamp < 5 * 60 * 1000
    );

    if (recentAlerts.length > 0) {
      console.log('Alert throttled:', alert.severity);
      return;
    }

    try {
      const response = await fetch(`${this.env.GATEWAY_SERVICE_URL}/api/alerts/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.CHITTY_ID_TOKEN}`
        },
        body: JSON.stringify(alert)
      });

      if (response.ok) {
        this.healthState.alertsSent.push({
          severity: alert.severity,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }

  /**
   * Get current health status
   */
  async getStatus() {
    return {
      services: this.healthState.services,
      lastCheck: this.healthState.lastCheck,
      summary: {
        total: Object.keys(this.healthState.services).length,
        healthy: Object.values(this.healthState.services).filter(s => s.healthy).length,
        unhealthy: Object.values(this.healthState.services).filter(s => !s.healthy).length
      }
    };
  }

  /**
   * Get specific service status
   * @param {string} serviceName - Service name
   */
  async getServiceStatus(serviceName) {
    const service = CHITTY_SERVICES.find(s => s.name === serviceName);
    if (!service) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    return this.checkService(service);
  }

  /**
   * Handle HTTP fetch
   */
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // GET /check - Check all services
    if (path === '/check' && request.method === 'GET') {
      const result = await this.checkAll();
      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET /status - Get health status
    if (path === '/status' && request.method === 'GET') {
      const status = await this.getStatus();
      return new Response(JSON.stringify({ success: true, data: status }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET /service/:name - Get specific service status
    const serviceMatch = path.match(/^\/service\/(.+)$/);
    if (serviceMatch && request.method === 'GET') {
      const serviceName = decodeURIComponent(serviceMatch[1]);
      try {
        const status = await this.getServiceStatus(serviceName);
        return new Response(JSON.stringify({ success: true, data: status }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
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
    const id = env.HEALTH_MONITOR.idFromName('global');
    const stub = env.HEALTH_MONITOR.get(id);
    return stub.fetch(request);
  },

  /**
   * Scheduled health checks (cron trigger)
   */
  async scheduled(event, env, ctx) {
    const id = env.HEALTH_MONITOR.idFromName('global');
    const stub = env.HEALTH_MONITOR.get(id);

    // Trigger health check
    const response = await stub.fetch(new Request('https://health-monitor/check'));
    const result = await response.json();

    console.log('Scheduled health check:', result.data.summary);
  }
};
