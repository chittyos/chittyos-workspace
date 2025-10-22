import { RedisService } from '../RedisService';

jest.mock('redis', () => {
  const store = new Map<string, string>();
  const client = {
    connect: jest.fn(async () => {}),
    disconnect: jest.fn(async () => {}),
    on: jest.fn(() => client),
    set: jest.fn(async (key: string, value: string) => { store.set(key, value); }),
    setEx: jest.fn(async (key: string, _ttl: number, value: string) => { store.set(key, value); }),
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    del: jest.fn(async (key: string) => { const had = store.delete(key); return had ? 1 : 0; }),
    exists: jest.fn(async (key: string) => store.has(key) ? 1 : 0),
    sAdd: jest.fn(), sRem: jest.fn(), sMembers: jest.fn(), sIsMember: jest.fn(),
    hSet: jest.fn(), hGet: jest.fn(), hGetAll: jest.fn(), hDel: jest.fn(),
    expire: jest.fn(), ttl: jest.fn(), ping: jest.fn(), flushDb: jest.fn(), keys: jest.fn(),
  };
  return { createClient: () => client };
});

describe('RedisService JSON helpers', () => {
  test('setJSON/getJSON round trip', async () => {
    const svc = new RedisService('redis://localhost:6379');
    await svc.setJSON('k1', { a: 1 });
    const out = await svc.getJSON('k1');
    expect(out).toEqual({ a: 1 });
  });

  test('getJSON returns null on invalid JSON', async () => {
    const svc = new RedisService('redis://localhost:6379');
    // @ts-ignore accessing private method via type cast: use set to inject invalid JSON
    await (svc as any).set('k2', '{invalid');
    const out = await svc.getJSON('k2');
    expect(out).toBeNull();
  });
});

