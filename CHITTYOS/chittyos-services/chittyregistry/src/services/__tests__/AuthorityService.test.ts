import axios from 'axios';
import { AuthorityService } from '../AuthorityService';

jest.mock('axios');

const mockedAxios = axios as unknown as {
  create: jest.Mock<any, any>;
};

describe('AuthorityService', () => {
  const clients: any[] = [];

  beforeEach(() => {
    clients.length = 0;
    mockedAxios.create.mockImplementation((cfg) => {
      const client = {
        baseURL: cfg?.baseURL,
        get: jest.fn(async (path: string) => {
          if (path === '/health') return { data: { status: 'ok' } };
          // trust score
          if (path.startsWith('/score/')) return { data: { score: 90, level: 'GOLD' } };
          return { data: {} };
        }),
        post: jest.fn(async (path: string, body: any) => {
          if (path === '/validate' && body?.token) return { data: { valid: true, chittyId: 'issuer-xyz' } };
          if (path === '/validate') return { data: { compliant: true, issues: [] } };
          if (path === '/update') return { data: { ok: true } };
          return { data: {} };
        }),
      };
      clients.push(client);
      return client;
    });
  });

  const authorities = {
    chittySchema: { url: 'https://schema.chitty.cc', endpoints: { validateSchema: '/validate', getSchema: '/schema', listSchemas: '/schemas' } },
    chittyCanon: { url: 'https://canon.chitty.cc', endpoints: { getCanonical: '/canonical', validateData: '/validate', getStandards: '/standards' } },
    chittyId: { url: 'https://id.chitty.cc', endpoints: { validateToken: '/validate', generateToken: '/token', refreshToken: '/refresh' } },
    chittyTrust: { url: 'https://trust.chitty.cc', endpoints: { getTrustScore: '/score', validateTrust: '/validate', updateScore: '/update' } },
  } as any;

  test('validateRegistrationToken returns valid true', async () => {
    const svc = new AuthorityService(authorities);
    const result = await svc.validateRegistrationToken('token-123', 'svc-1');
    expect(result.valid).toBe(true);
    expect(result.chittyId).toBe('issuer-xyz');
  });

  test('checkAuthorityHealth reports healthy on /health', async () => {
    const svc = new AuthorityService(authorities);
    const health = await svc.checkAuthorityHealth();
    expect(Object.keys(health)).toEqual(['schema', 'canon', 'id', 'trust']);
    expect(health.schema.status).toBe('HEALTHY');
  });

  test('getCanonicalServiceDefinition returns null on 404', async () => {
    // Arrange: canon client get throws with 404
    const svc = new AuthorityService(authorities);
    const canon = clients[1];
    canon.get.mockRejectedValueOnce({ response: { status: 404 } });
    const res = await svc.getCanonicalServiceDefinition('missing');
    expect(res).toBeNull();
  });

  test('getServiceTrustScore returns null on 404', async () => {
    const svc = new AuthorityService(authorities);
    const trust = clients[3];
    trust.get.mockRejectedValueOnce({ response: { status: 404 } });
    const res = await svc.getServiceTrustScore('nope');
    expect(res).toBeNull();
  });

  test('validateRegistrationToken handles error as invalid', async () => {
    const svc = new AuthorityService(authorities);
    const id = clients[2];
    id.post.mockRejectedValueOnce(new Error('boom'));
    const res = await svc.validateRegistrationToken('bad', 'svc-1');
    expect(res.valid).toBe(false);
  });
});
