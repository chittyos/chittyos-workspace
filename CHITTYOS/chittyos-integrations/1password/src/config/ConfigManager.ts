import { SecretsConfig } from '../types';
import { Logger } from '../utils/Logger';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';

export class ConfigManager {
  private logger: Logger;
  private configPath: string;
  private config: SecretsConfig | null = null;

  constructor(configPath?: string, logger?: Logger) {
    this.logger = logger || new Logger();
    this.configPath = configPath || this.findConfigFile();
  }

  async loadConfig(): Promise<SecretsConfig> {
    this.logger.info(`Loading configuration from: ${this.configPath}`);

    try {
      const content = await fs.readFile(this.configPath, 'utf8');
      const config = this.parseConfig(content, this.configPath);

      // Validate configuration
      const validation = await this.validateConfig(config);
      if (!validation.valid) {
        throw new Error(`Configuration validation failed:\n${validation.errors.join('\n')}`);
      }

      this.config = config;
      this.logger.info('Configuration loaded and validated successfully');

      return config;

    } catch (error) {
      this.logger.error(`Failed to load configuration: ${error}`);
      throw error;
    }
  }

  async saveConfig(config: SecretsConfig, configPath?: string): Promise<void> {
    const targetPath = configPath || this.configPath;

    this.logger.info(`Saving configuration to: ${targetPath}`);

    try {
      // Validate before saving
      const validation = await this.validateConfig(config);
      if (!validation.valid) {
        throw new Error(`Configuration validation failed:\n${validation.errors.join('\n')}`);
      }

      // Determine format from file extension
      const content = this.serializeConfig(config, targetPath);

      // Ensure directory exists
      await fs.ensureDir(path.dirname(targetPath));

      // Write with secure permissions
      await fs.writeFile(targetPath, content, { mode: 0o600 });

      this.config = config;
      this.logger.info('Configuration saved successfully');

    } catch (error) {
      this.logger.error(`Failed to save configuration: ${error}`);
      throw error;
    }
  }

  getConfig(): SecretsConfig | null {
    return this.config;
  }

  async validateConfig(config: SecretsConfig): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate provider
    if (!config.provider) {
      errors.push('Provider is required');
    } else if (!['1password', 'custom'].includes(config.provider)) {
      errors.push('Provider must be either "1password" or "custom"');
    }

    // Validate environments
    if (!config.environments || !Array.isArray(config.environments)) {
      errors.push('Environments array is required');
    } else if (config.environments.length === 0) {
      errors.push('At least one environment must be defined');
    } else {
      // Validate each environment
      const envNames = new Set<string>();
      for (const [index, env] of config.environments.entries()) {
        const envPrefix = `Environment ${index + 1}`;

        if (!env.name) {
          errors.push(`${envPrefix}: name is required`);
        } else if (envNames.has(env.name)) {
          errors.push(`${envPrefix}: duplicate environment name "${env.name}"`);
        } else {
          envNames.add(env.name);
        }

        if (!env.secrets || !Array.isArray(env.secrets)) {
          errors.push(`${envPrefix}: secrets array is required`);
        } else {
          // Validate secrets mappings
          const secretKeys = new Set<string>();
          for (const [secretIndex, secret] of env.secrets.entries()) {
            const secretPrefix = `${envPrefix}, Secret ${secretIndex + 1}`;

            if (!secret.key) {
              errors.push(`${secretPrefix}: key is required`);
            } else if (secretKeys.has(secret.key)) {
              errors.push(`${secretPrefix}: duplicate secret key "${secret.key}"`);
            } else {
              secretKeys.add(secret.key);
            }

            if (!secret.source) {
              errors.push(`${secretPrefix}: source is required`);
            }

            // Validate cycle interval format if provided
            if (secret.cycleInterval && !this.isValidInterval(secret.cycleInterval)) {
              errors.push(`${secretPrefix}: invalid cycle interval format "${secret.cycleInterval}"`);
            }
          }
        }

        // Validate inheritance
        if (env.inheritFrom && !config.environments.some(e => e.name === env.inheritFrom)) {
          errors.push(`${envPrefix}: inheritFrom references non-existent environment "${env.inheritFrom}"`);
        }
      }
    }

    // Validate cycling configuration
    if (config.cycling) {
      if (typeof config.cycling.enabled !== 'boolean') {
        errors.push('Cycling.enabled must be a boolean');
      }

      if (config.cycling.enabled) {
        if (!config.cycling.defaultInterval) {
          errors.push('Cycling.defaultInterval is required when cycling is enabled');
        } else if (!this.isValidInterval(config.cycling.defaultInterval)) {
          errors.push(`Invalid cycling.defaultInterval format: "${config.cycling.defaultInterval}"`);
        }

        if (config.cycling.rules) {
          for (const [index, rule] of config.cycling.rules.entries()) {
            const rulePrefix = `Cycling rule ${index + 1}`;

            if (!rule.pattern) {
              errors.push(`${rulePrefix}: pattern is required`);
            } else {
              try {
                new RegExp(rule.pattern);
              } catch {
                errors.push(`${rulePrefix}: invalid regex pattern "${rule.pattern}"`);
              }
            }

            if (!rule.interval || !this.isValidInterval(rule.interval)) {
              errors.push(`${rulePrefix}: invalid interval format "${rule.interval}"`);
            }

            if (!['rotate', 'regenerate', 'custom'].includes(rule.strategy)) {
              errors.push(`${rulePrefix}: strategy must be "rotate", "regenerate", or "custom"`);
            }

            if (rule.strategy === 'custom' && !rule.customHandler) {
              errors.push(`${rulePrefix}: customHandler is required for custom strategy`);
            }
          }
        }
      }
    }

