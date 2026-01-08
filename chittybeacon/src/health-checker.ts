import { ServiceConfig, HealthCheckResult } from './types';

export async function checkServiceHealth(
  service: ServiceConfig
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const checkUrl = service.url + (service.healthEndpoint || '/health');
  const timeout = service.timeout || 5000;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(checkUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'ChittyBeacon/1.0',
      },
    });

    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;
    const statusCode = response.status;

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (statusCode === (service.expectedStatus || 200)) {
      status = responseTime < 1000 ? 'healthy' : 'degraded';
    } else if (statusCode >= 200 && statusCode < 300) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    // Try to parse response body for additional metadata
    let metadata: Record<string, any> | undefined;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        metadata = await response.json();
      }
    } catch (e) {
      // Ignore JSON parse errors
    }

    return {
      service: service.name,
      url: service.url,
      status,
      statusCode,
      responseTime,
      timestamp: new Date().toISOString(),
      metadata,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      service: service.name,
      url: service.url,
      status: 'unhealthy',
      responseTime,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    };
  }
}

export async function checkAllServices(
  services: ServiceConfig[]
): Promise<HealthCheckResult[]> {
  const checks = services.map(service => checkServiceHealth(service));
  return Promise.all(checks);
}
