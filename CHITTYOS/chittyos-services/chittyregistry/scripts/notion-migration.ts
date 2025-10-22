#!/usr/bin/env ts-node
/**
 * Notion Migration Script
 *
 * Initializes Notion databases and performs initial data migration
 * from existing ChittyOS state to Notion
 *
 * Usage:
 *   npm run migrate:notion:init       # Create databases
 *   npm run migrate:notion:seed       # Seed with initial data
 *   npm run migrate:notion:full       # Full migration (init + seed)
 */

import { Client } from '@notionhq/client';
import NotionSyncService, {
  RegistryEntry,
  SchemaEntity,
  GovPolicy,
  ChronicleEvent,
} from '../src/services/NotionSyncService';

// Configuration
const NOTION_TOKEN = process.env.NOTION_TOKEN || '';
const NOTION_PARENT_PAGE_ID = process.env.NOTION_PARENT_PAGE_ID || '';
const CHITTY_ID_TOKEN = process.env.CHITTY_ID_TOKEN || '';
const REGISTRY_SERVICE = process.env.REGISTRY_SERVICE || 'https://registry.chitty.cc';

if (!NOTION_TOKEN) {
  console.error('ERROR: NOTION_TOKEN environment variable is required');
  process.exit(1);
}

if (!NOTION_PARENT_PAGE_ID) {
  console.error('ERROR: NOTION_PARENT_PAGE_ID environment variable is required');
  console.error('Please create a parent page in Notion and set its ID');
  process.exit(1);
}

/**
 * Initialize Notion databases
 */
async function initializeDatabases() {
  console.log('=== Initializing Notion Databases ===\n');

  const syncService = new NotionSyncService(NOTION_TOKEN);
  await syncService.initializeDatabases();

  const databases = [
    'ChittyRegistry',
    'ChittySchema',
    'ChittyGov',
    'ChittyChronicle',
  ];

  for (const dbName of databases) {
    console.log(`Creating ${dbName} database...`);
    const config = syncService.getDatabaseConfig(dbName);

    if (!config) {
      console.error(`ERROR: Configuration not found for ${dbName}`);
      continue;
    }

    try {
      const databaseId = await syncService.createDatabase(config, NOTION_PARENT_PAGE_ID);
      console.log(`✅ Created ${dbName}: ${databaseId}\n`);

      // Update environment configuration
      console.log(`Add to your .env file:`);
      console.log(`${dbName.toUpperCase()}_NOTION_DB_ID=${databaseId}\n`);
    } catch (error: any) {
      console.error(`❌ Failed to create ${dbName}:`, error.message);
    }
  }

  console.log('=== Database Initialization Complete ===\n');
}

/**
 * Fetch existing ChittyOS registry data
 */
