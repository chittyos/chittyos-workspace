import { statusCommand } from '../../commands/status';

jest.mock('node-fetch', () => {
  const okResponse = { ok: true, json: async () => ({ status: 'healthy' }) };
  return {
    __esModule: true,
    default: jest.fn(async () => okResponse),
  };
});

jest.mock('child_process', () => ({
  execSync: jest.fn(() => 'PASS')
}));

describe('CLI status command', () => {
  test('runs in JSON mode without throwing', async () => {
    process.env.CHITTYOS_REGISTRY_URL = 'http://localhost:3001';
    await expect(statusCommand({ json: true })).resolves.toBeUndefined();
  });
});

