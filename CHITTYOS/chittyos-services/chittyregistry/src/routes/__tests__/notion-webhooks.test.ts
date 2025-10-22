import express from 'express';
import crypto from 'crypto';
import request from 'supertest';
import notionRouter from '../../routes/notion-webhooks';

describe('Notion Webhooks', () => {
  const makeApp = () => {
    const app = express();
    app.use(express.json());
    app.use(notionRouter);
    return app;
  };

  beforeAll(() => {
    // Stub fetch to avoid real network calls from async processing
    // @ts-ignore
    global.fetch = jest.fn(async () => ({ ok: true, statusText: 'OK' }));
  });

  test('rejects missing signature', async () => {
    const app = makeApp();
    await request(app)
      .post('/webhook/notion')
      .send({ type: 'update', database_id: 'db' })
      .expect(401);
  });

  test('accepts valid signature and returns 200', async () => {
    const payload = { type: 'update', database_id: 'db' };
    const body = JSON.stringify(payload);
    const secret = 'chitty-notion-secret';
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');

    const app = makeApp();
    const res = await request(app)
      .post('/webhook/notion')
      .set('x-notion-signature', sig)
      .send(payload)
      .expect(200);

    expect(res.body).toHaveProperty('received', true);
  });
});

