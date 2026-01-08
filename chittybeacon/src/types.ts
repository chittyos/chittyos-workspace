export interface Env {
  HEALTH_HISTORY: KVNamespace;
  CHECK_INTERVAL_MS: string;
  HISTORY_RETENTION_DAYS: string;
}

export interface ServiceConfig {
  name: string;
  url: string;
  healthEndpoint?: string;
  expectedStatus?: number;
  timeout?: number;
}

export interface HealthCheckResult {
  service: string;
  url: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  statusCode?: number;
  responseTime: number;
  timestamp: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ServiceStatus {
  service: string;
  url: string;
  currentStatus: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: string;
  responseTime: number;
  uptime24h?: number;
  recentChecks?: HealthCheckResult[];
}

export interface EcosystemStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: ServiceStatus[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}
