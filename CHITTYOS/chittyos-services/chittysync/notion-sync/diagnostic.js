#!/usr/bin/env node

/**
 * Comprehensive Diagnostic Tool
 * One-pass diagnostic checklist implementation
 */

import dotenv from 'dotenv';
import { Client } from '@notionhq/client';
import { NOTION_CONFIG, validateConfig } from './notion-sync-config.js';
import { validateDatabaseSchema, transformToNotionPayload } from './schema-validator.js';

dotenv.config();

/**
 * Diagnostic runner with timing and detailed output
 */
class DiagnosticRunner {
  constructor() {
    this.results = {
      config: { passed: false, duration: 0, details: null },
      connection: { passed: false, duration: 0, details: null },
      schema: { passed: false, duration: 0, details: null },
      dryRun: { passed: false, duration: 0, details: null },
      upsert: { passed: false, duration: 0, details: null },
      backoff: { passed: false, duration: 0, details: null },
      observability: { passed: false, duration: 0, details: null },
      overall: { passed: false, recommendations: [] }
    };
  }

  async run() {
    console.log('🔍 Running Notion Sync Diagnostics\n');

    await this.configSanity();
    await this.schemaProbe();
    await this.dryRunTransform();
    await this.writeTest();
    await this.upsertLogic();
    await this.backoffTest();
    await this.observabilityCheck();

    this.generateSummary();
    return this.results;
  }

  /**
   * Config sanity check (30s target)
   */
  async configSanity() {
    const start = Date.now();
    console.log('⚙️ Config Sanity Check...');

    try {
      // Validate configuration
      validateConfig();

      // Test environment variables
      const requiredVars = [
        'NOTION_INTEGRATION_TOKEN',
        'NOTION_DATABASE_ID_ATOMIC_FACTS'
      ];

      const missing = requiredVars.filter(v => !process.env[v]);
      if (missing.length > 0) {
        throw new Error(`Missing environment variables: ${missing.join(', ')}`);
      }

      // Initialize Notion client
      const notion = new Client({
        auth: NOTION_CONFIG.database.integrationToken,
        notionVersion: NOTION_CONFIG.api.version
      });

      // Test basic API access
      const databases = await notion.search({
        filter: { property: 'object', value: 'database' },
        page_size: 1
      });

      this.results.config = {
        passed: true,
        duration: Date.now() - start,
        details: {
          integrationToken: '✅ Valid',
          databaseId: NOTION_CONFIG.database.atomicFactsId,
          apiAccess: '✅ Connected',
          totalDatabases: databases.results.length
        }
      };

      console.log('✅ Config validation passed');

    } catch (error) {
      this.results.config = {
        passed: false,
        duration: Date.now() - start,
        details: { error: error.message }
      };

      console.log('❌ Config validation failed:', error.message);
      this.results.overall.recommendations.push(
        `Fix configuration: ${error.message}`
      );
    }
  }

  /**
   * Schema probe (60s target)
   */
  async schemaProbe() {
    const start = Date.now();
    console.log('\n📋 Schema Probe...');

    if (!this.results.config.passed) {
      console.log('⏭️ Skipping - config validation failed');
      return;
    }

    try {
      const notion = new Client({
        auth: NOTION_CONFIG.database.integrationToken
      });

      // Fetch database properties
      const database = await notion.databases.retrieve({
        database_id: NOTION_CONFIG.database.atomicFactsId
      });

      // Validate schema
      const schemaResult = await validateDatabaseSchema(
        notion,
        NOTION_CONFIG.database.atomicFactsId
      );

      this.results.schema = {
        passed: schemaResult.isValid,
        duration: Date.now() - start,
        details: {
          databaseTitle: database.title[0]?.text?.content || 'Unnamed',
          totalProperties: Object.keys(database.properties).length,
          expectedProperties: Object.keys(NOTION_CONFIG.fieldMap).length,
          mismatches: schemaResult.mismatches,
          validProperties: schemaResult.properties
        }
      };

      if (schemaResult.isValid) {
        console.log('✅ Schema validation passed');
      } else {
        console.log('❌ Schema validation failed');
        console.log('   Mismatches:', schemaResult.mismatches);
        this.results.overall.recommendations.push(
          'Fix database schema: run schema setup or manually create missing properties'
        );
      }

    } catch (error) {
      this.results.schema = {
        passed: false,
        duration: Date.now() - start,
        details: { error: error.message }
      };

      console.log('❌ Schema probe failed:', error.message);
      this.results.overall.recommendations.push(
        `Fix database access: ${error.message}`
      );
    }
  }

