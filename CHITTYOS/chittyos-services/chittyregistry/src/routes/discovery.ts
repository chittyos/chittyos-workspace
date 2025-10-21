// Service Discovery Routes

import { Router, Request, Response } from 'express';
import { RegistryService } from '../services/RegistryService';
import { DiscoveryQuerySchema } from '../types';
import { logger } from '../utils/logger';
import { validateQuery } from '../middleware/validation';

export function createDiscoveryRouter(registry: RegistryService): Router {
  const router = Router();

  /**
   * GET /discover - Discover services based on query parameters
   */
  router.get('/discover', validateQuery(DiscoveryQuerySchema), async (req: Request, res: Response) => {
    try {
      const query = req.query as any;
      const services = await registry.discoverServices(query);

      res.json({
        success: true,
        count: services.length,
        services,
        query
      });

    } catch (error) {
      logger.error('Service discovery failed', { error: error.message, query: req.query });
      res.status(500).json({
        success: false,
        error: 'Service discovery failed'
      });
    }
  });

  /**
   * GET /services/:serviceName - Get specific service details
   */
  router.get('/services/:serviceName', async (req: Request, res: Response) => {
    try {
      const { serviceName } = req.params;
      const service = await registry.getService(serviceName);

      if (!service) {
        return res.status(404).json({
          success: false,
          error: 'Service not found'
        });
      }

      res.json({
        success: true,
        service
      });

    } catch (error) {
      logger.error('Failed to get service', { error: error.message, serviceName: req.params.serviceName });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve service'
      });
    }
  });

  /**
   * GET /services - List all services with optional filtering
   */
  router.get('/services', async (req: Request, res: Response) => {
    try {
      const { category, capability, healthy } = req.query;

      const query: any = {};
      if (category) query.category = category as string;
      if (capability) query.capability = capability as string;
      if (healthy === 'true') query.healthStatus = 'HEALTHY';
      if (healthy === 'false') query.includeUnhealthy = true;

      const services = await registry.discoverServices(query);

      res.json({
        success: true,
        count: services.length,
        services: services.map(service => ({
          serviceName: service.serviceName,
          displayName: service.displayName,
          description: service.description,
          baseUrl: service.baseUrl,
          category: service.category,
          capabilities: service.capabilities,
          version: service.version,
          health: (service as any).currentHealth
        }))
      });

    } catch (error) {
      logger.error('Failed to list services', { error: error.message, query: req.query });
      res.status(500).json({
        success: false,
        error: 'Failed to list services'
      });
    }
  });

  /**
   * GET /health/:serviceName - Get health status for a specific service
   */
  router.get('/health/:serviceName', async (req: Request, res: Response) => {
    try {
      const { serviceName } = req.params;
      const health = await registry.getHealthStatus(serviceName);

      if (!health) {
        return res.status(404).json({
          success: false,
          error: 'Health status not found'
        });
      }

      res.json({
        success: true,
        health
      });

    } catch (error) {
      logger.error('Failed to get health status', { error: error.message, serviceName: req.params.serviceName });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve health status'
      });
    }
  });

  /**
   * GET /categories - Get all available service categories
   */
  router.get('/categories', async (req: Request, res: Response) => {
    try {
      const stats = await registry.getRegistryStats();

      res.json({
        success: true,
        categories: Object.entries(stats.servicesByCategory).map(([name, count]) => ({
          name,
          count
        }))
      });

    } catch (error) {
      logger.error('Failed to get categories', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve categories'
      });
    }
  });

  /**
   * GET /capabilities - Get all available service capabilities
   */
  router.get('/capabilities', async (req: Request, res: Response) => {
    try {
      const services = await registry.discoverServices({});
      const capabilities = new Set<string>();

      services.forEach(service => {
        service.capabilities?.forEach(cap => capabilities.add(cap));
      });

      res.json({
        success: true,
        capabilities: Array.from(capabilities).sort()
      });

    } catch (error) {
      logger.error('Failed to get capabilities', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve capabilities'
      });
    }
  });

  /**
   * POST /resolve - Resolve service endpoint for a specific capability
   */
  router.post('/resolve', async (req: Request, res: Response) => {
    try {
      const { capability } = req.body;

      if (!capability) {
        return res.status(400).json({
          success: false,
          error: 'Capability is required'
        });
      }

      const services = await registry.discoverServices({
        capability,
        healthStatus: 'HEALTHY'
      });

      if (services.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No healthy services found for capability'
        });
      }

      // Simple load balancing - return random healthy service
      const selectedService = services[Math.floor(Math.random() * services.length)];

      res.json({
        success: true,
        service: {
          serviceName: selectedService.serviceName,
          baseUrl: selectedService.baseUrl,
          endpoints: selectedService.endpoints,
          version: selectedService.version
        },
        alternatives: services.length - 1
      });

    } catch (error) {
      logger.error('Service resolution failed', { error: error.message, body: req.body });
      res.status(500).json({
        success: false,
        error: 'Service resolution failed'
      });
    }
  });

  return router;
}
