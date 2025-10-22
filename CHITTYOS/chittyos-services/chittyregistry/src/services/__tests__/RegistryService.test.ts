import { RegistryService } from '../RegistryService';
import type { ServiceRegistration, Service } from '../../types';

describe('RegistryService.registerService', () => {
  const baseService: Service = {
    chittyId: 'chittyos-example',
    serviceName: 'example-service',
    displayName: 'Example Service',
    description: 'Test service',
    version: '1.0.0',
    baseUrl: 'https://example.chitty.cc',
    endpoints: [],
    healthCheck: { path: '/health', method: 'GET', expectedStatus: 200, timeout: 5000 },
    category: 'core-infrastructure',
    dependencies: [],
    capabilities: ['test-capability'],
    metadata: {},
  };

  const makeMocks = () => {
    const redis = {
      setJSON: jest.fn().mockResolvedValue(undefined),
      sadd: jest.fn().mockResolvedValue(undefined),
      getJSON: jest.fn().mockResolvedValue(baseService),
      exists: jest.fn(),
      smembers: jest.fn(),
      del: jest.fn(),
      srem: jest.fn(),
    } as any;

    const authority = {
      validateRegistrationToken: jest.fn(),
      validateServiceSchema: jest.fn(),
      getCanonicalServiceDefinition: jest.fn(),
      validateDataStandards: jest.fn(),
      getServiceTrustScore: jest.fn(),
      updateServiceTrustScore: jest.fn(),
      checkAuthorityHealth: jest.fn(),
    } as any;

    return { redis, authority };
  };

  test('returns failure on invalid registration token', async () => {
    const { redis, authority } = makeMocks();
    authority.validateRegistrationToken.mockResolvedValue({ valid: false });

    const service = new RegistryService(redis, authority);
    const result = await service.registerService({
      service: baseService,
      registrationToken: 'bad-token',
      environment: 'staging',
    } as ServiceRegistration);

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Invalid registration token');
    expect(redis.setJSON).not.toHaveBeenCalled();
  });

  test('registers service and initializes health on valid token', async () => {
    const { redis, authority } = makeMocks();
    authority.validateRegistrationToken.mockResolvedValue({ valid: true, chittyId: 'issuer-123' });
    authority.validateServiceSchema.mockResolvedValue({ valid: true, errors: [] });
    authority.getCanonicalServiceDefinition.mockResolvedValue(null);
    authority.getServiceTrustScore.mockResolvedValue({ score: 80, level: 'GOLD' });

    const service = new RegistryService(redis, authority);
    const result = await service.registerService({
      service: baseService,
      registrationToken: 'good-token',
      environment: 'production',
    } as ServiceRegistration);

    expect(result.success).toBe(true);
    // First call: store service; Second call: store initial health
    expect(redis.setJSON).toHaveBeenCalledTimes(2);
    expect(redis.sadd).toHaveBeenCalledWith('chittyregistry:service-names', baseService.serviceName);
    expect(authority.updateServiceTrustScore).toHaveBeenCalled();
  });
});

