import { Plugin, PluginContext } from '../types';

export class JsonTransformer implements Plugin {
  name = 'json-transformer';
  type = 'transformer' as const;

  async execute(context: PluginContext): Promise<{ value: string }> {
    const { secret, config, logger } = context;

    if (!secret?.value) {
      throw new Error('No secret value provided for transformation');
    }

    const operation = config.operation || 'stringify';

    logger.debug(`JSON ${operation} transformation for secret`);

    let transformedValue: string;

    switch (operation) {
      case 'stringify':
        try {
          // If the value is already a string, try to parse it first
          let objectValue = secret.value;
          if (typeof secret.value === 'string') {
            try {
              objectValue = JSON.parse(secret.value);
            } catch {
              // If parsing fails, treat as a plain string and wrap in object
              objectValue = { value: secret.value };
            }
          }

          const indent = config.indent ? Number(config.indent) : 0;
          transformedValue = JSON.stringify(objectValue, null, indent);

        } catch (error) {
          throw new Error(`JSON stringify failed: ${error}`);
        }
        break;

      case 'parse':
        try {
          const parsed = JSON.parse(secret.value);

          // Extract specific field if specified
          if (config.field) {
            const fieldValue = this.getNestedValue(parsed, config.field);
            if (fieldValue === undefined) {
              throw new Error(`Field '${config.field}' not found in JSON`);
            }
            transformedValue = String(fieldValue);
          } else {
            transformedValue = String(parsed);
          }

        } catch (error) {
          throw new Error(`JSON parse failed: ${error}`);
        }
        break;

      case 'extract':
        try {
          const parsed = JSON.parse(secret.value);
          const field = config.field;

          if (!field) {
            throw new Error('Field parameter required for extract operation');
          }

          const extractedValue = this.getNestedValue(parsed, field);
          if (extractedValue === undefined) {
            throw new Error(`Field '${field}' not found in JSON`);
          }

          transformedValue = String(extractedValue);

        } catch (error) {
          throw new Error(`JSON extract failed: ${error}`);
        }
        break;

      case 'merge':
        try {
          const baseObject = JSON.parse(secret.value);
          const mergeData = config.mergeData || {};

          const merged = { ...baseObject, ...mergeData };
          const indent = config.indent ? Number(config.indent) : 0;
          transformedValue = JSON.stringify(merged, null, indent);

        } catch (error) {
          throw new Error(`JSON merge failed: ${error}`);
        }
        break;

      default:
        throw new Error(`Unknown JSON operation: ${operation}`);
    }

    logger.debug(`JSON transformation completed`);

    return { value: transformedValue };
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
}