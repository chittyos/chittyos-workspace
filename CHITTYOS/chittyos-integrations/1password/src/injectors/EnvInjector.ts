import { Plugin, PluginContext } from '../types';
import * as fs from 'fs-extra';
import * as path from 'path';

export class EnvInjector implements Plugin {
  name = 'env-injector';
  type = 'injector' as const;

  async execute(context: PluginContext): Promise<void> {
    const { config, logger } = context;
    const { secrets, target = 'env' } = config;

    switch (target) {
      case 'env':
        await this.injectToEnvironment(secrets, logger);
        break;
      case 'file':
        await this.injectToFile(secrets, config, logger);
        break;
      case 'stdout':
        await this.injectToStdout(secrets, logger);
        break;
      default:
        throw new Error(`Unknown injection target: ${target}`);
    }
  }

  private async injectToEnvironment(secrets: Record<string, string>, logger: any): Promise<void> {
    logger.info('Injecting secrets to environment variables');

    for (const [key, value] of Object.entries(secrets)) {
      process.env[key] = value;
      logger.debug(`Set environment variable: ${key}`);
    }

    logger.info(`Injected ${Object.keys(secrets).length} secrets to environment`);
  }

  private async injectToFile(secrets: Record<string, string>, config: any, logger: any): Promise<void> {
    const filePath = config.filePath || '.env';
    const format = config.format || 'env';

    logger.info(`Injecting secrets to file: ${filePath}`);

    let content: string;

    switch (format) {
      case 'env':
        content = this.formatAsEnv(secrets);
        break;
      case 'json':
        content = JSON.stringify(secrets, null, 2);
        break;
      case 'yaml':
        content = this.formatAsYaml(secrets);
        break;
      default:
        throw new Error(`Unknown file format: ${format}`);
    }

    // Ensure directory exists
    await fs.ensureDir(path.dirname(path.resolve(filePath)));

    // Write secrets to file
    await fs.writeFile(filePath, content, { mode: 0o600 }); // Secure file permissions

    logger.info(`Successfully wrote ${Object.keys(secrets).length} secrets to ${filePath}`);
  }

  private async injectToStdout(secrets: Record<string, string>, logger: any): Promise<void> {
    logger.info('Outputting secrets to stdout');

    const exportCommands = Object.entries(secrets)
      .map(([key, value]) => `export ${key}="${value}"`)
      .join('\n');

    console.log(exportCommands);
  }

  private formatAsEnv(secrets: Record<string, string>): string {
    return Object.entries(secrets)
      .map(([key, value]) => `${key}="${value}"`)
      .join('\n') + '\n';
  }

  private formatAsYaml(secrets: Record<string, string>): string {
    const yamlLines = Object.entries(secrets)
      .map(([key, value]) => `${key}: "${value}"`)
      .join('\n');
    return yamlLines + '\n';
  }
}