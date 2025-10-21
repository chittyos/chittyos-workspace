// Health Monitoring Service for all ChittyOS services

import axios, { AxiosResponse } from 'axios';
import * as cron from 'node-cron';
import { Service, HealthStatus, CHITTYOS_SERVICES } from '../types';
import { RegistryService } from './RegistryService';
import { logger } from '../utils/logger';

export class HealthMonitor {
  private isRunning = false;
  private cronJob?: cron.ScheduledTask;

  constructor(
    private registry: RegistryService,
    private config: {
      interval: number;
      timeout: number;
      retries: number;
    }
  ) {}

  /**
   * Start health monitoring for all services
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Health monitor is already running');
      return;
    }

    // Convert interval from milliseconds to cron format
    const intervalSeconds = Math.max(30, Math.floor(this.config.interval / 1000));
    const cronExpression = `*/${intervalSeconds} * * * * *`;

    this.cronJob = cron.schedule(cronExpression, async () => {
      await this.performHealthChecks();
    }, {
      scheduled: false
    });

    this.cronJob.start();
    this.isRunning = true;

    logger.info('Health monitor started', {
      interval: intervalSeconds,
      cronExpression
    });

    // Perform initial health check
    setImmediate(() => this.performHealthChecks());
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = undefined;
    }
    this.isRunning = false;
    logger.info('Health monitor stopped');
  }

  /**
   * Perform health checks for all registered services
   */
  private async performHealthChecks(): Promise<void> {
    try {
      logger.debug('Starting health check cycle');

      // Get all registered services
      const services = await this.registry.discoverServices({ includeUnhealthy: true });

      // Check all services in parallel with limited concurrency
      const healthPromises = services.map(service =>
        this.checkServiceHealth(service).catch(error => {
          logger.error('Health check failed', {
            serviceName: service.serviceName,
            error: error.message
          });
          return this.createUnhealthyStatus(service, error.message);
        })
      );

      const healthResults = await Promise.all(healthPromises);

      // Update health statuses
      await Promise.all(
        healthResults.map(health =>
          this.registry.updateHealthStatus(health.serviceId, health)
        )
      );

      const healthyCount = healthResults.filter(h => h.status === 'HEALTHY').length;
      const totalCount = healthResults.length;

      logger.info('Health check cycle completed', {
        healthy: healthyCount,
        total: totalCount,
        unhealthy: totalCount - healthyCount
      });

    } catch (error) {
      logger.error('Health check cycle failed', { error: error.message });
    }
  }

  /**
   * Check health of a specific service
   */
  private async checkServiceHealth(service: Service): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      const healthUrl = `${service.baseUrl}${service.healthCheck?.path || '/health'}`;
      const method = service.healthCheck?.method || 'GET';
      const expectedStatus = service.healthCheck?.expectedStatus || 200;
      const timeout = service.healthCheck?.timeout || this.config.timeout;

      let response: AxiosResponse;
      let attempt = 0;

      // Retry logic
      while (attempt < this.config.retries) {
        try {
          response = await axios({
            method,
            url: healthUrl,
            timeout,
            validateStatus: (status) => status === expectedStatus,
            headers: {
              'User-Agent': 'ChittyRegistry-HealthMonitor/1.0'
            }
          });
          break;
        } catch (error) {
          attempt++;
          if (attempt >= this.config.retries) {
            throw error;
          }
          await this.delay(1000 * attempt); // Exponential backoff
        }
      }

      const responseTime = Date.now() - startTime;

      // Parse health response if it's JSON
      let healthDetails: any = {};
      try {
        if (response.headers['content-type']?.includes('application/json')) {
          healthDetails = response.data;
        }
      } catch (parseError) {
        // Ignore JSON parse errors
      }

      // Determine overall health status
      let status: HealthStatus['status'] = 'HEALTHY';
      if (responseTime > timeout * 0.8) {
        status = 'DEGRADED'; // Slow response
      }

      // Check for specific health indicators in response
      if (healthDetails.status) {
        switch (healthDetails.status.toLowerCase()) {
          case 'healthy':
          case 'ok':
          case 'up':
            status = 'HEALTHY';
            break;
          case 'degraded':
          case 'warning':
            status = 'DEGRADED';
            break;
          case 'unhealthy':
          case 'down':
          case 'error':
            status = 'UNHEALTHY';
            break;
        }
      }

      return {
        serviceId: service.serviceName,
        status,
        lastCheck: new Date().toISOString(),
        responseTime,
        uptime: this.calculateUptime(service.serviceName, status),
        details: {
          version: healthDetails.version || service.version,
          dependencies: healthDetails.dependencies,
          metrics: healthDetails.metrics,
          errors: healthDetails.errors || []
        }
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      return this.createUnhealthyStatus(service, error.message, responseTime);
    }
  }

  /**
   * Create unhealthy status for a service
   */
  private createUnhealthyStatus(service: Service, errorMessage: string, responseTime?: number): HealthStatus {
    return {
      serviceId: service.serviceName,
      status: 'UNHEALTHY',
      lastCheck: new Date().toISOString(),
      responseTime: responseTime || 0,
      uptime: 0,
      details: {
        version: service.version,
        errors: [errorMessage]
      }
    };
  }

  /**
   * Calculate uptime percentage for a service
   */
  private calculateUptime(serviceName: string, currentStatus: HealthStatus['status']): number {
    // TODO: Implement proper uptime calculation based on historical data
    // For now, return simple values based on current status
    switch (currentStatus) {
      case 'HEALTHY':
        return 100;
      case 'DEGRADED':
        return 80;
      case 'UNHEALTHY':
        return 0;
      default:
        return 50;
    }
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check health of a specific service on-demand
   */
  async checkServiceNow(serviceName: string): Promise<HealthStatus | null> {
    try {
      const service = await this.registry.getService(serviceName);
      if (!service) {
        return null;
      }

      const health = await this.checkServiceHealth(service);
      await this.registry.updateHealthStatus(serviceName, health);

      return health;

    } catch (error) {
      logger.error('On-demand health check failed', {
        serviceName,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get health monitoring statistics
   */
  getMonitoringStats(): {
    isRunning: boolean;
    interval: number;
    timeout: number;
    retries: number;
    nextCheck?: Date;
    } {
    return {
      isRunning: this.isRunning,
      interval: this.config.interval,
      timeout: this.config.timeout,
      retries: this.config.retries,
      nextCheck: undefined
    };
  }

  /**
   * Perform health checks for all canonical ChittyOS services
   */
  async checkCanonicalServices(): Promise<Record<string, HealthStatus>> {
    const results: Record<string, HealthStatus> = {};

    const canonicalChecks = Object.entries(CHITTYOS_SERVICES).map(async ([serviceName, config]) => {
      try {
        const service: Service = {
          chittyId: `chittyos-${serviceName}`,
          serviceName,
          displayName: config.displayName,
          description: config.description,
          version: '1.0.0',
          baseUrl: config.baseUrl,
          endpoints: [],
          healthCheck: {
            path: '/health',
            method: 'GET',
            expectedStatus: 200,
            timeout: 5000
          },
          category: config.category,
          dependencies: [],
          capabilities: config.capabilities
        };

        const health = await this.checkServiceHealth(service);
        results[serviceName] = health;

      } catch (error) {
        results[serviceName] = {
          serviceId: serviceName,
          status: 'UNHEALTHY',
          lastCheck: new Date().toISOString(),
          responseTime: 0,
          uptime: 0,
          details: {
            errors: [error.message]
          }
        };
      }
    });

    await Promise.all(canonicalChecks);
    return results;
  }
}