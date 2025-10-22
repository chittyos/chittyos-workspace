/**
 * NotionSyncService - Bidirectional sync between ChittyOS and Notion
 *
 * Syncs four key databases:
 * 1. ChittyRegistry - Service/tool registry
 * 2. ChittySchema - Entity definitions and data contracts
 * 3. ChittyGov - Governance policies and compliance
 * 4. ChittyChronicle - Event log and audit trail
 */

import { Client } from '@notionhq/client';
import { logger } from '../utils/logger';

// Notion database schemas
export interface NotionDatabaseConfig {
  databaseId: string;
  name: string;
  properties: Record<string, any>;
  syncInterval: number; // milliseconds
  bidirectional: boolean;
}

export interface RegistryEntry {
  chittyId: string;
  name: string;
  category: string;
  capabilities: string[];
  status: 'active' | 'deprecated' | 'experimental';
  health: 'healthy' | 'degraded' | 'down';
  lastUpdated: string;
  endpoint?: string;
  version?: string;
  description?: string;
}

export interface SchemaEntity {
  chittyId: string;
  entityType: 'PEO' | 'PLACE' | 'PROP' | 'EVNT' | 'AUTH' | 'INFO' | 'FACT' | 'CONTEXT' | 'ACTOR';
  schemaVersion: string;
  fields: Record<string, any>;
  validationRules: string[];
  relationships: string[];
  description?: string;
}

export interface GovPolicy {
  chittyId: string;
  policyName: string;
  status: 'draft' | 'active' | 'archived';
  effectiveDate: string;
  owner: string;
  relatedServices: string[];
  description?: string;
  complianceLevel: 'critical' | 'high' | 'medium' | 'low';
}

