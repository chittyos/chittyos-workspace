import { Plugin, PluginContext } from '../types';
import * as fs from 'fs-extra';
import * as path from 'path';

export class KubernetesInjector implements Plugin {
  name = 'kubernetes-injector';
  type = 'injector' as const;

  async execute(context: PluginContext): Promise<void> {
    const { config, logger } = context;
    const { secrets, target = 'secret' } = config;

    switch (target) {
      case 'secret':
        await this.createKubernetesSecret(secrets, config, logger);
        break;
      case 'configmap':
        await this.createConfigMap(secrets, config, logger);
        break;
      case 'deployment':
        await this.injectToDeployment(secrets, config, logger);
        break;
      default:
        throw new Error(`Unknown Kubernetes injection target: ${target}`);
    }
  }

  private async createKubernetesSecret(secrets: Record<string, string>, config: any, logger: any): Promise<void> {
    const secretName = config.secretName || 'app-secrets';
    const namespace = config.namespace || 'default';
    const outputPath = config.outputPath || `${secretName}.yaml`;

    logger.info(`Creating Kubernetes Secret: ${secretName}`);

    // Encode secrets in base64
    const encodedSecrets: Record<string, string> = {};
    for (const [key, value] of Object.entries(secrets)) {
      encodedSecrets[key] = Buffer.from(value).toString('base64');
    }

    const secretManifest = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: secretName,
        namespace: namespace,
        labels: {
          'app.kubernetes.io/managed-by': 'secrets-manager'
        }
      },
      type: 'Opaque',
      data: encodedSecrets
    };

    // Write to YAML file
    const yaml = await import('yaml');
    const yamlContent = yaml.stringify(secretManifest);

    await fs.ensureDir(path.dirname(path.resolve(outputPath)));
    await fs.writeFile(outputPath, yamlContent);

    logger.info(`Successfully created Kubernetes Secret manifest: ${outputPath}`);

    // Optionally apply to cluster
    if (config.apply) {
      await this.applyManifest(outputPath, logger);
    }
  }

  private async createConfigMap(secrets: Record<string, string>, config: any, logger: any): Promise<void> {
    const configMapName = config.configMapName || 'app-config';
    const namespace = config.namespace || 'default';
    const outputPath = config.outputPath || `${configMapName}.yaml`;

    logger.info(`Creating Kubernetes ConfigMap: ${configMapName}`);

    const configMapManifest = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: configMapName,
        namespace: namespace,
        labels: {
          'app.kubernetes.io/managed-by': 'secrets-manager'
        }
      },
      data: secrets
    };

    // Write to YAML file
    const yaml = await import('yaml');
    const yamlContent = yaml.stringify(configMapManifest);

    await fs.ensureDir(path.dirname(path.resolve(outputPath)));
    await fs.writeFile(outputPath, yamlContent);

    logger.info(`Successfully created Kubernetes ConfigMap manifest: ${outputPath}`);

    // Optionally apply to cluster
    if (config.apply) {
      await this.applyManifest(outputPath, logger);
    }
  }

  private async injectToDeployment(secrets: Record<string, string>, config: any, logger: any): Promise<void> {
    const deploymentPath = config.deploymentPath || 'deployment.yaml';
    const secretName = config.secretName || 'app-secrets';

    logger.info(`Injecting secrets to Kubernetes Deployment: ${deploymentPath}`);

    try {
      // Read existing deployment
      const yaml = await import('yaml');
      const content = await fs.readFile(deploymentPath, 'utf8');
      const deployment = yaml.parse(content);

      // Ensure the deployment has the correct structure
      if (!deployment.spec?.template?.spec?.containers) {
        throw new Error('Invalid deployment structure');
      }

      // Add environment variables from secret
      const envFromSecret = Object.keys(secrets).map(key => ({
        name: key,
        valueFrom: {
          secretKeyRef: {
            name: secretName,
            key: key
          }
        }
      }));

      // Update all containers
      for (const container of deployment.spec.template.spec.containers) {
        if (!container.env) {
          container.env = [];
        }

        // Remove existing entries for these keys
        container.env = container.env.filter((env: any) =>
          !Object.keys(secrets).includes(env.name)
        );

        // Add new entries
        container.env.push(...envFromSecret);
      }

      // Write back to file
      const updatedContent = yaml.stringify(deployment);
      await fs.writeFile(deploymentPath, updatedContent);

      logger.info(`Successfully updated deployment with ${Object.keys(secrets).length} secret references`);

      // Optionally apply to cluster
      if (config.apply) {
        await this.applyManifest(deploymentPath, logger);
      }

    } catch (error) {
      logger.error(`Failed to update deployment: ${error}`);
      throw error;
    }
  }

  private async applyManifest(manifestPath: string, logger: any): Promise<void> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      logger.info(`Applying Kubernetes manifest: ${manifestPath}`);

      const { stdout, stderr } = await execAsync(`kubectl apply -f ${manifestPath}`);

      if (stderr && !stderr.includes('configured') && !stderr.includes('created')) {
        logger.warn(`kubectl stderr: ${stderr}`);
      }

      logger.info(`Successfully applied manifest: ${stdout.trim()}`);

    } catch (error) {
      logger.error(`Failed to apply manifest: ${error}`);
      throw error;
    }
  }

  async createSealedSecret(secrets: Record<string, string>, config: any, logger: any): Promise<void> {
    const secretName = config.secretName || 'app-secrets';
    const namespace = config.namespace || 'default';
    const outputPath = config.outputPath || `${secretName}-sealed.yaml`;

    logger.info(`Creating Sealed Secret: ${secretName}`);

    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Create a temporary regular secret
      const tempSecretPath = `/tmp/${secretName}-temp.yaml`;
      await this.createKubernetesSecret(secrets, {
        ...config,
        outputPath: tempSecretPath,
        apply: false
      }, logger);

      // Convert to sealed secret
      await execAsync(`kubeseal -f ${tempSecretPath} -w ${outputPath}`);

      // Clean up temp file
      await fs.remove(tempSecretPath);

      logger.info(`Successfully created Sealed Secret: ${outputPath}`);

    } catch (error) {
      logger.error(`Failed to create Sealed Secret: ${error}`);
      throw error;
    }
  }
}