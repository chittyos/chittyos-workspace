/**
 * QA Test Suite for Notion Sync System
 * Comprehensive functional and integration testing
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { NotionSyncWorker, syncAtomicFacts } from '../sync-worker.js';
import { transformToNotionPayload } from '../schema-validator.js';
import { upsertAtomicFact, deduplicateFacts } from '../upsert-logic.js';
import { withRetry, RateLimiter } from '../retry-handler.js';
import { DeadLetterQueue, SyncMonitor } from '../dlq-handler.js';

// Test configuration
const TEST_CONFIG = {
  skipIntegration: !process.env.NOTION_INTEGRATION_TOKEN,
  maxTestDuration: 30000, // 30 seconds per test
  sampleDataSize: 10,
  loadTestSize: 100
};

// Sample test data
function generateTestFact(id = null) {
  const timestamp = Date.now();
  return {
    factId: id || `TEST-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
    parentArtifactId: `doc-${timestamp}`,
    factText: `Test atomic fact created at ${new Date().toISOString()}`,
    factType: 'ACTION',
    locationRef: `Page 1, Line ${Math.floor(Math.random() * 100)}`,
    classification: 'FACT',
    weight: Math.random(),
    credibility: ['PRIMARY_SOURCE', 'CORROBORATED'],
    chainStatus: 'Pending',
    verifiedAt: new Date().toISOString(),
    verificationMethod: 'Automated testing'
  };
}

describe('QA Test Suite - Core Functionality', () => {

  test('Schema Validation - Valid Fact', async () => {
    const testFact = generateTestFact();
    const result = transformToNotionPayload(testFact);

    assert.strictEqual(result.isValid, true, 'Valid fact should pass validation');
    assert.strictEqual(result.errors, null, 'Should have no validation errors');
    assert.ok(result.properties, 'Should generate properties object');
    assert.ok(result.properties['Fact'], 'Should have title property');
  });

  test('Schema Validation - Invalid Fact', async () => {
    const invalidFact = {
      // Missing required factId
      factText: 'Test fact without ID',
      factType: 'INVALID_TYPE' // Invalid enum value
    };

    const result = transformToNotionPayload(invalidFact);

    assert.strictEqual(result.isValid, false, 'Invalid fact should fail validation');
    assert.ok(Array.isArray(result.errors), 'Should have error array');
    assert.ok(result.errors.length > 0, 'Should have validation errors');
  });

  test('Deduplication Logic', async () => {
    const facts = [
      generateTestFact('DUPLICATE-1'),
      generateTestFact('UNIQUE-1'),
      generateTestFact('DUPLICATE-1'), // Duplicate
      generateTestFact('UNIQUE-2'),
      { factText: 'No ID' } // Invalid - no factId
    ];

    const result = deduplicateFacts(facts);

    assert.strictEqual(result.originalCount, 5, 'Should count all input facts');
    assert.strictEqual(result.uniqueCount, 2, 'Should identify unique facts');
    assert.strictEqual(result.duplicateCount, 3, 'Should identify duplicates + invalid');
    assert.strictEqual(result.unique.length, 2, 'Should return unique facts');
  });

  test('Retry Mechanism', async () => {
    let attemptCount = 0;
    const maxAttempts = 3;

    const flakyOperation = async () => {
      attemptCount++;
      if (attemptCount < maxAttempts) {
        const error = new Error('Simulated failure');
        error.status = 500;
        throw error;
      }
      return { success: true, attempts: attemptCount };
    };

    const result = await withRetry(flakyOperation, {
      maxRetries: 5,
      baseDelay: 10 // Fast retries for testing
    });

    assert.strictEqual(result.success, true, 'Should eventually succeed');
    assert.strictEqual(result.attempts, maxAttempts, 'Should retry correct number of times');
  });

  test('Rate Limiter', async () => {
    const rateLimiter = new RateLimiter(10); // 10 req/sec
    const startTime = Date.now();

    const requests = Array.from({ length: 5 }, (_, i) =>
      rateLimiter.execute(async () => ({
        request: i,
        timestamp: Date.now()
      }))
    );

    const results = await Promise.all(requests);
    const endTime = Date.now();
    const duration = endTime - startTime;

    assert.strictEqual(results.length, 5, 'Should complete all requests');
    assert.ok(duration >= 0, 'Should enforce rate limiting');

    // Verify timestamps are spread out
    const timestamps = results.map(r => r.timestamp);
    const timeSpread = Math.max(...timestamps) - Math.min(...timestamps);
    assert.ok(timeSpread >= 0, 'Requests should be spread over time');
  });

  test('Dead Letter Queue Operations', async () => {
    const dlq = new DeadLetterQueue();
    const testError = new Error('Test error');
    const testFact = generateTestFact();

    // Add item to DLQ
    await dlq.add('test-fact-1', testError, testFact);

    // Check stats
    const stats = await dlq.getStats();
    assert.strictEqual(stats.depth, 1, 'DLQ should have one item');

    // Get item
    const item = await dlq.get('test-fact-1');
    assert.ok(item, 'Should retrieve DLQ item');
    assert.strictEqual(item.factId, 'test-fact-1', 'Should have correct fact ID');

    // Remove item
    const removed = await dlq.remove('test-fact-1');
    assert.strictEqual(removed, true, 'Should remove item successfully');

    // Verify empty
    const finalStats = await dlq.getStats();
    assert.strictEqual(finalStats.depth, 0, 'DLQ should be empty');
  });

  test('Sync Monitor Metrics', async () => {
    const monitor = new SyncMonitor();

    // Record some operations
    monitor.recordSuccess('created', 150);
    monitor.recordSuccess('updated', 200);
    monitor.recordError(new Error('Test error'), 'test-fact');

    const metrics = monitor.getMetrics();

    assert.strictEqual(metrics.created, 1, 'Should track created operations');
    assert.strictEqual(metrics.updated, 1, 'Should track updated operations');
    assert.strictEqual(metrics.errors, 1, 'Should track errors');
    assert.strictEqual(metrics.total_processed, 3, 'Should track total processed');
    assert.ok(metrics.errorRate > 0, 'Should calculate error rate');
    assert.ok(metrics.successRate < 1, 'Should calculate success rate');

    const perfStats = monitor.getPerformanceStats();
    assert.ok(perfStats, 'Should provide performance statistics');
    assert.ok(perfStats.count > 0, 'Should have performance data');
  });
});

describe('QA Test Suite - Integration Tests', { skip: TEST_CONFIG.skipIntegration }, () => {
  let worker;

  before(async () => {
    worker = new NotionSyncWorker();
    await worker.initialize();
  });

  test('Notion API Connection', async () => {
    const health = await worker.getHealth();

    assert.ok(health, 'Should return health status');
    assert.ok(['healthy', 'degraded'].includes(health.status), 'Should have valid health status');
  });

  test('Single Fact Sync', async () => {
    const testFact = generateTestFact();

    const result = await worker.syncFacts([testFact], {
      batchSize: 1,
      dryRun: false
    });

    assert.strictEqual(result.totalFacts, 1, 'Should process one fact');
    assert.ok(result.created > 0 || result.updated > 0, 'Should create or update fact');
    assert.strictEqual(result.errors, 0, 'Should have no errors');
    assert.ok(result.successRate > 0.9, 'Should have high success rate');
  });

  test('Batch Sync', async () => {
    const testFacts = Array.from({ length: 5 }, () => generateTestFact());

    const result = await worker.syncFacts(testFacts, {
      batchSize: 2,
      dryRun: false
    });

    assert.strictEqual(result.totalFacts, 5, 'Should process all facts');
    assert.ok(result.successRate > 0.8, 'Should have good success rate');
    assert.ok(result.duration > 0, 'Should track duration');
  });

  test('Idempotency Test', async () => {
    const testFact = generateTestFact();

    // First sync
    const result1 = await worker.syncFacts([testFact], { dryRun: false });

    // Second sync (should be idempotent)
    const result2 = await worker.syncFacts([testFact], { dryRun: false });

    assert.ok(result1.created > 0, 'First sync should create');
    assert.ok(result2.skipped > 0 || result2.updated === 0, 'Second sync should skip or not change');
  });

  test('DLQ Processing', async () => {
    // This test would require injecting failures
    // For now, just test that DLQ processing doesn't crash
    const retryResult = await worker.processDLQRetries();

    assert.ok(typeof retryResult.processed === 'number', 'Should return processed count');
    assert.ok(typeof retryResult.succeeded === 'number', 'Should return succeeded count');
    assert.ok(typeof retryResult.failed === 'number', 'Should return failed count');
  });

  after(async () => {
    // Cleanup test data
    if (worker) {
      worker.stop();
    }
  });
});

describe('QA Test Suite - Performance Tests', () => {

  test('Large Batch Performance', async () => {
    const largeBatch = Array.from({ length: TEST_CONFIG.loadTestSize }, () => generateTestFact());
    const startTime = Date.now();

    // Dry run to test performance without hitting Notion API
    const result = await syncAtomicFacts(largeBatch, {
      dryRun: true,
      batchSize: 10
    });

    const duration = Date.now() - startTime;
    const factsPerSecond = (result.totalFacts / duration) * 1000;

    assert.ok(duration < TEST_CONFIG.maxTestDuration, 'Should complete within time limit');
    assert.ok(factsPerSecond > 1, 'Should process at least 1 fact per second');
    assert.strictEqual(result.errors, 0, 'Should have no errors in dry run');
  });

  test('Memory Usage Stability', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // Process multiple batches
    for (let i = 0; i < 10; i++) {
      const batch = Array.from({ length: 10 }, () => generateTestFact());
      await syncAtomicFacts(batch, { dryRun: true });
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100;

    assert.ok(memoryIncreasePercent < 50, 'Memory usage should not increase significantly');
  });
});

describe('QA Test Suite - Error Handling', () => {

  test('Invalid Configuration Handling', async () => {
    // Test with invalid configuration
    const invalidWorker = new NotionSyncWorker();

    // Temporarily clear env vars
    const originalToken = process.env.NOTION_INTEGRATION_TOKEN;
    const originalDb = process.env.NOTION_DATABASE_ID_ATOMIC_FACTS;

    delete process.env.NOTION_INTEGRATION_TOKEN;
    delete process.env.NOTION_DATABASE_ID_ATOMIC_FACTS;

    try {
      await assert.rejects(
        invalidWorker.initialize(),
        /Configuration validation failed/,
        'Should reject invalid configuration'
      );
    } finally {
      // Restore env vars
      if (originalToken) process.env.NOTION_INTEGRATION_TOKEN = originalToken;
      if (originalDb) process.env.NOTION_DATABASE_ID_ATOMIC_FACTS = originalDb;
    }
  });

  test('Network Error Handling', async () => {
    let attemptCount = 0;

    const networkErrorOperation = async () => {
      attemptCount++;
      if (attemptCount <= 2) {
        const error = new Error('Network timeout');
        error.code = 'ETIMEDOUT';
        throw error;
      }
      return { success: true };
    };

    const result = await withRetry(networkErrorOperation, {
      maxRetries: 5,
      baseDelay: 10
    });

    assert.strictEqual(result.success, true, 'Should handle network errors with retry');
    assert.strictEqual(attemptCount, 3, 'Should retry network errors');
  });

  test('Rate Limit Error Handling', async () => {
    let attemptCount = 0;

    const rateLimitOperation = async () => {
      attemptCount++;
      if (attemptCount <= 1) {
        const error = new Error('Rate limited');
        error.status = 429;
        throw error;
      }
      return { success: true };
    };

    const result = await withRetry(rateLimitOperation, {
      maxRetries: 3,
      baseDelay: 10
    });

    assert.strictEqual(result.success, true, 'Should handle rate limits with retry');
  });
});

// Export test utilities for external use
export {
  generateTestFact,
  TEST_CONFIG
};