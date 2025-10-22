#!/usr/bin/env ts-node
/**
 * Notion Sync Daemon
 *
 * Continuous sync daemon that maintains bidirectional sync between
 * ChittyOS services and Notion databases
 *
 * Features:
 * - Automatic polling of ChittyOS services
 * - Real-time webhook processing
 * - Configurable sync intervals
 * - Health monitoring
 * - Graceful shutdown
 */

import NotionSyncService from '../src/services/NotionSyncService';
import { logger } from '../src/utils/logger';
import express from 'express';
import notionWebhookRouter from '../src/routes/notion-webhooks';

// Configuration
const NOTION_TOKEN = process.env.NOTION_TOKEN || '';
const PORT = parseInt(process.env.SYNC_DAEMON_PORT || '3456');
const REGISTRY_SERVICE = process.env.REGISTRY_SERVICE || 'https://registry.chitty.cc';
const SCHEMA_SERVICE = process.env.SCHEMA_SERVICE || 'https://schema.chitty.cc';
const GOV_SERVICE = process.env.GOV_SERVICE || 'https://gov.chitty.cc';
const CHITTY_ID_TOKEN = process.env.CHITTY_ID_TOKEN || '';

// Database IDs from environment
const DB_IDS = {
  registry: process.env.CHITTYREGISTRY_NOTION_DB_ID || '',
  schema: process.env.CHITTYSCHEMA_NOTION_DB_ID || '',
  gov: process.env.CHITTYGOV_NOTION_DB_ID || '',
  chronicle: process.env.CHITTYCHRONICLE_NOTION_DB_ID || '',
};

// Validate configuration
function validateConfig(): void {
  const missing: string[] = [];

  if (!NOTION_TOKEN) missing.push('NOTION_TOKEN');
  if (!CHITTY_ID_TOKEN) missing.push('CHITTY_ID_TOKEN');
  if (!DB_IDS.registry) missing.push('CHITTYREGISTRY_NOTION_DB_ID');
  if (!DB_IDS.schema) missing.push('CHITTYSCHEMA_NOTION_DB_ID');
  if (!DB_IDS.gov) missing.push('CHITTYGOV_NOTION_DB_ID');
  if (!DB_IDS.chronicle) missing.push('CHITTYCHRONICLE_NOTION_DB_ID');

  if (missing.length > 0) {
    console.error('ERROR: Missing required environment variables:');
    missing.forEach((varName) => console.error(`  - ${varName}`));
    console.error('\nRun "npm run migrate:notion:init" to create databases first.');
    process.exit(1);
  }
}

// Initialize sync service
async function initializeSyncService(): Promise<NotionSyncService> {
  logger.info('Initializing Notion sync service...');

  const syncService = new NotionSyncService(NOTION_TOKEN);
  await syncService.initializeDatabases();

  // Configure database IDs
  syncService.updateDatabaseConfig('ChittyRegistry', { databaseId: DB_IDS.registry });
  syncService.updateDatabaseConfig('ChittySchema', { databaseId: DB_IDS.schema });
  syncService.updateDatabaseConfig('ChittyGov', { databaseId: DB_IDS.gov });
  syncService.updateDatabaseConfig('ChittyChronicle', { databaseId: DB_IDS.chronicle });

  logger.info('Sync service initialized successfully');
  return syncService;
}

// Fetch data from ChittyOS services
async function fetchChittyOSData() {
  logger.info('Fetching latest data from ChittyOS services...');

  try {
    // Fetch registry data
    const registryResponse = await fetch(`${REGISTRY_SERVICE}/api/v1/tools`, {
      headers: { Authorization: `Bearer ${CHITTY_ID_TOKEN}` },
    });

    let registryData = [];
    if (registryResponse.ok) {
      const data = await registryResponse.json();
      const tools = (data as any)?.tools; registryData = Array.isArray(tools) ? tools : [];
      logger.info(`Fetched ${registryData.length} registry entries`);
    } else {
      logger.warn(`Registry fetch failed: ${registryResponse.statusText}`);
    }

    // Additional services would be fetched here
    // Schema, Gov data fetching logic...

    return {
      registry: registryData,
      schema: [], // TODO: Fetch from schema service
      gov: [], // TODO: Fetch from gov service
      chronicle: [], // Events are push-only
    };
  } catch (error: any) {
    logger.error('Failed to fetch ChittyOS data:', error);
    return { registry: [], schema: [], gov: [], chronicle: [] };
  }
}

// Sync cycle
async function runSyncCycle(syncService: NotionSyncService): Promise<void> {
  try {
    logger.info('Starting sync cycle...');

    const data = await fetchChittyOSData();

    // Sync each dataset
    if (data.registry.length > 0) {
      await syncService.syncRegistryToNotion(data.registry);
    }

    if (data.schema.length > 0) {
      await syncService.syncSchemaToNotion(data.schema);
    }

    if (data.gov.length > 0) {
      await syncService.syncGovToNotion(data.gov);
    }

    logger.info('Sync cycle completed successfully');
  } catch (error: any) {
    logger.error('Sync cycle failed:', error);
  }
}

// Setup Express server for webhooks
function setupWebhookServer(syncService: NotionSyncService): express.Application {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mount webhook routes
  app.use('/', notionWebhookRouter);

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'notion-sync-daemon',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      databases: {
        ChittyRegistry: DB_IDS.registry,
        ChittySchema: DB_IDS.schema,
        ChittyGov: DB_IDS.gov,
        ChittyChronicle: DB_IDS.chronicle,
      },
    });
  });

  // Status endpoint
  app.get('/status', (req, res) => {
    res.json({
      sync: {
        running: true,
        intervals: {
          ChittyRegistry: '60s',
          ChittySchema: '300s',
          ChittyGov: '600s',
          ChittyChronicle: '30s',
        },
      },
      webhooks: {
        endpoint: `http://localhost:${PORT}/webhook/notion`,
        health: 'ok',
      },
    });
  });

  return app;
}

// Main daemon
async function main() {
  console.log('=== Notion Sync Daemon Starting ===\n');

  // Validate configuration
  validateConfig();

  // Initialize sync service
  const syncService = await initializeSyncService();

  // Start automatic sync intervals
  syncService.startAutoSync();
  logger.info('Automatic sync intervals started');

  // Run initial sync
  await runSyncCycle(syncService);

  // Setup webhook server
  const app = setupWebhookServer(syncService);
  const server = app.listen(PORT, () => {
    logger.info(`Webhook server listening on port ${PORT}`);
    logger.info(`Webhook endpoint: http://localhost:${PORT}/webhook/notion`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
  });

  // Periodic sync cycle (in addition to automatic intervals)
  const syncInterval = setInterval(async () => {
    await runSyncCycle(syncService);
  }, 300000); // Every 5 minutes

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('\n=== Shutting down Notion Sync Daemon ===');

    // Stop sync intervals
    syncService.stopAutoSync();
    clearInterval(syncInterval);

    // Close webhook server
    server.close(() => {
      logger.info('Webhook server closed');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.warn('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  // Handle signals
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log('\n=== Notion Sync Daemon Running ===');
  console.log(`PID: ${process.pid}`);
  console.log(`Port: ${PORT}`);
  console.log('\nPress Ctrl+C to stop\n');
}

// Run daemon
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
