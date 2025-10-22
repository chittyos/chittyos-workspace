import { Client, createClient } from '@1password/sdk';
import { SecretsConfig } from '../types';
import { Logger } from '../utils/Logger';

export class OnePasswordProvider {
  private client: Client | null = null;
  private config: SecretsConfig;
  private logger: Logger;

  constructor(config: SecretsConfig) {
    this.config = config;
    this.logger = new Logger();
  }

  async initialize(): Promise<void> {
    try {
      // Initialize 1Password SDK client
      this.client = await createClient({
        auth: this.config.accessToken || process.env.OP_ACCESS_TOKEN || '',
        integrationName: 'secrets-manager',
        integrationVersion: '1.0.0'
      });

      this.logger.info('1Password provider initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize 1Password provider:', error);
      throw error;
    }
  }

  async getSecret(reference: string): Promise<string | null> {
    if (!this.client) {
      throw new Error('1Password client not initialized');
    }

    try {
      // Handle different reference formats:
      // 1. op://vault/item/field
      // 2. vault/item/field
      // 3. item/field (use default vault)

      let secretReference = reference;
      if (!reference.startsWith('op://')) {
        const vaultId = this.config.vault || 'Private';
        if (!reference.includes('/')) {
          throw new Error(`Invalid secret reference format: ${reference}`);
        }
        secretReference = `op://${vaultId}/${reference}`;
      }

      const secret = await this.client.secrets.resolve(secretReference);

      this.logger.debug(`Retrieved secret from reference: ${reference}`);
      return secret;

    } catch (error) {
      this.logger.error(`Failed to retrieve secret ${reference}:`, error);
      return null;
    }
  }

  async setSecret(reference: string, value: string): Promise<void> {
    if (!this.client) {
      throw new Error('1Password client not initialized');
    }

    try {
      // Parse reference to get vault, item, and field
      const { vaultId, itemId, fieldName } = this.parseReference(reference);

      // Get the existing item
      const item = await this.client.items.get(vaultId, itemId);

      // Update the specific field
      const updatedFields = item.fields?.map(field => {
        if (field.label === fieldName || field.id === fieldName) {
          return { ...field, value };
        }
        return field;
      }) || [];

      // If field doesn't exist, create it
      if (!updatedFields.some(f => f.label === fieldName || f.id === fieldName)) {
        updatedFields.push({
          id: fieldName.toLowerCase().replace(/\s+/g, '_'),
          label: fieldName,
          value,
          type: 'STRING'
        });
      }

      // Update the item
      await this.client.items.update(vaultId, itemId, {
        ...item,
        fields: updatedFields
      });

      this.logger.info(`Successfully updated secret: ${reference}`);

    } catch (error) {
      this.logger.error(`Failed to set secret ${reference}:`, error);
      throw error;
    }
  }

  async createSecret(vaultId: string, title: string, fields: Record<string, string>): Promise<string> {
    if (!this.client) {
      throw new Error('1Password client not initialized');
    }

    try {
      const itemFields = Object.entries(fields).map(([key, value]) => ({
        id: key.toLowerCase().replace(/\s+/g, '_'),
        label: key,
        value,
        type: 'STRING'
      }));

      const newItem = await this.client.items.create(vaultId, {
        title,
        category: 'PASSWORD',
        fields: itemFields
      });

      this.logger.info(`Created new secret item: ${title}`);
      return newItem.id;

    } catch (error) {
      this.logger.error(`Failed to create secret ${title}:`, error);
      throw error;
    }
  }

  async listVaults(): Promise<any[]> {
    if (!this.client) {
      throw new Error('1Password client not initialized');
    }

    try {
      const vaults = await this.client.vaults.listAll();
      return vaults;
    } catch (error) {
      this.logger.error('Failed to list vaults:', error);
      throw error;
    }
  }

  async listItems(vaultId: string): Promise<any[]> {
    if (!this.client) {
      throw new Error('1Password client not initialized');
    }

    try {
      const items = await this.client.items.listAll(vaultId);
      return items;
    } catch (error) {
      this.logger.error(`Failed to list items in vault ${vaultId}:`, error);
      throw error;
    }
  }

  async generatePassword(recipe?: any): Promise<string> {
    if (!this.client) {
      throw new Error('1Password client not initialized');
    }

    try {
      // Use default strong password recipe if none provided
      const defaultRecipe = {
        length: 32,
        characterSets: ['LETTERS', 'DIGITS', 'SYMBOLS']
      };

      const password = await this.client.secrets.generatePassword(recipe || defaultRecipe);

      this.logger.debug('Generated new password');
      return password;

    } catch (error) {
      this.logger.error('Failed to generate password:', error);
      throw error;
    }
  }

  private parseReference(reference: string): { vaultId: string; itemId: string; fieldName: string } {
    // Handle op://vault/item/field format
    if (reference.startsWith('op://')) {
      const parts = reference.replace('op://', '').split('/');
      if (parts.length !== 3) {
        throw new Error(`Invalid reference format: ${reference}`);
      }
      return {
        vaultId: parts[0],
        itemId: parts[1],
        fieldName: parts[2]
      };
    }

    // Handle vault/item/field format
    const parts = reference.split('/');
    if (parts.length === 3) {
      return {
        vaultId: parts[0],
        itemId: parts[1],
        fieldName: parts[2]
      };
    }

    // Handle item/field format with default vault
    if (parts.length === 2) {
      return {
        vaultId: this.config.vault || 'Private',
        itemId: parts[0],
        fieldName: parts[1]
      };
    }

    throw new Error(`Invalid reference format: ${reference}`);
  }
}