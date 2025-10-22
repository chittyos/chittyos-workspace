import express from 'express';
import request from 'supertest';
import { createRegistrationRouter } from '../../routes/registration';

describe('Registration Router', () => {
  const baseService = {
    chittyId: 'chittyos-example',
    serviceName: 'example-service',
    displayName: 'Example Service',
    description: 'Test service',
    version: '1.0.0',
    baseUrl: 'https://example.chitty.cc',
    endpoints: [{ path: '/health', method: 'GET' }],
    healthCheck: { path: '/health', method: 'GET', expectedStatus: 200, timeout: 5000 },
    category: 'core-infrastructure',
    dependencies: [],
    capabilities: ['test-capability'],
    metadata: {},
  };

  const makeApp = (registry: any) => {
    const app = express();
    app.use(express.json());
    const healthMonitor = { checkServiceNow: jest.fn(), checkCanonicalServices: jest.fn() };
    const auth = {
      authenticate: (req: any, _res: any, next: any) => { req.chittyId = 'tester'; next(); },
      requireServiceAdmin: (_req: any, _res: any, next: any) => next(),
      requireServiceOwner: (_req: any, _res: any, next: any) => next(),
      optionalAuth: (_req: any, _res: any, next: any) => next(),
      requireScope: () => (_req: any, _res: any, next: any) => next(),
      generateServiceToken: jest.fn(async () => 'token-123'),
    } as any;
    app.use('/api/v1', createRegistrationRouter(registry as any, healthMonitor as any, auth));
    return { app, auth, healthMonitor };
  };

  test('POST /register registers a service and triggers health check', async () => {
    jest.useFakeTimers();
    const registry = { registerService: jest.fn().mockResolvedValue({ success: true }) };
    const { app } = makeApp(registry);

    const res = await request(app)
      .post('/api/v1/register')
      .send({ service: baseService, registrationToken: 'good', environment: 'staging' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(registry.registerService).toHaveBeenCalled();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('POST /register returns 400 on validation error', async () => {
    const registry = { registerService: jest.fn() };
    const { app } = makeApp(registry);

    await request(app)
      .post('/api/v1/register')
      .send({})
      .expect(400);
  });

  test('PUT /services/:name returns 400 on name mismatch', async () => {
    const registry = {
      getService: jest.fn().mockResolvedValue({ serviceName: 'example-service' }),
      registerService: jest.fn(),
    };
    const { app } = makeApp(registry);
    await request(app)
      .put('/api/v1/services/other-service')
      .send({ service: baseService, registrationToken: 't', environment: 'production' })
      .expect(400);
  });

  test('POST /services/:name/health rejects invalid status', async () => {
    const registry = { updateHealthStatus: jest.fn() };
    const { app } = makeApp(registry);
    await request(app)
      .post('/api/v1/services/example-service/health')
      .send({ status: 'WRONG' })
      .expect(400);
  });

  test('GET /token/:serviceName returns token', async () => {
    const registry = {};
    const { app } = makeApp(registry);
    const res = await request(app)
      .get('/api/v1/token/example-service')
      .expect(200);
    expect(res.body).toHaveProperty('token');
  });

  test('PUT /services/:name updates service successfully', async () => {
    jest.useFakeTimers();
    const registry = {
      getService: jest.fn().mockResolvedValue({ serviceName: 'example-service' }),
      registerService: jest.fn().mockResolvedValue({ success: true }),
    };
    const { app } = makeApp(registry);
    const res = await request(app)
      .put('/api/v1/services/example-service')
      .send({ service: baseService, registrationToken: 't', environment: 'production' })
      .expect(200);
    expect(res.body.success).toBe(true);
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('POST /services/:name/health updates successfully', async () => {
    const registry = { updateHealthStatus: jest.fn().mockResolvedValue(undefined) };
    const { app } = makeApp(registry);
    const res = await request(app)
      .post('/api/v1/services/example-service/health')
      .send({ status: 'HEALTHY', responseTime: 10, uptime: 99 })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(registry.updateHealthStatus).toHaveBeenCalled();
  });

  test('DELETE /services/:name succeeds with valid token', async () => {
    const registry = {
      deregisterService: jest.fn().mockResolvedValue({ success: true }),
    };
    const { app } = makeApp(registry);
    const res = await request(app)
      .delete('/api/v1/services/example-service')
      .send({ token: 'valid' })
      .expect(200);
    expect(res.body.success).toBe(true);
  });

  test('DELETE /services/:name returns 400 on failure', async () => {
    const registry = {
      deregisterService: jest.fn().mockResolvedValue({ success: false, error: 'Invalid deregistration token' }),
    };
    const { app } = makeApp(registry);
    const res = await request(app)
      .delete('/api/v1/services/example-service')
      .send({ token: 'invalid' })
      .expect(400);
    expect(res.body.error).toBe('Invalid deregistration token');
  });
});
