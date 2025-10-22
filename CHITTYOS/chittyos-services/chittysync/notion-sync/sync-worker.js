/**
 * Main Sync Worker with Batching
 * Orchestrates the complete AtomicFacts → Notion sync pipeline
 */

import { Client } from '@notionhq/client';
import { NOTION_CONFIG, validateConfig } from './notion-sync-config.js';
import { validateDatabaseSchema, createMissingProperties } from './schema-validator.js';
import { batchUpsertFacts, deduplicateFacts } from './upsert-logic.js';
import { notionRetry } from './retry-handler.js';
import { DeadLetterQueue, SyncMonitor, HealthChecker } from './dlq-handler.js';

/**
 * Notion Sync Worker
 */
export class NotionSyncWorker {
  constructor(options = {}) {
    this.config = NOTION_CONFIG;
    this.dlq = new DeadLetterQueue(options.dlqStorage);
    this.monitor = new SyncMonitor();
    this.healthChecker = new HealthChecker(this.dlq, this.monitor);
    this.isRunning = false;
    this.shouldStop = false;

    // Initialize Notion client
    this.notion = new Client({
      auth: this.config.database.integrationToken,
      notionVersion: this.config.api.version
    });
  }

  /**
   * Initialize worker and validate setup
   */
  async initialize() {
    console.log('Initializing Notion Sync Worker...');

    // Validate configuration
    validateConfig();

    // Test Notion connection
    await this.testConnection();

    // Validate database schema
    await this.validateSchema();

    console.log('✅ Notion Sync Worker initialized successfully');
  }

  /**
   * Test Notion API connection
   */
  async testConnection() {
    try {
      const testResult = await notionRetry(async () => {
        return await this.notion.databases.retrieve({
          database_id: this.config.database.atomicFactsId
        });
      });

      console.log(`✅ Connected to Notion database: ${testResult.title[0]?.text?.content || 'Unnamed'}`);
      return true;

    } catch (error) {
      console.error('❌ Failed to connect to Notion:', error.message);
      throw new Error(`Notion connection failed: ${error.message}`);
    }
  }

  /**
   * Validate and fix database schema
   */
  async validateSchema() {
    console.log('Validating database schema...');

    const schemaResult = await validateDatabaseSchema(
      this.notion,
      this.config.database.atomicFactsId
    );

    if (schemaResult.isValid) {
      console.log('✅ Database schema is valid');
      return true;
    }

    console.warn('⚠️ Schema validation issues found:', schemaResult.mismatches);

    // Attempt to create missing properties
    try {
      const createResult = await createMissingProperties(
        this.notion,
        this.config.database.atomicFactsId,
        schemaResult.mismatches
      );

      if (createResult.success && createResult.created.length > 0) {
        console.log('✅ Created missing properties:', createResult.created);
      }

    } catch (error) {
      console.error('❌ Failed to create missing properties:', error.message);
      throw new Error(`Schema setup failed: ${error.message}`);
    }
  }

  /**
   * Sync atomic facts to Notion
   */
  async syncFacts(atomicFacts, options = {}) {
    const {
      dryRun = false,
      forceSync = false,
      batchSize = this.config.sync.batchSize
    } = options;

    console.log(`Starting sync of ${atomicFacts.length} atomic facts ${dryRun ? '(DRY RUN)' : ''}`);

    const startTime = Date.now();

    try {
      // Deduplicate facts
      const deduplication = deduplicateFacts(atomicFacts);
      if (deduplication.duplicateCount > 0) {
        console.warn(`⚠️ Found ${deduplication.duplicateCount} duplicate facts`);
      }

      // Process facts in batches
      const batchResult = await batchUpsertFacts(
        this.notion,
        deduplication.unique,
        {
          batchSize,
          dryRun,
          delayBetweenBatches: this.config.sync.batchDelay
        }
      );

      // Handle failures
      if (batchResult.errors.length > 0) {
        await this.handleFailures(batchResult.errors);
      }

      // Update metrics
      this.updateMetrics(batchResult);

      const summary = {
        totalFacts: atomicFacts.length,
        duplicatesRemoved: deduplication.duplicateCount,
        processed: deduplication.uniqueCount,
        created: batchResult.created,
        updated: batchResult.updated,
        skipped: batchResult.skipped,
        errors: batchResult.errors.length,
        successRate: batchResult.successRate,
        duration: Date.now() - startTime,
        dryRun
      };

      console.log('📊 Sync Summary:', summary);
      return summary;

    } catch (error) {
      console.error('❌ Sync failed:', error.message);
      this.monitor.recordError(error);
      throw error;
    }
  }

  /**
   * Handle failed operations
   */
  async handleFailures(errors) {
    console.log(`Processing ${errors.length} failed operations...`);

    for (const error of errors) {
      await this.dlq.add(
        error.factId,
        error.error,
        error.fact,
        0 // Initial retry count
      );

      this.monitor.recordError(error.error, error.factId);
    }

    console.log(`💀 Added ${errors.length} items to DLQ`);
  }