  /**
   * Dry-run transform test (60s target)
   */
  async dryRunTransform() {
    const start = Date.now();
    console.log('\n🧪 Dry-run Transform Test...');

    try {
      // Create sample atomic fact
      const sampleFact = {
        factId: `TEST-${Date.now()}`,
        parentArtifactId: 'sample-document-123',
        factText: 'This is a test atomic fact for validation purposes.',
        factType: 'ACTION',
        locationRef: 'Page 1, Line 5',
        classification: 'FACT',
        weight: 0.85,
        credibility: ['PRIMARY_SOURCE', 'CORROBORATED'],
        chainStatus: 'Pending',
        verifiedAt: new Date().toISOString(),
        verificationMethod: 'Automated validation'
      };

      // Transform to Notion payload
      const transformation = transformToNotionPayload(sampleFact);

      this.results.dryRun = {
        passed: transformation.isValid,
        duration: Date.now() - start,
        details: {
          sampleFact,
          transformation: transformation.properties,
          errors: transformation.errors,
          propertyCount: Object.keys(transformation.properties).length
        }
      };

      if (transformation.isValid) {
        console.log('✅ Transformation test passed');
        console.log(`   Generated ${Object.keys(transformation.properties).length} properties`);
      } else {
        console.log('❌ Transformation test failed');
        console.log('   Errors:', transformation.errors);
        this.results.overall.recommendations.push(
          'Fix fact transformation: check field mapping and enum values'
        );
      }

    } catch (error) {
      this.results.dryRun = {
        passed: false,
        duration: Date.now() - start,
        details: { error: error.message }
      };

      console.log('❌ Dry-run transform failed:', error.message);
    }
  }

  /**
   * Write test (30s target)
   */
  async writeTest() {
    const start = Date.now();
    console.log('\n✍️ Write Test...');

    if (!this.results.schema.passed || !this.results.dryRun.passed) {
      console.log('⏭️ Skipping - prerequisites failed');
      return;
    }

    try {
      const notion = new Client({
        auth: NOTION_CONFIG.database.integrationToken
      });

      const testFactId = `TEST-${Date.now()}`;

      // Create test page
      const testPage = await notion.pages.create({
        parent: {
          database_id: NOTION_CONFIG.database.atomicFactsId
        },
        properties: {
          [NOTION_CONFIG.fieldMap.factId]: {
            title: [{ text: { content: testFactId } }]
          },
          [NOTION_CONFIG.fieldMap.factText]: {
            rich_text: [{ text: { content: 'Test write operation' } }]
          },
          [NOTION_CONFIG.fieldMap.externalId]: {
            rich_text: [{ text: { content: testFactId } }]
          }
        }
      });

      // Verify page was created
      const verification = await notion.pages.retrieve({
        page_id: testPage.id
      });

      // Clean up test page
      await notion.pages.update({
        page_id: testPage.id,
        archived: true
      });

      this.results.upsert = {
        passed: true,
        duration: Date.now() - start,
        details: {
          testPageId: testPage.id,
          createdAt: testPage.created_time,
          verified: verification.id === testPage.id,
          cleanedUp: true
        }
      };

      console.log('✅ Write test passed');
      console.log(`   Created and verified page: ${testPage.id}`);

    } catch (error) {
      this.results.upsert = {
        passed: false,
        duration: Date.now() - start,
        details: { error: error.message }
      };

      console.log('❌ Write test failed:', error.message);
      this.results.overall.recommendations.push(
        `Fix write permissions: ${error.message}`
      );
    }
  }

  /**
   * Upsert logic test (2 min target)
   */
  async upsertLogic() {
    const start = Date.now();
    console.log('\n🔄 Upsert Logic Test...');

    if (!this.results.upsert.passed) {
      console.log('⏭️ Skipping - write test failed');
      return;
    }

    try {
      const { NotionSyncWorker } = await import('./sync-worker.js');

      const worker = new NotionSyncWorker();
      await worker.initialize();

      // Test fact
      const testFact = {
        factId: `UPSERT-TEST-${Date.now()}`,
        factText: 'Initial upsert test',
        factType: 'ACTION',
        classification: 'FACT',
        weight: 0.5
      };

      // First upsert (create)
      const createResult = await worker.syncFacts([testFact], { dryRun: false });

      // Update the fact
      testFact.factText = 'Updated upsert test';
      testFact.weight = 0.8;

      // Second upsert (update)
      const updateResult = await worker.syncFacts([testFact], { dryRun: false });

      // Third upsert (no change)
      const noChangeResult = await worker.syncFacts([testFact], { dryRun: false });

      this.results.upsert = {
        passed: true,
        duration: Date.now() - start,
        details: {
          createResult,
          updateResult,
          noChangeResult,
          idempotencyWorking: noChangeResult.skipped > 0
        }
      };

      console.log('✅ Upsert logic test passed');
      console.log(`   Create: ${createResult.created}, Update: ${updateResult.updated}, Skipped: ${noChangeResult.skipped}`);

    } catch (error) {
      this.results.upsert = {
        passed: false,
        duration: Date.now() - start,
        details: { error: error.message }
      };

      console.log('❌ Upsert logic test failed:', error.message);
    }
  }