async function fetchRegistryData(): Promise<RegistryEntry[]> {
  console.log('Fetching ChittyRegistry data...');

  try {
    // Fetch from registry service
    const response = await fetch(`${REGISTRY_SERVICE}/api/v1/tools`, {
      headers: {
        Authorization: `Bearer ${CHITTY_ID_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Registry fetch failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.tools?.length || 0} registry entries\n`);

    // Map to RegistryEntry format
    return (data.tools || []).map((tool: any) => ({
      chittyId: tool.chittyId || `CHITTY-INFO-${Date.now()}`,
      name: tool.name,
      category: tool.category || 'service',
      capabilities: tool.capabilities || [],
      status: tool.status || 'active',
      health: tool.health || 'healthy',
      lastUpdated: tool.lastUpdated || new Date().toISOString(),
      endpoint: tool.endpoint,
      version: tool.version,
      description: tool.description,
    }));
  } catch (error: any) {
    console.error('Failed to fetch registry data:', error.message);
    return getMockRegistryData();
  }
}

/**
 * Get mock registry data for testing
 */
function getMockRegistryData(): RegistryEntry[] {
  console.log('Using mock registry data for testing...\n');

  return [
    {
      chittyId: 'CHITTY-INFO-1001',
      name: 'ChittyRegistry',
      category: 'service',
      capabilities: ['registry', 'discovery', 'search'],
      status: 'active',
      health: 'healthy',
      lastUpdated: new Date().toISOString(),
      endpoint: 'https://registry.chitty.cc',
      version: '2.0.0',
      description: 'Universal service registry and discovery platform',
    },
    {
      chittyId: 'CHITTY-INFO-1002',
      name: 'ChittySchema',
      category: 'service',
      capabilities: ['schema', 'validation', 'sync'],
      status: 'active',
      health: 'healthy',
      lastUpdated: new Date().toISOString(),
      endpoint: 'https://schema.chitty.cc',
      version: '1.0.0',
      description: 'Universal data schema and validation framework',
    },
    {
      chittyId: 'CHITTY-INFO-1003',
      name: 'ChittyID',
      category: 'service',
      capabilities: ['identity', 'minting', 'validation'],
      status: 'active',
      health: 'healthy',
      lastUpdated: new Date().toISOString(),
      endpoint: 'https://id.chitty.cc',
      version: '2.1.0',
      description: 'Central identity authority for ChittyOS ecosystem',
    },
    {
      chittyId: 'CHITTY-INFO-1004',
      name: 'chittycheck-enhanced',
      category: 'tool',
      capabilities: ['validation', 'compliance', 'testing'],
      status: 'active',
      health: 'healthy',
      lastUpdated: new Date().toISOString(),
      version: '3.0.0',
      description: 'Comprehensive ChittyOS compliance validation tool',
    },
  ];
}

/**
 * Get mock schema entities
 */
function getMockSchemaData(): SchemaEntity[] {
  return [
    {
      chittyId: 'CHITTY-INFO-2001',
      entityType: 'PEO',
      schemaVersion: '1.0.0',
      fields: {
        name: 'string',
        email: 'string',
        chittyId: 'string',
        roles: 'array',
      },
      validationRules: ['required:name', 'required:chittyId', 'email:email'],
      relationships: ['AUTH', 'ACTOR'],
      description: 'Person entity schema for ChittyOS',
    },
    {
      chittyId: 'CHITTY-INFO-2002',
      entityType: 'EVNT',
      schemaVersion: '1.0.0',
      fields: {
        eventType: 'string',
        timestamp: 'datetime',
        service: 'string',
        severity: 'string',
        description: 'text',
      },
      validationRules: ['required:eventType', 'required:timestamp', 'required:service'],
      relationships: ['ACTOR', 'CONTEXT'],
      description: 'Event entity schema for audit trail',
    },
    {
      chittyId: 'CHITTY-INFO-2003',
      entityType: 'AUTH',
      schemaVersion: '1.0.0',
      fields: {
        token: 'string',
        expiresAt: 'datetime',
        scope: 'array',
        issuer: 'string',
      },
      validationRules: ['required:token', 'required:expiresAt', 'required:issuer'],
      relationships: ['PEO', 'ACTOR'],
      description: 'Authentication entity schema',
    },
  ];
}

/**
 * Get mock governance policies
 */
function getMockGovData(): GovPolicy[] {
  return [
    {
      chittyId: 'CHITTY-INFO-3001',
      policyName: 'ChittyID Central Authority Policy',
      status: 'active',
      effectiveDate: '2025-01-01',
      owner: 'ChittyCorp Engineering',
      relatedServices: ['ChittyID', 'ChittyRegistry', 'ChittySchema'],
      complianceLevel: 'critical',
      description: 'All ChittyIDs must be minted from central authority (id.chitty.cc). Local generation is prohibited.',
    },
    {
      chittyId: 'CHITTY-INFO-3002',
      policyName: 'Service Health Monitoring Policy',
      status: 'active',
      effectiveDate: '2025-01-15',
      owner: 'Platform Operations',
      relatedServices: ['ChittyRegistry', 'ChittyRouter', 'ChittyGateway'],
      complianceLevel: 'high',
      description: 'All services must expose /health endpoints and respond within 2 seconds',
    },
    {
      chittyId: 'CHITTY-INFO-3003',
      policyName: 'Data Retention Policy',
      status: 'active',
      effectiveDate: '2025-02-01',
      owner: 'Compliance Team',
      relatedServices: ['ChittyChronicle', 'ChittySchema'],
      complianceLevel: 'medium',
      description: 'Audit logs retained for 7 years, operational logs for 90 days',
    },
  ];
}

/**
 * Get mock chronicle events
 */
function getMockChronicleData(): ChronicleEvent[] {
  return [
    {
      chittyId: 'CHITTY-INFO-4001',
      timestamp: new Date().toISOString(),
      eventType: 'deployment',
      service: 'ChittyRegistry',
      description: 'Deployed ChittyRegistry v2.0.0 with Notion sync integration',
      severity: 'info',
      evidenceHash: 'sha256:abc123def456',
    },
    {
      chittyId: 'CHITTY-INFO-4002',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      eventType: 'config_change',
      service: 'ChittyRouter',
      description: 'Updated routing configuration for unified service gateway',
      severity: 'warning',
      evidenceHash: 'sha256:789ghi012jkl',
    },
    {
      chittyId: 'CHITTY-INFO-4003',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      eventType: 'compliance',
      service: 'ChittyCheck',
      description: 'ChittyCheck validation passed: 0 rogue ID patterns detected',
      severity: 'info',
      evidenceHash: 'sha256:345mno678pqr',
    },
  ];
}

/**
 * Seed Notion databases with initial data
 */
async function seedDatabases() {
  console.log('=== Seeding Notion Databases ===\n');

  const syncService = new NotionSyncService(NOTION_TOKEN);
  await syncService.initializeDatabases();

  // Load database IDs from environment
  const registryDbId = process.env.CHITTYREGISTRY_NOTION_DB_ID || '';
  const schemaDbId = process.env.CHITTYSCHEMA_NOTION_DB_ID || '';
  const govDbId = process.env.CHITTYGOV_NOTION_DB_ID || '';
  const chronicleDbId = process.env.CHITTYCHRONICLE_NOTION_DB_ID || '';

  if (!registryDbId || !schemaDbId || !govDbId || !chronicleDbId) {
    console.error('ERROR: Database IDs not found in environment');
    console.error('Run "npm run migrate:notion:init" first to create databases');
    process.exit(1);
  }

  // Update sync service with database IDs
  syncService.updateDatabaseConfig('ChittyRegistry', { databaseId: registryDbId });
  syncService.updateDatabaseConfig('ChittySchema', { databaseId: schemaDbId });
  syncService.updateDatabaseConfig('ChittyGov', { databaseId: govDbId });
  syncService.updateDatabaseConfig('ChittyChronicle', { databaseId: chronicleDbId });

  // 1. Seed ChittyRegistry
  console.log('Seeding ChittyRegistry...');
  const registryData = await fetchRegistryData();
  await syncService.syncRegistryToNotion(registryData);

  // 2. Seed ChittySchema
  console.log('Seeding ChittySchema...');
  const schemaData = getMockSchemaData();
  await syncService.syncSchemaToNotion(schemaData);

  // 3. Seed ChittyGov
  console.log('Seeding ChittyGov...');
  const govData = getMockGovData();
  await syncService.syncGovToNotion(govData);

  // 4. Seed ChittyChronicle
  console.log('Seeding ChittyChronicle...');
  const chronicleData = getMockChronicleData();
  await syncService.syncChronicleToNotion(chronicleData);

  console.log('\n=== Database Seeding Complete ===\n');
}

/**
 * Full migration (init + seed)
 */
async function fullMigration() {
  console.log('=== Starting Full Notion Migration ===\n');

  await initializeDatabases();

  console.log('\nWaiting 5 seconds before seeding...\n');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  await seedDatabases();

  console.log('=== Full Migration Complete ===\n');
  console.log('Next steps:');
  console.log('1. Verify databases in Notion');
  console.log('2. Configure webhooks in Notion (Settings > Webhooks)');
  console.log('3. Set webhook URL to: https://registry.chitty.cc/webhook/notion');
  console.log('4. Start auto-sync with: npm run sync:notion:start\n');
}

/**
 * Main execution
 */
async function main() {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'init':
        await initializeDatabases();
        break;

      case 'seed':
        await seedDatabases();
        break;

      case 'full':
      default:
        await fullMigration();
        break;
    }
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
