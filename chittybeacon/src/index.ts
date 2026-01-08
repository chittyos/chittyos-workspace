import { Env } from './types';
import {
  handleHealth,
  handleStatus,
  handleServiceStatus,
  handleCheck,
  handleOptions,
  handleNotFound,
} from './handlers';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return handleOptions();
    }

    // Route handling
    try {
      // GET /health - Own health check
      if (path === '/health' && method === 'GET') {
        return handleHealth();
      }

      // GET /status - Overall ecosystem status
      if (path === '/status' && method === 'GET') {
        return handleStatus(env);
      }

      // GET /status/:service - Specific service status
      if (path.startsWith('/status/') && method === 'GET') {
        const serviceName = path.split('/')[2];
        return handleServiceStatus(env, serviceName);
      }

      // POST /check - Trigger health checks
      if (path === '/check' && method === 'POST') {
        return handleCheck(env);
      }

      // 404 - Not found
      return handleNotFound();
    } catch (error) {
      console.error('Error handling request:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  },

  // Scheduled task for periodic health checks
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Running scheduled health check...');

    const { checkAllServices } = await import('./health-checker');
    const { storeHealthCheck } = await import('./storage');
    const { SERVICES } = await import('./config');

    try {
      const results = await checkAllServices(SERVICES);
      await Promise.all(results.map(result => storeHealthCheck(env, result)));
      console.log(`Health check completed: ${results.length} services checked`);
    } catch (error) {
      console.error('Error during scheduled health check:', error);
    }
  },
};
