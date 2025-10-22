import { Plugin, PluginContext } from '../types';

export class TemplateTransformer implements Plugin {
  name = 'template-transformer';
  type = 'transformer' as const;

  async execute(context: PluginContext): Promise<{ value: string }> {
    const { secret, config, environment, logger } = context;

    if (!secret?.value) {
      throw new Error('No secret value provided for transformation');
    }

    const template = config.template;
    if (!template) {
      throw new Error('Template parameter required for template transformation');
    }

    logger.debug(`Template transformation for secret`);

    try {
      // Prepare template variables
      const variables = {
        secret: secret.value,
        environment,
        timestamp: new Date().toISOString(),
        date: new Date().toDateString(),
        ...config.variables || {}
      };

      // Apply template transformation
      const transformedValue = this.applyTemplate(template, variables);

      logger.debug(`Template transformation completed`);

      return { value: transformedValue };

    } catch (error) {
      throw new Error(`Template transformation failed: ${error}`);
    }
  }

  private applyTemplate(template: string, variables: Record<string, any>): string {
    let result = template;

    // Replace variables in format {{variable}}
    result = result.replace(/\{\{\s*(\w+(?:\.\w+)*)\s*\}\}/g, (match, varPath) => {
      const value = this.getNestedValue(variables, varPath);
      return value !== undefined ? String(value) : match;
    });

    // Replace conditional blocks {{#if condition}}...{{/if}}
    result = result.replace(/\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs, (match, condition, content) => {
      const value = variables[condition];
      return this.isTruthy(value) ? content : '';
    });

    // Replace conditional blocks {{#unless condition}}...{{/unless}}
    result = result.replace(/\{\{#unless\s+(\w+)\}\}(.*?)\{\{\/unless\}\}/gs, (match, condition, content) => {
      const value = variables[condition];
      return !this.isTruthy(value) ? content : '';
    });

    // Replace each loops {{#each array}}...{{/each}}
    result = result.replace(/\{\{#each\s+(\w+)\}\}(.*?)\{\{\/each\}\}/gs, (match, arrayName, itemTemplate) => {
      const array = variables[arrayName];
      if (!Array.isArray(array)) {
        return '';
      }

      return array.map((item, index) => {
        const itemVariables = {
          ...variables,
          this: item,
          '@index': index,
          '@first': index === 0,
          '@last': index === array.length - 1
        };

        return this.applyTemplate(itemTemplate, itemVariables);
      }).join('');
    });

    // Replace helper functions
    result = this.applyHelpers(result, variables);

    return result;
  }

  private applyHelpers(template: string, variables: Record<string, any>): string {
    let result = template;

    // {{upper variable}} - uppercase
    result = result.replace(/\{\{upper\s+(\w+(?:\.\w+)*)\}\}/g, (match, varPath) => {
      const value = this.getNestedValue(variables, varPath);
      return value ? String(value).toUpperCase() : '';
    });

    // {{lower variable}} - lowercase
    result = result.replace(/\{\{lower\s+(\w+(?:\.\w+)*)\}\}/g, (match, varPath) => {
      const value = this.getNestedValue(variables, varPath);
      return value ? String(value).toLowerCase() : '';
    });

    // {{length variable}} - get length
    result = result.replace(/\{\{length\s+(\w+(?:\.\w+)*)\}\}/g, (match, varPath) => {
      const value = this.getNestedValue(variables, varPath);
      if (Array.isArray(value) || typeof value === 'string') {
        return String(value.length);
      }
      return '0';
    });

    // {{slice variable start end}} - slice string/array
    result = result.replace(/\{\{slice\s+(\w+(?:\.\w+)*)\s+(\d+)\s+(\d+)\}\}/g, (match, varPath, start, end) => {
      const value = this.getNestedValue(variables, varPath);
      if (Array.isArray(value) || typeof value === 'string') {
        return String(value.slice(Number(start), Number(end)));
      }
      return '';
    });

    // {{json variable}} - stringify as JSON
    result = result.replace(/\{\{json\s+(\w+(?:\.\w+)*)\}\}/g, (match, varPath) => {
      const value = this.getNestedValue(variables, varPath);
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    });

    // {{base64 variable}} - encode as base64
    result = result.replace(/\{\{base64\s+(\w+(?:\.\w+)*)\}\}/g, (match, varPath) => {
      const value = this.getNestedValue(variables, varPath);
      return value ? Buffer.from(String(value)).toString('base64') : '';
    });

    return result;
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  private isTruthy(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return Boolean(value);
  }
}