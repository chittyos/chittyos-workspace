import express from 'express';
import request from 'supertest';
import { createDiscoveryRouter } from '../../routes/discovery';

describe('Discovery Router', () => {
  const makeApp = (registry: any) => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1', createDiscoveryRouter(registry));
    return app;
  };

  test('GET /discover returns services', async () => {
    const registry = {
      discoverServices: jest.fn().mockResolvedValue([
        {
          serviceName: 'svc1',
          displayName: 'Service 1',
          description: 'desc',
          baseUrl: 'https://svc1',
          category: 'core-infrastructure',
          capabilities: ['x'],
          version: '1.0.0',
          currentHealth: { status: 'HEALTHY' },
        },
      ]),
    };
    const app = makeApp(registry);

    const res = await request(app).get('/api/v1/discover?capability=x').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(registry.discoverServices).toHaveBeenCalled();
  });

  test('GET /services/:serviceName returns 404 when missing', async () => {
    const registry = { getService: jest.fn().mockResolvedValue(null) };
    const app = makeApp(registry);
    await request(app).get('/api/v1/services/unknown').expect(404);
  });

  test('POST /resolve selects a healthy service', async () => {
    const registry = {
      discoverServices: jest.fn().mockResolvedValue([
        {
          serviceName: 'svcA',
          baseUrl: 'https://a',
          endpoints: [],
          version: '1.0.0',
        },
        {
          serviceName: 'svcB',
          baseUrl: 'https://b',
          endpoints: [],
          version: '1.0.1',
        },
      ]),
    };
    const app = makeApp(registry);
    const res = await request(app)
      .post('/api/v1/resolve')
      .send({ capability: 'x' })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.service).toHaveProperty('serviceName');
  });

  test('GET /discover returns 500 on registry error', async () => {
    const registry = { discoverServices: jest.fn().mockRejectedValue(new Error('boom')) };
    const app = makeApp(registry);
    const res = await request(app).get('/api/v1/discover').expect(500);
    expect(res.body.success).toBe(false);
  });

  test('GET /services returns 500 on registry error', async () => {
    const registry = { discoverServices: jest.fn().mockRejectedValue(new Error('boom')) };
    const app = makeApp(registry);
    const res = await request(app).get('/api/v1/services').expect(500);
    expect(res.body.success).toBe(false);
  });
});
