// Service Registration and Management Routes

import { Router, Response } from 'express';
import { RegistryService } from '../services/RegistryService';
import { HealthMonitor } from '../services/HealthMonitor';
import { AuthMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { ServiceRegistrationSchema } from '../types';
import { validateBody } from '../middleware/validation';
import { logger } from '../utils/logger';

export function createRegistrationRouter(
  registry: RegistryService,
  healthMonitor: HealthMonitor,
  auth: AuthMiddleware
): Router {
  const router = Router();

  /**
   * POST /register - Register a new service
   */
  router.post(
    '/register',
    auth.authenticate,
    auth.requireServiceAdmin,
    validateBody(ServiceRegistrationSchema),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const registration = req.body;

        // Log registration attempt
        logger.info('Service registration attempted', {
          serviceName: registration.service.serviceName,
          chittyId: req.chittyId,
          environment: registration.environment
        });

        const result = await registry.registerService(registration);

        if (!result.success) {
          return res.status(400).json({
            success: false,
            error: 'Registration failed',
            details: result.errors
          });
        }

        // Trigger immediate health check for new service
        setTimeout(() => {
          healthMonitor.checkServiceNow(registration.service.serviceName);
        }, 1000);

        res.status(201).json({
          success: true,
          message: 'Service registered successfully',
          serviceName: registration.service.serviceName
        });

      } catch (error) {
        logger.error('Service registration error', {
          error: error.message,
          chittyId: req.chittyId
        });
        res.status(500).json({
          success: false,
          error: 'Registration service error'
        });
      }
    }
  );

  /**
   * PUT /services/:serviceName - Update an existing service
   */
  router.put(
    '/services/:serviceName',
    auth.authenticate,
    auth.requireServiceOwner,
    validateBody(ServiceRegistrationSchema),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { serviceName } = req.params;
        const registration = req.body;

        // Verify service name matches
        if (registration.service.serviceName !== serviceName) {
          return res.status(400).json({
            success: false,
            error: 'Service name mismatch'
          });
        }

        // Check if service exists
        const existingService = await registry.getService(serviceName);
        if (!existingService) {
          return res.status(404).json({
            success: false,
            error: 'Service not found'
          });
        }

        const result = await registry.registerService(registration);

        if (!result.success) {
          return res.status(400).json({
            success: false,
            error: 'Update failed',
            details: result.errors
          });
        }

        // Trigger health check after update
        setTimeout(() => {
          healthMonitor.checkServiceNow(serviceName);
        }, 1000);

        res.json({
          success: true,
          message: 'Service updated successfully'
        });

      } catch (error) {
        logger.error('Service update error', {
          error: error.message,
          serviceName: req.params.serviceName,
          chittyId: req.chittyId
        });
        res.status(500).json({
          success: false,
          error: 'Update service error'
        });
      }
    }
  );

  /**
   * DELETE /services/:serviceName - Deregister a service
   */
  router.delete(
    '/services/:serviceName',
    auth.authenticate,
    auth.requireServiceOwner,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { serviceName } = req.params;
        const { token } = req.body;

        if (!token) {
          return res.status(400).json({
            success: false,
            error: 'Deregistration token required'
          });
        }

        const result = await registry.deregisterService(serviceName, token);

        if (!result.success) {
          return res.status(400).json({
            success: false,
            error: result.error
          });
        }

        logger.info('Service deregistered', {
          serviceName,
          chittyId: req.chittyId
        });

        res.json({
          success: true,
          message: 'Service deregistered successfully'
        });

      } catch (error) {
        logger.error('Service deregistration error', {
          error: error.message,
          serviceName: req.params.serviceName,
          chittyId: req.chittyId
        });
        res.status(500).json({
          success: false,
          error: 'Deregistration service error'
        });
      }
    }
  );

  /**
   * POST /services/:serviceName/health - Update health status manually
   */
  router.post(
    '/services/:serviceName/health',
    auth.authenticate,
    auth.requireServiceOwner,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { serviceName } = req.params;
        const healthStatus = req.body;

        // Validate basic health status structure
        if (!healthStatus.status || !['HEALTHY', 'DEGRADED', 'UNHEALTHY'].includes(healthStatus.status)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid health status'
          });
        }

        const updatedHealth = {
          serviceId: serviceName,
          status: healthStatus.status,
          lastCheck: new Date().toISOString(),
          responseTime: healthStatus.responseTime || 0,
          uptime: healthStatus.uptime || 0,
          details: healthStatus.details || {}
        };

        await registry.updateHealthStatus(serviceName, updatedHealth);

        res.json({
          success: true,
          message: 'Health status updated'
        });

      } catch (error) {
        logger.error('Health status update error', {
          error: error.message,
          serviceName: req.params.serviceName,
          chittyId: req.chittyId
        });
        res.status(500).json({
          success: false,
          error: 'Health update service error'
        });
      }
    }
  );

  /**
   * POST /services/:serviceName/check - Trigger immediate health check
   */
  router.post(
    '/services/:serviceName/check',
    auth.optionalAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { serviceName } = req.params;

        const health = await healthMonitor.checkServiceNow(serviceName);

        if (!health) {
          return res.status(404).json({
            success: false,
            error: 'Service not found or health check failed'
          });
        }

        res.json({
          success: true,
          health
        });

      } catch (error) {
        logger.error('Health check trigger error', {
          error: error.message,
          serviceName: req.params.serviceName
        });
        res.status(500).json({
          success: false,
          error: 'Health check service error'
        });
      }
    }
  );

  /**
   * POST /bootstrap - Bootstrap canonical ChittyOS services
   */
  router.post(
    '/bootstrap',
    auth.authenticate,
    auth.requireScope('system:admin'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        await registry.bootstrapCanonicalServices();

        // Trigger health checks for all canonical services
        setTimeout(() => {
          healthMonitor.checkCanonicalServices();
        }, 2000);

        res.json({
          success: true,
          message: 'Canonical services bootstrapped successfully'
        });

      } catch (error) {
        logger.error('Bootstrap error', {
          error: error.message,
          chittyId: req.chittyId
        });
        res.status(500).json({
          success: false,
          error: 'Bootstrap service error'
        });
      }
    }
  );

  /**
   * GET /token/:serviceName - Generate service registration token
   */
  router.get(
    '/token/:serviceName',
    auth.authenticate,
    auth.requireServiceAdmin,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { serviceName } = req.params;

        if (!req.chittyId) {
          return res.status(401).json({
            success: false,
            error: 'ChittyID not found'
          });
        }

        const token = await auth.generateServiceToken(req.chittyId, serviceName);

        if (!token) {
          return res.status(500).json({
            success: false,
            error: 'Failed to generate token'
          });
        }

        res.json({
          success: true,
          token,
          expiresIn: '1h',
          serviceName
        });

      } catch (error) {
        logger.error('Token generation error', {
          error: error.message,
          serviceName: req.params.serviceName,
          chittyId: req.chittyId
        });
        res.status(500).json({
          success: false,
          error: 'Token generation service error'
        });
      }
    }
  );

  return router;
}
