import { Env, HealthCheckResult, ServiceStatus, EcosystemStatus } from './types';
import { KV_KEYS } from './config';

export async function storeHealthCheck(
  env: Env,
  result: HealthCheckResult
): Promise<void> {
  const serviceName = result.url.replace('https://', '').replace('.chitty.cc', '');

  // Store latest status
  await env.HEALTH_HISTORY.put(
    KV_KEYS.LATEST_STATUS(serviceName),
    JSON.stringify(result),
    {
      expirationTtl: 86400, // 24 hours
    }
  );

  // Store in history with timestamp
  const historyKey = KV_KEYS.HISTORY(serviceName, result.timestamp);
  await env.HEALTH_HISTORY.put(historyKey, JSON.stringify(result), {
    expirationTtl: parseInt(env.HISTORY_RETENTION_DAYS || '7') * 86400,
  });
}

export async function getLatestStatus(
  env: Env,
  serviceName: string
): Promise<HealthCheckResult | null> {
  const data = await env.HEALTH_HISTORY.get(KV_KEYS.LATEST_STATUS(serviceName));
  return data ? JSON.parse(data) : null;
}

export async function getServiceHistory(
  env: Env,
  serviceName: string,
  hours: number = 24
): Promise<HealthCheckResult[]> {
  const now = Date.now();
  const cutoff = now - hours * 60 * 60 * 1000;

  // List all history keys for this service
  const prefix = `history:${serviceName}:`;
  const list = await env.HEALTH_HISTORY.list({ prefix });

  const results: HealthCheckResult[] = [];

  for (const key of list.keys) {
    const data = await env.HEALTH_HISTORY.get(key.name);
    if (data) {
      const result: HealthCheckResult = JSON.parse(data);
      const timestamp = new Date(result.timestamp).getTime();
      if (timestamp >= cutoff) {
        results.push(result);
      }
    }
  }

  // Sort by timestamp descending
  return results.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export async function calculateUptime(
  history: HealthCheckResult[]
): Promise<number> {
  if (history.length === 0) return 0;

  const healthyChecks = history.filter(
    check => check.status === 'healthy' || check.status === 'degraded'
  ).length;

  return (healthyChecks / history.length) * 100;
}

export async function getServiceStatus(
  env: Env,
  serviceName: string
): Promise<ServiceStatus | null> {
  const latest = await getLatestStatus(env, serviceName);
  if (!latest) return null;

  const history = await getServiceHistory(env, serviceName, 24);
  const uptime24h = await calculateUptime(history);

  return {
    service: latest.service,
    url: latest.url,
    currentStatus: latest.status,
    lastCheck: latest.timestamp,
    responseTime: latest.responseTime,
    uptime24h,
    recentChecks: history.slice(0, 10), // Last 10 checks
  };
}

export async function storeEcosystemStatus(
  env: Env,
  status: EcosystemStatus
): Promise<void> {
  await env.HEALTH_HISTORY.put(
    KV_KEYS.ECOSYSTEM_STATUS,
    JSON.stringify(status),
    {
      expirationTtl: 3600, // 1 hour
    }
  );
}

export async function getEcosystemStatus(
  env: Env
): Promise<EcosystemStatus | null> {
  const data = await env.HEALTH_HISTORY.get(KV_KEYS.ECOSYSTEM_STATUS);
  return data ? JSON.parse(data) : null;
}
