import { Plugin, PluginContext } from '../types';
import * as fs from 'fs-extra';

export class DockerInjector implements Plugin {
  name = 'docker-injector';
  type = 'injector' as const;

  async execute(context: PluginContext): Promise<void> {
    const { config, logger } = context;
    const { secrets, target = 'compose' } = config;

    switch (target) {
      case 'compose':
        await this.injectToDockerCompose(secrets, config, logger);
        break;
      case 'dockerfile':
        await this.injectToDockerfile(secrets, config, logger);
        break;
      case 'swarm':
        await this.injectToDockerSwarm(secrets, config, logger);
        break;
      default:
        throw new Error(`Unknown Docker injection target: ${target}`);
    }
  }

  private async injectToDockerCompose(secrets: Record<string, string>, config: any, logger: any): Promise<void> {
    const composePath = config.composePath || 'docker-compose.yml';
    const serviceName = config.serviceName || 'app';

    logger.info(`Injecting secrets to Docker Compose: ${composePath}`);

    // Read existing compose file
    let composeContent: any = {};
    try {
      const yaml = await import('yaml');
      const content = await fs.readFile(composePath, 'utf8');
      composeContent = yaml.parse(content);
    } catch (error) {
      logger.warn(`Could not read existing compose file, creating new one: ${error}`);
      composeContent = { version: '3.8', services: {} };
    }

    // Ensure service exists
    if (!composeContent.services) {
      composeContent.services = {};
    }
    if (!composeContent.services[serviceName]) {
      composeContent.services[serviceName] = {};
    }

    // Add environment variables
    if (!composeContent.services[serviceName].environment) {
      composeContent.services[serviceName].environment = {};
    }

    for (const [key, value] of Object.entries(secrets)) {
      composeContent.services[serviceName].environment[key] = value;
    }

    // Write back to file
    const yaml = await import('yaml');
    const updatedContent = yaml.stringify(composeContent);
    await fs.writeFile(composePath, updatedContent);

    logger.info(`Successfully updated Docker Compose with ${Object.keys(secrets).length} secrets`);
  }

  private async injectToDockerfile(secrets: Record<string, string>, config: any, logger: any): Promise<void> {
    const dockerfilePath = config.dockerfilePath || 'Dockerfile';

    logger.info(`Injecting secrets to Dockerfile: ${dockerfilePath}`);

    // Read existing Dockerfile
    let dockerfileContent = '';
    try {
      dockerfileContent = await fs.readFile(dockerfilePath, 'utf8');
    } catch (error) {
      logger.warn(`Could not read existing Dockerfile: ${error}`);
    }

    // Add ENV statements for each secret
    const envStatements = Object.entries(secrets)
      .map(([key, value]) => `ENV ${key}="${value}"`)
      .join('\n');

    // Insert ENV statements before the final CMD/ENTRYPOINT
    const lines = dockerfileContent.split('\n');
    const insertIndex = this.findInsertionPoint(lines);

    lines.splice(insertIndex, 0, '# Injected secrets', ...envStatements.split('\n'), '');

    // Write back to file
    await fs.writeFile(dockerfilePath, lines.join('\n'));

    logger.info(`Successfully updated Dockerfile with ${Object.keys(secrets).length} secrets`);
  }

  private async injectToDockerSwarm(secrets: Record<string, string>, config: any, logger: any): Promise<void> {
    const stackName = config.stackName || 'app';

    logger.info(`Creating Docker Swarm secrets for stack: ${stackName}`);

    // Create Docker secrets for each secret
    for (const [key, value] of Object.entries(secrets)) {
      const secretName = `${stackName}_${key.toLowerCase()}`;

      try {
        // Create secret using Docker CLI
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        await execAsync(`echo "${value}" | docker secret create ${secretName} -`);
        logger.debug(`Created Docker secret: ${secretName}`);

      } catch (error) {
        logger.error(`Failed to create Docker secret ${secretName}:`, error);
      }
    }

    logger.info(`Successfully created ${Object.keys(secrets).length} Docker secrets`);
  }

  private findInsertionPoint(lines: string[]): number {
    // Find the last CMD or ENTRYPOINT line
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim().toLowerCase();
      if (line.startsWith('cmd') || line.startsWith('entrypoint')) {
        return i;
      }
    }

    // If no CMD/ENTRYPOINT found, insert at the end
    return lines.length;
  }
}