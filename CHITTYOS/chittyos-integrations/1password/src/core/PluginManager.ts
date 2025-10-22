import { Plugin, PluginConfig, Logger } from '../types';
import * as path from 'path';
import * as fs from 'fs-extra';

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private config: PluginConfig[];
  private logger: Logger;

  constructor(config: PluginConfig[], logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async loadPlugins(): Promise<void> {
    this.logger.info('Loading plugins...');

    // Load built-in plugins first
    await this.loadBuiltInPlugins();

    // Load custom plugins
    for (const pluginConfig of this.config) {
      await this.loadPlugin(pluginConfig);
    }

    this.logger.info(`Loaded ${this.plugins.size} plugins`);
  }

  private async loadBuiltInPlugins(): Promise<void> {
    const builtInPlugins = [
      { name: 'env-injector', path: '../injectors/EnvInjector', type: 'injector' },
      { name: 'docker-injector', path: '../injectors/DockerInjector', type: 'injector' },
      { name: 'kubernetes-injector', path: '../injectors/KubernetesInjector', type: 'injector' },
      { name: 'base64-transformer', path: '../transformers/Base64Transformer', type: 'transformer' },
      { name: 'json-transformer', path: '../transformers/JsonTransformer', type: 'transformer' },
      { name: 'template-transformer', path: '../transformers/TemplateTransformer', type: 'transformer' }
    ];

    for (const pluginInfo of builtInPlugins) {
      try {
        const PluginClass = await this.importPlugin(pluginInfo.path);
        const plugin = new PluginClass();
        this.plugins.set(plugin.name, plugin);
        this.logger.debug(`Loaded built-in plugin: ${plugin.name}`);
      } catch (error) {
        this.logger.warn(`Failed to load built-in plugin ${pluginInfo.name}:`, error);
      }
    }
  }

  private async loadPlugin(config: PluginConfig): Promise<void> {
    try {
      this.logger.debug(`Loading plugin: ${config.name} from ${config.path}`);

      const PluginClass = await this.importPlugin(config.path);
      const plugin = new PluginClass(config.config);

      // Validate plugin interface
      if (!this.isValidPlugin(plugin)) {
        throw new Error(`Plugin ${config.name} does not implement required interface`);
      }

      this.plugins.set(config.name, plugin);
      this.logger.info(`Successfully loaded plugin: ${config.name}`);

    } catch (error) {
      this.logger.error(`Failed to load plugin ${config.name}:`, error);
      throw error;
    }
  }

  private async importPlugin(pluginPath: string): Promise<any> {
    // Handle relative paths
    const resolvedPath = path.isAbsolute(pluginPath)
      ? pluginPath
      : path.resolve(__dirname, pluginPath);

    // Check if file exists
    if (!(await fs.pathExists(resolvedPath + '.ts')) && !(await fs.pathExists(resolvedPath + '.js'))) {
      throw new Error(`Plugin file not found: ${resolvedPath}`);
    }

    const module = await import(resolvedPath);

    // Get the default export or first exported class
    const PluginClass = module.default || Object.values(module)[0];

    if (typeof PluginClass !== 'function') {
      throw new Error('Plugin must export a class');
    }

    return PluginClass;
  }

  private isValidPlugin(plugin: any): plugin is Plugin {
    return (
      typeof plugin === 'object' &&
      typeof plugin.name === 'string' &&
      typeof plugin.type === 'string' &&
      typeof plugin.execute === 'function' &&
      ['injector', 'transformer', 'validator', 'cycler'].includes(plugin.type)
    );
  }

  async getPlugins(type?: string): Promise<Plugin[]> {
    const allPlugins = Array.from(this.plugins.values());

    if (type) {
      return allPlugins.filter(plugin => plugin.type === type);
    }

    return allPlugins;
  }

  async getPlugin(name: string): Promise<Plugin | null> {
    return this.plugins.get(name) || null;
  }

  async executePlugin(name: string, context: any): Promise<any> {
    const plugin = this.plugins.get(name);

    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }

    this.logger.debug(`Executing plugin: ${name}`);

    try {
      const result = await plugin.execute(context);
      this.logger.debug(`Plugin ${name} executed successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Plugin ${name} execution failed:`, error);
      throw error;
    }
  }

  async registerPlugin(plugin: Plugin): Promise<void> {
    if (!this.isValidPlugin(plugin)) {
      throw new Error(`Invalid plugin: ${plugin}`);
    }

    this.plugins.set(plugin.name, plugin);
    this.logger.info(`Registered plugin: ${plugin.name}`);
  }

  async unregisterPlugin(name: string): Promise<boolean> {
    const deleted = this.plugins.delete(name);
    if (deleted) {
      this.logger.info(`Unregistered plugin: ${name}`);
    }
    return deleted;
  }

  listPlugins(): { name: string; type: string }[] {
    return Array.from(this.plugins.values()).map(plugin => ({
      name: plugin.name,
      type: plugin.type
    }));
  }

  async reloadPlugin(name: string): Promise<void> {
    const config = this.config.find(c => c.name === name);
    if (!config) {
      throw new Error(`Plugin config not found: ${name}`);
    }

    // Remove existing plugin
    this.plugins.delete(name);

    // Reload
    await this.loadPlugin(config);

    this.logger.info(`Reloaded plugin: ${name}`);
  }

  async validatePluginDependencies(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    for (const [name, plugin] of this.plugins) {
      try {
        // Basic validation - check if plugin can be instantiated
        if (!plugin.name || !plugin.type || !plugin.execute) {
          issues.push(`Plugin ${name} is missing required properties`);
        }

        // Type-specific validation
        switch (plugin.type) {
          case 'injector':
            // Injectors should handle different targets
            break;
          case 'transformer':
            // Transformers should handle value transformations
            break;
          case 'validator':
            // Validators should return boolean results
            break;
          case 'cycler':
            // Cyclers should handle secret rotation
            break;
          default:
            issues.push(`Plugin ${name} has unknown type: ${plugin.type}`);
        }

      } catch (error) {
        issues.push(`Plugin ${name} validation failed: ${error}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}