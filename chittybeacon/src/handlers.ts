import { Env, EcosystemStatus } from './types';
import { SERVICES, SERVICE_MAP } from './config';
import { checkAllServices, checkServiceHealth } from './health-checker';
import {
  storeHealthCheck,
  getServiceStatus,
  storeEcosystemStatus,
  getEcosystemStatus,
} from './storage';

export async function handleHealth(): Promise<Response> {
  return new Response(
    JSON.stringify({
      status: 'healthy',
      service: 'ChittyBeacon',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

export async function handleStatus(env: Env): Promise<Response> {
  // Try to get cached ecosystem status
  let ecosystemStatus = await getEcosystemStatus(env);

  // If no cached status or older than 5 minutes, refresh
  if (
    !ecosystemStatus ||
    Date.now() - new Date(ecosystemStatus.timestamp).getTime() > 5 * 60 * 1000
  ) {
    // Fetch status for all services
    const statusPromises = SERVICES.map(async service => {
      const serviceName = service.url.replace('https://', '').replace('.chitty.cc', '');
      return await getServiceStatus(env, serviceName);
    });

    const serviceStatuses = (await Promise.all(statusPromises)).filter(
      status => status !== null
    );

    // Calculate overall status
    const healthy = serviceStatuses.filter(s => s!.currentStatus === 'healthy').length;
    const degraded = serviceStatuses.filter(s => s!.currentStatus === 'degraded').length;
    const unhealthy = serviceStatuses.filter(s => s!.currentStatus === 'unhealthy').length;

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthy > 0) {
      overall = unhealthy > serviceStatuses.length / 2 ? 'unhealthy' : 'degraded';
    } else if (degraded > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    ecosystemStatus = {
      overall,
      timestamp: new Date().toISOString(),
      services: serviceStatuses as any[],
      summary: {
        total: serviceStatuses.length,
        healthy,
        degraded,
        unhealthy,
      },
    };

    // Cache the ecosystem status
    await storeEcosystemStatus(env, ecosystemStatus);
  }

  return new Response(JSON.stringify(ecosystemStatus, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function handleServiceStatus(
  env: Env,
  serviceName: string
): Promise<Response> {
  const status = await getServiceStatus(env, serviceName);

  if (!status) {
    return new Response(
      JSON.stringify({
        error: 'Service not found or no health data available',
        service: serviceName,
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  return new Response(JSON.stringify(status, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function handleCheck(env: Env): Promise<Response> {
  // Perform health checks on all services
  const results = await checkAllServices(SERVICES);

  // Store results
  await Promise.all(results.map(result => storeHealthCheck(env, result)));

  // Calculate summary
  const healthy = results.filter(r => r.status === 'healthy').length;
  const degraded = results.filter(r => r.status === 'degraded').length;
  const unhealthy = results.filter(r => r.status === 'unhealthy').length;

  const response = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      healthy,
      degraded,
      unhealthy,
    },
    results,
  };

  return new Response(JSON.stringify(response, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function handleOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function handleNotFound(): Promise<Response> {
  return new Response(
    JSON.stringify({
      error: 'Not Found',
      endpoints: {
        '/health': 'GET - Check beacon service health',
        '/status': 'GET - Get overall ecosystem status',
        '/status/:service': 'GET - Get specific service status',
        '/check': 'POST - Trigger health checks',
      },
    }),
    {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