  /**
   * Process DLQ retries
   */
  async processDLQRetries() {
    console.log('Processing DLQ retries...');

    const retryableItems = await this.dlq.getRetryableItems();
    if (retryableItems.length === 0) {
      console.log('No items ready for retry');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    console.log(`Found ${retryableItems.length} items ready for retry`);

    let succeeded = 0;
    let failed = 0;

    for (const item of retryableItems) {
      try {
        // Attempt retry
        await this.syncFacts([item.atomicFact], { batchSize: 1 });

        // Remove from DLQ on success
        await this.dlq.remove(item.factId);
        succeeded++;

        console.log(`✅ Retry succeeded for ${item.factId}`);

      } catch (error) {
        failed++;

        if (item.retryCount >= this.config.dlq.maxRetries) {
          // Max retries exceeded, remove from DLQ
          await this.dlq.remove(item.factId);
          console.error(`💀 Max retries exceeded for ${item.factId}, removing from DLQ`);

        } else {
          // Update retry count and retry time
          item.retryCount++;
          item.retryAt = this.dlq.calculateRetryTime(item.retryCount);
          item.lastAttempt = new Date().toISOString();
          await this.dlq.storage.set(item.factId, item);

          console.warn(`⚠️ Retry failed for ${item.factId}, retry count: ${item.retryCount}`);
        }
      }
    }

    return {
      processed: retryableItems.length,
      succeeded,
      failed
    };
  }

  /**
   * Update internal metrics
   */
  updateMetrics(batchResult) {
    for (const result of batchResult.processed) {
      this.monitor.recordSuccess(result.operation, result.duration);
    }
  }

  /**
   * Start continuous sync worker
   */
  async start(atomicFactsSource, options = {}) {
    if (this.isRunning) {
      throw new Error('Worker is already running');
    }

    const {
      pollInterval = 30000, // 30 seconds
      batchSize = this.config.sync.batchSize,
      maxFactsPerBatch = 100
    } = options;

    this.isRunning = true;
    this.shouldStop = false;

    console.log('🚀 Starting continuous sync worker...');

    while (!this.shouldStop) {
      try {
        // Get new facts to sync
        const newFacts = await atomicFactsSource.getNewFacts(maxFactsPerBatch);

        if (newFacts.length > 0) {
          await this.syncFacts(newFacts, { batchSize });
        }

        // Process DLQ retries
        await this.processDLQRetries();

        // Cleanup expired DLQ items
        await this.dlq.cleanup();

        // Check alerts
        const alerts = this.monitor.checkAlerts();
        if (alerts.length > 0) {
          console.warn('⚠️ Health alerts:', alerts);
        }

      } catch (error) {
        console.error('Worker cycle error:', error.message);
        this.monitor.recordError(error);
      }

      // Wait before next cycle
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    this.isRunning = false;
    console.log('🛑 Sync worker stopped');
  }

  /**
   * Stop the worker
   */
  stop() {
    console.log('Stopping sync worker...');
    this.shouldStop = true;
  }

  /**
   * Get worker health status
   */
  async getHealth() {
    return await this.healthChecker.getHealth();
  }

  /**
   * Get detailed metrics
   */
  getMetrics() {
    return {
      sync: this.monitor.getMetrics(),
      performance: this.monitor.getPerformanceStats(),
      errors: this.monitor.getRecentErrors(),
      dlq: this.dlq.getStats()
    };
  }

  /**
   * Manual DLQ management
   */
  async getDLQStats() {
    return await this.dlq.getStats();
  }

  async clearDLQ() {
    const stats = await this.dlq.getStats();
    for (const [factId] of this.dlq.storage) {
      await this.dlq.remove(factId);
    }
    return { cleared: stats.depth };
  }

  /**
   * Diagnostic sync (dry run with detailed output)
   */
  async diagnosticSync(sampleFacts) {
    console.log('🔍 Running diagnostic sync...');

    const results = {
      configValid: false,
      connectionValid: false,
      schemaValid: false,
      sampleTransformation: null,
      dryRunResults: null,
      recommendations: []
    };

    try {
      // Test configuration
      validateConfig();
      results.configValid = true;

    } catch (error) {
      results.recommendations.push(`Fix configuration: ${error.message}`);
    }

    try {
      // Test connection
      await this.testConnection();
      results.connectionValid = true;

    } catch (error) {
      results.recommendations.push(`Fix Notion connection: ${error.message}`);
    }

    try {
      // Validate schema
      await this.validateSchema();
      results.schemaValid = true;

    } catch (error) {
      results.recommendations.push(`Fix database schema: ${error.message}`);
    }

    if (sampleFacts && sampleFacts.length > 0) {
      try {
        // Test transformation
        const { transformToNotionPayload } = await import('./schema-validator.js');
        results.sampleTransformation = transformToNotionPayload(sampleFacts[0]);

        // Dry run sync
        results.dryRunResults = await this.syncFacts(sampleFacts.slice(0, 5), {
          dryRun: true
        });

      } catch (error) {
        results.recommendations.push(`Fix fact transformation: ${error.message}`);
      }
    }

    return results;
  }
}

/**
 * Simple atomic facts source interface
 */
export class AtomicFactsSource {
  constructor(getFactsFunction) {
    this.getFacts = getFactsFunction;
    this.lastSyncTime = null;
  }

  async getNewFacts(limit = 100) {
    // Implementation depends on your data source
    // This is a placeholder that should be replaced
    return await this.getFacts(this.lastSyncTime, limit);
  }

  updateLastSyncTime(timestamp = new Date()) {
    this.lastSyncTime = timestamp;
  }
}

/**
 * Export convenience function for quick sync
 */
export async function syncAtomicFacts(atomicFacts, options = {}) {
  const worker = new NotionSyncWorker();
  await worker.initialize();
  return await worker.syncFacts(atomicFacts, options);
}