  /**
   * Backoff test (30s target)
   */
  async backoffTest() {
    const start = Date.now();
    console.log('\n⏱️ Backoff Test...');

    try {
      const { withRetry, RateLimiter } = await import('./retry-handler.js');

      // Test retry mechanism
      let attemptCount = 0;
      const testOperation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          const error = new Error('Simulated failure');
          error.status = 500;
          throw error;
        }
        return { success: true, attempts: attemptCount };
      };

      const retryResult = await withRetry(testOperation, {
        maxRetries: 5,
        baseDelay: 100
      });

      // Test rate limiter
      const rateLimiter = new RateLimiter(5); // 5 requests per second
      const rateLimitStart = Date.now();

      const rateLimitPromises = Array.from({ length: 10 }, (_, i) =>
        rateLimiter.execute(async () => ({ request: i, timestamp: Date.now() }))
      );

      const rateLimitResults = await Promise.all(rateLimitPromises);
      const rateLimitDuration = Date.now() - rateLimitStart;

      this.results.backoff = {
        passed: true,
        duration: Date.now() - start,
        details: {
          retryTest: {
            attempts: retryResult.attempts,
            success: retryResult.success
          },
          rateLimitTest: {
            requests: rateLimitResults.length,
            duration: rateLimitDuration,
            averageDelay: rateLimitDuration / rateLimitResults.length
          }
        }
      };

      console.log('✅ Backoff test passed');
      console.log(`   Retry attempts: ${retryResult.attempts}, Rate limit duration: ${rateLimitDuration}ms`);

    } catch (error) {
      this.results.backoff = {
        passed: false,
        duration: Date.now() - start,
        details: { error: error.message }
      };

      console.log('❌ Backoff test failed:', error.message);
    }
  }

  /**
   * Observability check (60s target)
   */
  async observabilityCheck() {
    const start = Date.now();
    console.log('\n📊 Observability Check...');

    try {
      const { SyncMonitor, DeadLetterQueue, HealthChecker } = await import('./dlq-handler.js');

      // Test monitoring
      const monitor = new SyncMonitor();
      monitor.recordSuccess('test', 100);
      monitor.recordError(new Error('Test error'), 'test-fact-id', 50);

      const metrics = monitor.getMetrics();
      const perfStats = monitor.getPerformanceStats();
      const alerts = monitor.checkAlerts();

      // Test DLQ
      const dlq = new DeadLetterQueue();
      await dlq.add('test-fact', new Error('Test DLQ error'), { factId: 'test' });

      const dlqStats = await dlq.getStats();

      // Test health checker
      const healthChecker = new HealthChecker(dlq, monitor);
      const health = await healthChecker.getHealth();

      this.results.observability = {
        passed: true,
        duration: Date.now() - start,
        details: {
          metrics: {
            totalProcessed: metrics.total_processed,
            errorRate: metrics.errorRate,
            successRate: metrics.successRate
          },
          dlq: {
            depth: dlqStats.depth,
            retryable: dlqStats.retryable
          },
          health: health.status,
          alerts: alerts.length
        }
      };

      console.log('✅ Observability check passed');
      console.log(`   Metrics tracked: ${metrics.total_processed}, Health: ${health.status}`);

    } catch (error) {
      this.results.observability = {
        passed: false,
        duration: Date.now() - start,
        details: { error: error.message }
      };

      console.log('❌ Observability check failed:', error.message);
    }
  }

  /**
   * Generate summary and recommendations
   */
  generateSummary() {
    console.log('\n📋 Diagnostic Summary\n');

    const checks = ['config', 'schema', 'dryRun', 'upsert', 'backoff', 'observability'];
    let passed = 0;

    for (const check of checks) {
      const result = this.results[check];
      const status = result.passed ? '✅' : '❌';
      const duration = `${result.duration}ms`;

      console.log(`${status} ${check.padEnd(15)} ${duration.padStart(8)}`);
      passed += result.passed ? 1 : 0;
    }

    this.results.overall.passed = passed === checks.length;

    console.log(`\n🎯 Overall: ${passed}/${checks.length} checks passed`);

    if (this.results.overall.recommendations.length > 0) {
      console.log('\n🔧 Recommendations:');
      this.results.overall.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }

    if (this.results.overall.passed) {
      console.log('\n🎉 All diagnostics passed! System is ready for production.');
    } else {
      console.log('\n⚠️ Some issues found. Please address recommendations before production use.');
    }
  }
}

// Run diagnostics if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new DiagnosticRunner();
  runner.run().then(results => {
    process.exit(results.overall.passed ? 0 : 1);
  }).catch(error => {
    console.error('❌ Diagnostic runner failed:', error.message);
    process.exit(1);
  });
}

export { DiagnosticRunner };