import { SecretsConfig, EnvironmentConfig, SecretItem, Plugin } from '../types';
import { OnePasswordProvider } from '../providers/OnePasswordProvider';
import { PluginManager } from './PluginManager';
import { CycleManager } from './CycleManager';
import { Logger } from '../utils/Logger';

export class SecretsManager {
  private config: SecretsConfig;
  private provider: OnePasswordProvider;
  private pluginManager: PluginManager;
  private cycleManager: CycleManager;
  private logger: Logger;
  private secretsCache: Map<string, SecretItem> = new Map();

  constructor(config: SecretsConfig) {
    this.config = config;
    this.logger = new Logger();
    this.provider = new OnePasswordProvider(config);
    this.pluginManager = new PluginManager(config.plugins, this.logger);
    this.cycleManager = new CycleManager(config.cycling, this.logger);
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Secrets Manager...');

    await this.provider.initialize();
    await this.pluginManager.loadPlugins();

    if (this.config.cycling.enabled) {
      await this.cycleManager.initialize();
    }

    this.logger.info('Secrets Manager initialized successfully');
  }

  async getSecret(key: string, environment: string): Promise<string | null> {
    const cacheKey = `${environment}:${key}`;

    // Check cache first
    if (this.secretsCache.has(cacheKey)) {
      const cached = this.secretsCache.get(cacheKey)!;
      this.logger.debug(`Retrieved secret ${key} from cache for environment ${environment}`);
      return cached.value;
    }

    // Get environment config
    const envConfig = this.getEnvironmentConfig(environment);
    if (!envConfig) {
      this.logger.error(`Environment ${environment} not found`);
      return null;
    }

    // Find secret mapping
    const mapping = envConfig.secrets.find(s => s.key === key);
    if (!mapping) {
      this.logger.error(`Secret ${key} not found in environment ${environment}`);
      return null;
    }

    try {
      // Fetch from provider
      let value = await this.provider.getSecret(mapping.source);

      if (!value) {
        this.logger.error(`Failed to retrieve secret ${mapping.source} from provider`);
        return null;
      }

      // Apply transformations
      if (mapping.transform) {
        value = await this.applyTransformations(value, mapping.transform, environment);
      }

      // Cache the secret
      const secretItem: SecretItem = {
        id: mapping.source,
        key,
        value,
        metadata: {
          source: mapping.source,
          environment,
          lastCycled: new Date()
        }
      };

      this.secretsCache.set(cacheKey, secretItem);

      this.logger.info(`Successfully retrieved secret ${key} for environment ${environment}`);
      return value;

    } catch (error) {
      this.logger.error(`Error retrieving secret ${key}:`, error);
      return null;
    }
  }

  async injectSecrets(environment: string, target?: 'env' | 'file' | 'stdout'): Promise<boolean> {
    this.logger.info(`Injecting secrets for environment: ${environment}`);

    const envConfig = this.getEnvironmentConfig(environment);
    if (!envConfig) {
      this.logger.error(`Environment ${environment} not found`);
      return false;
    }

    const secrets: Record<string, string> = {};

    // Collect all secrets for the environment
    for (const mapping of envConfig.secrets) {
      const value = await this.getSecret(mapping.key, environment);
      if (value !== null) {
        secrets[mapping.key] = value;
      } else if (mapping.required) {
        this.logger.error(`Required secret ${mapping.key} could not be retrieved`);
        return false;
      }
    }

    // Apply injection plugins
    const injectors = await this.pluginManager.getPlugins('injector');
    for (const injector of injectors) {
      await injector.execute({
        environment,
        config: { secrets, target },
        logger: this.logger
      });
    }

    this.logger.info(`Successfully injected ${Object.keys(secrets).length} secrets`);
    return true;
  }

  async cycleSecrets(environment?: string): Promise<void> {
    if (!this.config.cycling.enabled) {
      this.logger.warn('Secret cycling is disabled');
      return;
    }

    this.logger.info('Starting secret cycling process...');

    const environments = environment
      ? [environment]
      : this.config.environments.map(e => e.name);

    for (const env of environments) {
      await this.cycleManager.cycleEnvironmentSecrets(env, this);
    }

    // Clear cache after cycling
    this.secretsCache.clear();

    this.logger.info('Secret cycling completed');
  }

  async setSecret(key: string, value: string, environment: string): Promise<boolean> {
    const envConfig = this.getEnvironmentConfig(environment);
    if (!envConfig) {
      this.logger.error(`Environment ${environment} not found`);
      return false;
    }

    const mapping = envConfig.secrets.find(s => s.key === key);
    if (!mapping) {
      this.logger.error(`Secret ${key} not configured for environment ${environment}`);
      return false;
    }

    try {
      await this.provider.setSecret(mapping.source, value);

      // Update cache
      const cacheKey = `${environment}:${key}`;
      this.secretsCache.delete(cacheKey);

      this.logger.info(`Successfully updated secret ${key} in environment ${environment}`);
      return true;
    } catch (error) {
      this.logger.error(`Error setting secret ${key}:`, error);
      return false;
    }
  }

  private getEnvironmentConfig(name: string): EnvironmentConfig | null {
    return this.config.environments.find(e => e.name === name) || null;
  }

  private async applyTransformations(value: string, transforms: any[], environment: string): Promise<string> {
    let result = value;

    for (const transform of transforms) {
      const transformers = await this.pluginManager.getPlugins('transformer');
      const transformer = transformers.find(t => t.name.includes(transform.type));

      if (transformer) {
        const context = {
          secret: { value: result } as SecretItem,
          environment,
          config: transform.params || {},
          logger: this.logger
        };

        const transformed = await transformer.execute(context);
        result = transformed.value || result;
      }
    }

    return result;
  }

  getStats(): any {
    return {
      cachedSecrets: this.secretsCache.size,
      environments: this.config.environments.length,
      cycling: {
        enabled: this.config.cycling.enabled,
        rules: this.config.cycling.rules.length
      },
      plugins: this.config.plugins.length
    };
  }
}