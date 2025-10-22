import { Plugin, PluginContext } from '../types';

export class Base64Transformer implements Plugin {
  name = 'base64-transformer';
  type = 'transformer' as const;

  async execute(context: PluginContext): Promise<{ value: string }> {
    const { secret, config, logger } = context;

    if (!secret?.value) {
      throw new Error('No secret value provided for transformation');
    }

    const operation = config.operation || 'encode';

    logger.debug(`Base64 ${operation} transformation for secret`);

    let transformedValue: string;

    switch (operation) {
      case 'encode':
        transformedValue = Buffer.from(secret.value).toString('base64');
        break;
      case 'decode':
        try {
          transformedValue = Buffer.from(secret.value, 'base64').toString('utf8');
        } catch (error) {
          throw new Error(`Invalid base64 string: ${error}`);
        }
        break;
      default:
        throw new Error(`Unknown base64 operation: ${operation}`);
    }

    logger.debug(`Base64 transformation completed`);

    return { value: transformedValue };
  }
}