export interface ChronicleEvent {
  chittyId: string;
  timestamp: string;
  eventType: 'deployment' | 'config_change' | 'incident' | 'audit' | 'compliance';
  service: string;
  description: string;
  evidenceHash?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export class NotionSyncService {
  private notion: Client;
  private databases: Map<string, NotionDatabaseConfig> = new Map();
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(authToken: string) {
    this.notion = new Client({ auth: authToken });
  }

  /**
   * Initialize Notion databases with proper schemas
   */
  async initializeDatabases(): Promise<void> {
    logger.info('Initializing Notion databases for ChittyOS sync...');

    // Database configurations
    const dbConfigs: NotionDatabaseConfig[] = [
      {
        databaseId: '', // To be created
        name: 'ChittyRegistry',
        bidirectional: true,
        syncInterval: 60000, // 1 minute
        properties: {
          ChittyID: { type: 'title' },
          Name: { type: 'rich_text' },
          Category: {
            type: 'select',
            options: [
              { name: 'service', color: 'blue' },
              { name: 'tool', color: 'green' },
              { name: 'script', color: 'yellow' },
              { name: 'agent', color: 'purple' },
              { name: 'library', color: 'orange' },
            ],
          },
          Capabilities: { type: 'multi_select' },
          Status: {
            type: 'select',
            options: [
              { name: 'active', color: 'green' },
              { name: 'deprecated', color: 'red' },
              { name: 'experimental', color: 'yellow' },
            ],
          },
          Health: {
            type: 'select',
            options: [
              { name: 'healthy', color: 'green' },
              { name: 'degraded', color: 'yellow' },
              { name: 'down', color: 'red' },
            ],
          },
          LastUpdated: { type: 'date' },
          Endpoint: { type: 'url' },
          Version: { type: 'rich_text' },
          Description: { type: 'rich_text' },
        },
      },
      {
        databaseId: '',
        name: 'ChittySchema',
        bidirectional: true,
        syncInterval: 300000, // 5 minutes
        properties: {
          ChittyID: { type: 'title' },
          EntityType: {
            type: 'select',
            options: [
              { name: 'PEO', color: 'blue' },
              { name: 'PLACE', color: 'green' },
              { name: 'PROP', color: 'orange' },
              { name: 'EVNT', color: 'red' },
              { name: 'AUTH', color: 'purple' },
              { name: 'INFO', color: 'gray' },
              { name: 'FACT', color: 'yellow' },
              { name: 'CONTEXT', color: 'pink' },
              { name: 'ACTOR', color: 'brown' },
            ],
          },
          SchemaVersion: { type: 'rich_text' },
          Fields: { type: 'rich_text' }, // JSON stringified
          ValidationRules: { type: 'multi_select' },
          Relationships: { type: 'multi_select' },
          Description: { type: 'rich_text' },
        },
      },
      {
        databaseId: '',
        name: 'ChittyGov',
        bidirectional: true,
        syncInterval: 600000, // 10 minutes
        properties: {
          ChittyID: { type: 'title' },
          PolicyName: { type: 'rich_text' },
          Status: {
            type: 'select',
            options: [
              { name: 'draft', color: 'gray' },
              { name: 'active', color: 'green' },
              { name: 'archived', color: 'red' },
            ],
          },
          EffectiveDate: { type: 'date' },
          Owner: { type: 'rich_text' },
          RelatedServices: { type: 'multi_select' },
          Description: { type: 'rich_text' },
          ComplianceLevel: {
            type: 'select',
            options: [
              { name: 'critical', color: 'red' },
              { name: 'high', color: 'orange' },
              { name: 'medium', color: 'yellow' },
              { name: 'low', color: 'green' },
            ],
          },
        },
      },
      {
        databaseId: '',
        name: 'ChittyChronicle',
        bidirectional: false, // Write-only from ChittyOS
        syncInterval: 30000, // 30 seconds
        properties: {
          ChittyID: { type: 'title' },
          Timestamp: { type: 'date' },
          EventType: {
            type: 'select',
            options: [
              { name: 'deployment', color: 'blue' },
              { name: 'config_change', color: 'yellow' },
              { name: 'incident', color: 'red' },
              { name: 'audit', color: 'gray' },
              { name: 'compliance', color: 'purple' },
            ],
          },
          Service: { type: 'rich_text' },
          Description: { type: 'rich_text' },
          EvidenceHash: { type: 'rich_text' },
          Severity: {
            type: 'select',
            options: [
              { name: 'info', color: 'gray' },
              { name: 'warning', color: 'yellow' },
              { name: 'error', color: 'orange' },
              { name: 'critical', color: 'red' },
            ],
          },
        },
      },
    ];

    // Store configurations
    dbConfigs.forEach((config) => {
      this.databases.set(config.name, config);
    });

    logger.info(`Configured ${dbConfigs.length} Notion databases for sync`);
  }

  /**
   * Create Notion database
   */
  async createDatabase(
    config: NotionDatabaseConfig,
    parentPageId: string
  ): Promise<string> {
    try {
      const response = await this.notion.databases.create({
        parent: { page_id: parentPageId },
        title: [
          {
            type: 'text',
            text: { content: config.name },
          },
        ],
        properties: config.properties as any,
      });

      const databaseId = response.id;
      logger.info(`Created Notion database: ${config.name} (${databaseId})`);

      // Update config with database ID
      config.databaseId = databaseId;
      this.databases.set(config.name, config);

      return databaseId;
    } catch (error: any) {
      logger.error(`Failed to create database ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * Sync ChittyRegistry entries to Notion
   */
  async syncRegistryToNotion(entries: RegistryEntry[]): Promise<void> {
    const config = this.databases.get('ChittyRegistry');
    if (!config || !config.databaseId) {
      throw new Error('ChittyRegistry database not initialized');
    }

    logger.info(`Syncing ${entries.length} registry entries to Notion...`);

    for (const entry of entries) {
      try {
        await this.notion.pages.create({
          parent: { database_id: config.databaseId },
          properties: {
            ChittyID: {
              title: [{ text: { content: entry.chittyId } }],
            },
            Name: {
              rich_text: [{ text: { content: entry.name } }],
            },
            Category: {
              select: { name: entry.category },
            },
            Capabilities: {
              multi_select: entry.capabilities.map((cap) => ({ name: cap })),
            },
            Status: {
              select: { name: entry.status },
            },
            Health: {
              select: { name: entry.health },
            },
            LastUpdated: {
              date: { start: entry.lastUpdated },
            },
            ...(entry.endpoint && {
              Endpoint: { url: entry.endpoint },
            }),
            ...(entry.version && {
              Version: { rich_text: [{ text: { content: entry.version } }] },
            }),
            ...(entry.description && {
              Description: {
                rich_text: [{ text: { content: entry.description } }],
              },
            }),
          },
        });

        logger.debug(`Synced registry entry: ${entry.name}`);
      } catch (error: any) {
        logger.error(`Failed to sync entry ${entry.name}:`, error);
      }
    }

    logger.info('Registry sync to Notion completed');
  }

  /**
   * Sync ChittySchema entities to Notion
   */
  async syncSchemaToNotion(entities: SchemaEntity[]): Promise<void> {
    const config = this.databases.get('ChittySchema');
    if (!config || !config.databaseId) {
      throw new Error('ChittySchema database not initialized');
    }

    logger.info(`Syncing ${entities.length} schema entities to Notion...`);

    for (const entity of entities) {
      try {
        await this.notion.pages.create({
          parent: { database_id: config.databaseId },
          properties: {
            ChittyID: {
              title: [{ text: { content: entity.chittyId } }],
            },
            EntityType: {
              select: { name: entity.entityType },
            },
            SchemaVersion: {
              rich_text: [{ text: { content: entity.schemaVersion } }],
            },
            Fields: {
              rich_text: [{ text: { content: JSON.stringify(entity.fields) } }],
            },
            ValidationRules: {
              multi_select: entity.validationRules.map((rule) => ({ name: rule })),
            },
            Relationships: {
              multi_select: entity.relationships.map((rel) => ({ name: rel })),
            },
            ...(entity.description && {
              Description: {
                rich_text: [{ text: { content: entity.description } }],
              },
            }),
          },
        });

        logger.debug(`Synced schema entity: ${entity.entityType}`);
      } catch (error: any) {
        logger.error(`Failed to sync entity ${entity.entityType}:`, error);
      }
    }

    logger.info('Schema sync to Notion completed');
  }

  /**
   * Sync ChittyGov policies to Notion
   */
  async syncGovToNotion(policies: GovPolicy[]): Promise<void> {
    const config = this.databases.get('ChittyGov');
    if (!config || !config.databaseId) {
      throw new Error('ChittyGov database not initialized');
    }

    logger.info(`Syncing ${policies.length} governance policies to Notion...`);

    for (const policy of policies) {
      try {
        await this.notion.pages.create({
          parent: { database_id: config.databaseId },
          properties: {
            ChittyID: {
              title: [{ text: { content: policy.chittyId } }],
            },
            PolicyName: {
              rich_text: [{ text: { content: policy.policyName } }],
            },
            Status: {
              select: { name: policy.status },
            },
            EffectiveDate: {
              date: { start: policy.effectiveDate },
            },
            Owner: {
              rich_text: [{ text: { content: policy.owner } }],
            },
            RelatedServices: {
              multi_select: policy.relatedServices.map((svc) => ({ name: svc })),
            },
            ComplianceLevel: {
              select: { name: policy.complianceLevel },
            },
            ...(policy.description && {
              Description: {
                rich_text: [{ text: { content: policy.description } }],
              },
            }),
          },
        });

        logger.debug(`Synced governance policy: ${policy.policyName}`);
      } catch (error: any) {
        logger.error(`Failed to sync policy ${policy.policyName}:`, error);
      }
    }

    logger.info('Governance sync to Notion completed');
  }

  /**
   * Sync ChittyChronicle events to Notion
   */
  async syncChronicleToNotion(events: ChronicleEvent[]): Promise<void> {
    const config = this.databases.get('ChittyChronicle');
    if (!config || !config.databaseId) {
      throw new Error('ChittyChronicle database not initialized');
    }

    logger.info(`Syncing ${events.length} chronicle events to Notion...`);

    for (const event of events) {
      try {
        await this.notion.pages.create({
          parent: { database_id: config.databaseId },
          properties: {
            ChittyID: {
              title: [{ text: { content: event.chittyId } }],
            },
            Timestamp: {
              date: { start: event.timestamp },
            },
            EventType: {
              select: { name: event.eventType },
            },
            Service: {
              rich_text: [{ text: { content: event.service } }],
            },
            Description: {
              rich_text: [{ text: { content: event.description } }],
            },
            Severity: {
              select: { name: event.severity },
            },
            ...(event.evidenceHash && {
              EvidenceHash: {
                rich_text: [{ text: { content: event.evidenceHash } }],
              },
            }),
          },
        });

        logger.debug(`Synced chronicle event: ${event.eventType}`);
      } catch (error: any) {
        logger.error(`Failed to sync event ${event.chittyId}:`, error);
      }
    }

    logger.info('Chronicle sync to Notion completed');
  }

  /**
   * Query Notion database for updates (bidirectional sync)
   */
  async queryNotionUpdates(
    databaseName: string,
    lastSyncTime: string
  ): Promise<any[]> {
    const config = this.databases.get(databaseName);
    if (!config || !config.databaseId) {
      throw new Error(`Database ${databaseName} not initialized`);
    }

    if (!config.bidirectional) {
      logger.warn(`Database ${databaseName} is not configured for bidirectional sync`);
      return [];
    }

    try {
      const response = await this.notion.databases.query({
        database_id: config.databaseId,
        filter: {
          timestamp: 'last_edited_time',
          last_edited_time: {
            after: lastSyncTime,
          },
        },
      });

      logger.info(
        `Found ${response.results.length} updates in ${databaseName} since ${lastSyncTime}`
      );

      return response.results;
    } catch (error: any) {
      logger.error(`Failed to query ${databaseName} updates:`, error);
      return [];
    }
  }

  /**
   * Start automatic sync intervals
   */
  startAutoSync(): void {
    logger.info('Starting automatic Notion sync intervals...');

    this.databases.forEach((config, name) => {
      const interval = setInterval(async () => {
        try {
          logger.debug(`Running scheduled sync for ${name}`);
          // Sync logic would go here based on database type
        } catch (error: any) {
          logger.error(`Auto-sync failed for ${name}:`, error);
        }
      }, config.syncInterval);

      this.syncIntervals.set(name, interval);
      logger.info(`Scheduled ${name} sync every ${config.syncInterval}ms`);
    });
  }

  /**
   * Stop all sync intervals
   */
  stopAutoSync(): void {
    logger.info('Stopping all Notion sync intervals...');

    this.syncIntervals.forEach((interval, name) => {
      clearInterval(interval);
      logger.info(`Stopped sync for ${name}`);
    });

    this.syncIntervals.clear();
  }

  /**
   * Get database configuration
   */
  getDatabaseConfig(name: string): NotionDatabaseConfig | undefined {
    return this.databases.get(name);
  }

  /**
   * Update database configuration
   */
  updateDatabaseConfig(name: string, updates: Partial<NotionDatabaseConfig>): void {
    const config = this.databases.get(name);
    if (config) {
      this.databases.set(name, { ...config, ...updates });
      logger.info(`Updated configuration for ${name}`);
    }
  }
}

export default NotionSyncService;