    // Validate plugins
    if (config.plugins) {
      for (const [index, plugin] of config.plugins.entries()) {
        const pluginPrefix = `Plugin ${index + 1}`;

        if (!plugin.name) {
          errors.push(`${pluginPrefix}: name is required`);
        }

        if (!plugin.type || !['injector', 'transformer', 'validator', 'cycler'].includes(plugin.type)) {
          errors.push(`${pluginPrefix}: type must be "injector", "transformer", "validator", or "cycler"`);
        }

        if (!plugin.path) {
          errors.push(`${pluginPrefix}: path is required`);
        }
      }
    }

    // Validate 1Password specific settings
    if (config.provider === '1password') {
      if (!config.accessToken && !process.env.OP_ACCESS_TOKEN) {
        errors.push('1Password access token is required (either in config or OP_ACCESS_TOKEN env var)');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private findConfigFile(): string {
    const possiblePaths = [
      'secrets.yaml',
      'secrets.yml',
      'secrets.json',
      '.secrets.yaml',
      '.secrets.yml',
      '.secrets.json',
      'config/secrets.yaml',
      'config/secrets.yml',
      'config/secrets.json'
    ];

    for (const configPath of possiblePaths) {
      const fullPath = path.resolve(configPath);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }

    // Default to secrets.yaml in current directory
    return path.resolve('secrets.yaml');
  }

  private parseConfig(content: string, filePath: string): SecretsConfig {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.yaml':
      case '.yml':
        return yaml.parse(content);
      case '.json':
        return JSON.parse(content);
      default:
        throw new Error(`Unsupported configuration format: ${ext}`);
    }
  }

  private serializeConfig(config: SecretsConfig, filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.yaml':
      case '.yml':
        return yaml.stringify(config, { indent: 2 });
      case '.json':
        return JSON.stringify(config, null, 2);
      default:
        throw new Error(`Unsupported configuration format: ${ext}`);
    }
  }

  private isValidInterval(interval: string): boolean {
    // Validate format like "30d", "1w", "6h", "30m"
    return /^\d+[dwmh]$/.test(interval);
  }

  async createDefaultConfig(filePath?: string): Promise<SecretsConfig> {
    const defaultConfig: SecretsConfig = {
      provider: '1password',
      environments: [
        {
          name: 'development',
          description: 'Development environment',
          secrets: [
            {
              key: 'DATABASE_URL',
              source: 'app-secrets/database_url',
              required: true,
              cycleInterval: '30d'
            },
            {
              key: 'API_KEY',
              source: 'app-secrets/api_key',
              required: true,
              cycleInterval: '7d'
            }
          ]
        },
        {
          name: 'production',
          description: 'Production environment',
          secrets: [
            {
              key: 'DATABASE_URL',
              source: 'prod-secrets/database_url',
              required: true,
              cycleInterval: '90d'
            },
            {
              key: 'API_KEY',
              source: 'prod-secrets/api_key',
              required: true,
              cycleInterval: '30d'
            }
          ]
        }
      ],
      cycling: {
        enabled: true,
        defaultInterval: '30d',
        rules: [
          {
            pattern: 'API_.*',
            interval: '7d',
            strategy: 'regenerate'
          },
          {
            pattern: 'DATABASE_.*',
            interval: '90d',
            strategy: 'rotate'
          }
        ],
        notifications: {
          webhook: 'https://hooks.slack.com/your-webhook-url'
        }
      },
      plugins: [
        {
          name: 'env-injector',
          type: 'injector',
          path: 'built-in'
        },
        {
          name: 'base64-transformer',
          type: 'transformer',
          path: 'built-in'
        }
      ],
      vault: 'Private'
    };

    if (filePath) {
      await this.saveConfig(defaultConfig, filePath);
    }

    return defaultConfig;
  }

  async mergeConfigs(baseConfig: SecretsConfig, overrideConfig: Partial<SecretsConfig>): Promise<SecretsConfig> {
    const merged = { ...baseConfig };

    if (overrideConfig.provider) {
      merged.provider = overrideConfig.provider;
    }

    if (overrideConfig.environments) {
      merged.environments = overrideConfig.environments;
    }

    if (overrideConfig.cycling) {
      merged.cycling = { ...merged.cycling, ...overrideConfig.cycling };
    }

    if (overrideConfig.plugins) {
      merged.plugins = overrideConfig.plugins;
    }

    if (overrideConfig.vault) {
      merged.vault = overrideConfig.vault;
    }

    if (overrideConfig.connectServer) {
      merged.connectServer = overrideConfig.connectServer;
    }

    if (overrideConfig.accessToken) {
      merged.accessToken = overrideConfig.accessToken;
    }

    return merged;
  }
}