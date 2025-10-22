/**
 * Performance and Load Testing Suite
 * Comprehensive performance validation for production readiness
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { performance } from 'perf_hooks';
import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';

// Import system components
import { NotionSyncWorker, syncAtomicFacts } from '../sync-worker.js';
import { batchUpsertFacts, deduplicateFacts } from '../upsert-logic.js';
import { RateLimiter, withRetry } from '../retry-handler.js';
import { DeadLetterQueue, SyncMonitor } from '../dlq-handler.js';
import { generateTestFact } from './qa-test-suite.js';

/**
 * Performance test configuration
 */
const PERF_CONFIG = {
  load: {
    lightLoad: 100,        // Light load: 100 facts
    mediumLoad: 1000,      // Medium load: 1,000 facts
    heavyLoad: 10000,      // Heavy load: 10,000 facts
    stressLoad: 50000      // Stress load: 50,000 facts
  },
  timing: {
    maxProcessingTime: 30000,     // 30 seconds
    maxP99Latency: 5000,          // 5 seconds
    maxMemoryGrowth: 100,         // 100MB
    minThroughput: 10             // 10 facts/second
  },
  concurrency: {
    maxWorkers: 4,
    maxConcurrentRequests: 50,
    maxBatchSize: 100
  },
  monitoring: {
    sampleInterval: 1000,         // 1 second
    memoryCheckInterval: 5000,    // 5 seconds
    gcForceInterval: 10000        // 10 seconds
  }
};

/**
 * Performance monitoring utilities
 */
class PerformanceMonitor extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      startTime: 0,
      endTime: 0,
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      memorySnapshots: [],
      latencyMeasurements: [],
      throughputMeasurements: []
    };
    this.isMonitoring = false;
    this.intervalId = null;
  }

  start() {
    this.metrics.startTime = performance.now();
    this.isMonitoring = true;
    this.startMemoryMonitoring();
    this.emit('started');
  }

  stop() {
    this.metrics.endTime = performance.now();
    this.isMonitoring = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.emit('stopped');
  }

  recordOperation(success, latency) {
    this.metrics.totalOperations++;
    if (success) {
      this.metrics.successfulOperations++;
    } else {
      this.metrics.failedOperations++;
    }

    if (latency) {
      this.metrics.latencyMeasurements.push(latency);
    }
  }

  startMemoryMonitoring() {
    this.intervalId = setInterval(() => {
      if (!this.isMonitoring) return;

      const memUsage = process.memoryUsage();
      this.metrics.memorySnapshots.push({
        timestamp: performance.now(),
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      });

      // Calculate throughput
      const timeWindow = 5000; // 5 seconds
      const recentOps = this.getRecentOperations(timeWindow);
      const throughput = (recentOps / timeWindow) * 1000; // ops/second
      this.metrics.throughputMeasurements.push({
        timestamp: performance.now(),
        throughput
      });

    }, PERF_CONFIG.monitoring.sampleInterval);
  }

  getRecentOperations(timeWindow) {
    // This is a simplified calculation
    // In a real implementation, you'd track operation timestamps
    return Math.min(this.metrics.totalOperations, 50);
  }

  getResults() {
    const duration = this.metrics.endTime - this.metrics.startTime;
    const avgThroughput = this.metrics.totalOperations / (duration / 1000);

    const memoryGrowth = this.metrics.memorySnapshots.length > 0 ?
      this.metrics.memorySnapshots[this.metrics.memorySnapshots.length - 1].heapUsed -
      this.metrics.memorySnapshots[0].heapUsed : 0;

    const latencies = this.metrics.latencyMeasurements.sort((a, b) => a - b);
    const latencyStats = latencies.length > 0 ? {
      min: latencies[0],
      max: latencies[latencies.length - 1],
      avg: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p50: this.getPercentile(latencies, 0.5),
      p95: this.getPercentile(latencies, 0.95),
      p99: this.getPercentile(latencies, 0.99)
    } : null;

    return {
      duration,
      totalOperations: this.metrics.totalOperations,
      successRate: this.metrics.successfulOperations / this.metrics.totalOperations,
      avgThroughput,
      memoryGrowthMB: memoryGrowth / 1024 / 1024,
      latencyStats,
      memorySnapshots: this.metrics.memorySnapshots,
      throughputMeasurements: this.metrics.throughputMeasurements
    };
  }

  getPercentile(sortedArray, percentile) {
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[index];
  }
}

/**
 * Load generator for concurrent testing
 */
class LoadGenerator {
  constructor(workerCount = PERF_CONFIG.concurrency.maxWorkers) {
    this.workerCount = workerCount;
    this.workers = [];
    this.results = [];
  }

  async generateLoad(factCount, concurrency = 10) {
    const facts = Array.from({ length: factCount }, () => generateTestFact());
    const batches = this.chunkArray(facts, Math.ceil(factCount / concurrency));

    const promises = batches.map(async (batch, index) => {
      const startTime = performance.now();

      try {
        const result = await syncAtomicFacts(batch, {
          dryRun: true, // Use dry run for load testing
          batchSize: Math.min(batch.length, PERF_CONFIG.concurrency.maxBatchSize)
        });

        const endTime = performance.now();
        const duration = endTime - startTime;

        return {
          batchIndex: index,
          batchSize: batch.length,
          duration,
          success: true,
          result
        };

      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        return {
          batchIndex: index,
          batchSize: batch.length,
          duration,
          success: false,
          error: error.message
        };
      }
    });

    return Promise.all(promises);
  }

  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  async generateConcurrentRequests(requestCount, requestFn) {
    const requests = Array.from({ length: requestCount }, async (_, index) => {
      const startTime = performance.now();

      try {
        const result = await requestFn(index);
        const endTime = performance.now();

        return {
          requestIndex: index,
          duration: endTime - startTime,
          success: true,
          result
        };

      } catch (error) {
        const endTime = performance.now();

        return {
          requestIndex: index,
          duration: endTime - startTime,
          success: false,
          error: error.message
        };
      }
    });

    return Promise.all(requests);
  }
}

describe('Performance Tests - Basic Operations', () => {

  test('Single Fact Processing Performance', async () => {
    const monitor = new PerformanceMonitor();
    const fact = generateTestFact();

    monitor.start();

    const startTime = performance.now();
    const result = await syncAtomicFacts([fact], { dryRun: true });
    const endTime = performance.now();

    monitor.stop();

    const duration = endTime - startTime;
    const results = monitor.getResults();

    assert.ok(duration < 1000, 'Single fact should process in under 1 second');
    assert.strictEqual(result.totalFacts, 1, 'Should process exactly one fact');
    assert.ok(results.memoryGrowthMB < 10, 'Memory growth should be minimal');
  });

  test('Batch Processing Performance', async () => {
    const batchSizes = [10, 50, 100, 500];

    for (const batchSize of batchSizes) {
      const facts = Array.from({ length: batchSize }, () => generateTestFact());
      const monitor = new PerformanceMonitor();

      monitor.start();
      const startTime = performance.now();

      const result = await syncAtomicFacts(facts, {
        dryRun: true,
        batchSize: Math.min(batchSize, 50)
      });

      const endTime = performance.now();
      monitor.stop();

      const duration = endTime - startTime;
      const throughput = batchSize / (duration / 1000);
      const results = monitor.getResults();

      assert.ok(duration < PERF_CONFIG.timing.maxProcessingTime,
        `Batch of ${batchSize} should complete within time limit`);

      assert.ok(throughput >= PERF_CONFIG.timing.minThroughput,
        `Throughput should meet minimum: ${throughput} facts/sec`);

      assert.strictEqual(result.totalFacts, batchSize,
        `Should process all ${batchSize} facts`);

      console.log(`Batch ${batchSize}: ${duration.toFixed(2)}ms, ${throughput.toFixed(2)} facts/sec`);
    }
  });

  test('Deduplication Performance', async () => {
    const factCount = 1000;
    const duplicateCount = 200;

    // Create facts with some duplicates
    const uniqueFacts = Array.from({ length: factCount - duplicateCount }, () => generateTestFact());
    const duplicateFacts = Array.from({ length: duplicateCount }, () => uniqueFacts[0]);
    const allFacts = [...uniqueFacts, ...duplicateFacts];

    const startTime = performance.now();
    const result = deduplicateFacts(allFacts);
    const endTime = performance.now();

    const duration = endTime - startTime;

    assert.ok(duration < 5000, 'Deduplication should complete in under 5 seconds');
    assert.strictEqual(result.uniqueCount, factCount - duplicateCount,
      'Should identify correct number of unique facts');
    assert.strictEqual(result.duplicateCount, duplicateCount,
      'Should identify correct number of duplicates');

    console.log(`Deduplication: ${duration.toFixed(2)}ms for ${factCount} facts`);
  });

  test('Retry Mechanism Performance', async () => {
    let attemptCount = 0;
    const maxAttempts = 3;

    const flakyOperation = async () => {
      attemptCount++;
      if (attemptCount < maxAttempts) {
        const error = new Error('Simulated failure');
        error.status = 500;
        throw error;
      }
      return { success: true };
    };

    const startTime = performance.now();

    const result = await withRetry(flakyOperation, {
      maxRetries: 5,
      baseDelay: 10 // Fast retries for testing
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    assert.ok(duration < 1000, 'Retry mechanism should be fast');
    assert.strictEqual(result.success, true, 'Should eventually succeed');

    console.log(`Retry mechanism: ${duration.toFixed(2)}ms for ${maxAttempts} attempts`);
  });
});

describe('Performance Tests - Load Testing', () => {

  test('Light Load Test', async () => {
    const loadGenerator = new LoadGenerator();
    const monitor = new PerformanceMonitor();

    monitor.start();

    const results = await loadGenerator.generateLoad(
      PERF_CONFIG.load.lightLoad,
      5 // 5 concurrent batches
    );

    monitor.stop();

    const perfResults = monitor.getResults();
    const successfulBatches = results.filter(r => r.success).length;
    const totalDuration = Math.max(...results.map(r => r.duration));

    assert.strictEqual(successfulBatches, results.length,
      'All batches should succeed under light load');

    assert.ok(totalDuration < PERF_CONFIG.timing.maxProcessingTime,
      'Light load should complete within time limit');

    assert.ok(perfResults.memoryGrowthMB < PERF_CONFIG.timing.maxMemoryGrowth,
      'Memory growth should be acceptable');

    console.log(`Light load: ${successfulBatches}/${results.length} batches, ${totalDuration.toFixed(2)}ms`);
  });

  test('Medium Load Test', async () => {
    const loadGenerator = new LoadGenerator();
    const monitor = new PerformanceMonitor();

    monitor.start();

    const results = await loadGenerator.generateLoad(
      PERF_CONFIG.load.mediumLoad,
      10 // 10 concurrent batches
    );

    monitor.stop();

    const perfResults = monitor.getResults();
    const successfulBatches = results.filter(r => r.success).length;
    const successRate = successfulBatches / results.length;

    assert.ok(successRate >= 0.95,
      'At least 95% of batches should succeed under medium load');

    assert.ok(perfResults.avgThroughput >= PERF_CONFIG.timing.minThroughput,
      `Average throughput should meet minimum: ${perfResults.avgThroughput} facts/sec`);

    console.log(`Medium load: ${successfulBatches}/${results.length} batches, ${perfResults.avgThroughput.toFixed(2)} facts/sec`);
  });

  test('Heavy Load Test', { timeout: 60000 }, async () => {
    const loadGenerator = new LoadGenerator();
    const monitor = new PerformanceMonitor();

    monitor.start();

    const results = await loadGenerator.generateLoad(
      PERF_CONFIG.load.heavyLoad,
      20 // 20 concurrent batches
    );

    monitor.stop();

    const perfResults = monitor.getResults();
    const successfulBatches = results.filter(r => r.success).length;
    const successRate = successfulBatches / results.length;

    assert.ok(successRate >= 0.90,
      'At least 90% of batches should succeed under heavy load');

    assert.ok(perfResults.latencyStats.p99 < PERF_CONFIG.timing.maxP99Latency,
      `P99 latency should be acceptable: ${perfResults.latencyStats.p99}ms`);

    console.log(`Heavy load: ${successfulBatches}/${results.length} batches, P99: ${perfResults.latencyStats.p99.toFixed(2)}ms`);
  });

  test('Concurrent Request Handling', async () => {
    const loadGenerator = new LoadGenerator();
    const concurrentRequests = PERF_CONFIG.concurrency.maxConcurrentRequests;

    const requestFn = async (index) => {
      const fact = generateTestFact(`concurrent-${index}`);
      return await syncAtomicFacts([fact], { dryRun: true });
    };

    const startTime = performance.now();

    const results = await loadGenerator.generateConcurrentRequests(
      concurrentRequests,
      requestFn
    );

    const endTime = performance.now();
    const totalDuration = endTime - startTime;

    const successfulRequests = results.filter(r => r.success).length;
    const successRate = successfulRequests / results.length;

    assert.ok(successRate >= 0.95,
      'At least 95% of concurrent requests should succeed');

    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

    assert.ok(avgDuration < 5000,
      'Average request duration should be reasonable');

    console.log(`Concurrent requests: ${successfulRequests}/${results.length}, avg: ${avgDuration.toFixed(2)}ms`);
  });
});

describe('Performance Tests - Memory and Resource Usage', () => {

  test('Memory Leak Detection', async () => {
    const iterations = 10;
    const factsPerIteration = 100;
    const memorySnapshots = [];

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Initial memory measurement
    memorySnapshots.push(process.memoryUsage().heapUsed);

    for (let i = 0; i < iterations; i++) {
      const facts = Array.from({ length: factsPerIteration }, () => generateTestFact());

      await syncAtomicFacts(facts, { dryRun: true });

      // Force GC between iterations
      if (global.gc) {
        global.gc();
      }

      // Small delay to allow GC
      await new Promise(resolve => setTimeout(resolve, 100));

      memorySnapshots.push(process.memoryUsage().heapUsed);
    }

    // Calculate memory growth
    const initialMemory = memorySnapshots[0];
    const finalMemory = memorySnapshots[memorySnapshots.length - 1];
    const memoryGrowth = finalMemory - initialMemory;
    const memoryGrowthMB = memoryGrowth / 1024 / 1024;

    assert.ok(memoryGrowthMB < PERF_CONFIG.timing.maxMemoryGrowth,
      `Memory growth should be under ${PERF_CONFIG.timing.maxMemoryGrowth}MB, actual: ${memoryGrowthMB.toFixed(2)}MB`);

    console.log(`Memory growth: ${memoryGrowthMB.toFixed(2)}MB over ${iterations} iterations`);
  });

  test('Rate Limiter Performance', async () => {
    const rateLimiter = new RateLimiter(100); // 100 req/sec
    const requestCount = 500;
    const requests = [];

    const startTime = performance.now();

    for (let i = 0; i < requestCount; i++) {
      requests.push(rateLimiter.execute(async () => {
        return { request: i, timestamp: performance.now() };
      }));
    }

    const results = await Promise.all(requests);
    const endTime = performance.now();

    const totalDuration = endTime - startTime;
    const actualRate = (requestCount / totalDuration) * 1000;

    assert.ok(actualRate <= 120, 'Actual rate should respect rate limit (with some tolerance)');
    assert.strictEqual(results.length, requestCount, 'All requests should complete');

    console.log(`Rate limiter: ${actualRate.toFixed(2)} req/sec (limit: 100 req/sec)`);
  });

  test('DLQ Performance Under Load', async () => {
    const dlq = new DeadLetterQueue();
    const itemCount = 1000;
    const errors = [];

    const startTime = performance.now();

    // Add many items to DLQ
    for (let i = 0; i < itemCount; i++) {
      await dlq.add(`fact-${i}`, new Error(`Error ${i}`), generateTestFact(`fact-${i}`));
    }

    const addTime = performance.now();

    // Get stats
    const stats = await dlq.getStats();

    const statsTime = performance.now();

    // Remove all items
    for (let i = 0; i < itemCount; i++) {
      await dlq.remove(`fact-${i}`);
    }

    const removeTime = performance.now();

    const addDuration = addTime - startTime;
    const statsDuration = statsTime - addTime;
    const removeDuration = removeTime - statsTime;

    assert.strictEqual(stats.depth, itemCount, 'Should track all items');
    assert.ok(addDuration < 5000, 'Adding items should be fast');
    assert.ok(statsDuration < 1000, 'Getting stats should be fast');
    assert.ok(removeDuration < 5000, 'Removing items should be fast');

    console.log(`DLQ performance: add ${addDuration.toFixed(2)}ms, stats ${statsDuration.toFixed(2)}ms, remove ${removeDuration.toFixed(2)}ms`);
  });
});

describe('Performance Tests - Stress Testing', () => {

  test('Stress Test - System Limits', { timeout: 120000 }, async () => {
    const monitor = new SyncMonitor();
    const startTime = performance.now();

    try {
      // Generate large dataset
      const facts = Array.from({ length: PERF_CONFIG.load.stressLoad }, (_, i) =>
        generateTestFact(`stress-${i}`)
      );

      // Process in chunks to avoid overwhelming the system
      const chunkSize = 1000;
      let processedCount = 0;

      for (let i = 0; i < facts.length; i += chunkSize) {
        const chunk = facts.slice(i, i + chunkSize);

        const chunkStart = performance.now();

        const result = await syncAtomicFacts(chunk, {
          dryRun: true,
          batchSize: 100
        });

        const chunkEnd = performance.now();

        processedCount += result.totalFacts;

        monitor.recordSuccess('batch', chunkEnd - chunkStart);

        // Small delay between chunks
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      assert.strictEqual(processedCount, PERF_CONFIG.load.stressLoad,
        'Should process all facts under stress');

      assert.ok(totalDuration < 120000, 'Stress test should complete within 2 minutes');

      const throughput = (processedCount / totalDuration) * 1000;

      console.log(`Stress test: ${processedCount} facts in ${totalDuration.toFixed(2)}ms, ${throughput.toFixed(2)} facts/sec`);

    } catch (error) {
      assert.fail(`Stress test failed: ${error.message}`);
    }
  });

  test('Recovery After Stress', async () => {
    // Small load after stress test to verify system recovery
    const facts = Array.from({ length: 10 }, () => generateTestFact());

    const startTime = performance.now();
    const result = await syncAtomicFacts(facts, { dryRun: true });
    const endTime = performance.now();

    const duration = endTime - startTime;

    assert.ok(duration < 1000, 'System should recover quickly after stress');
    assert.strictEqual(result.totalFacts, 10, 'Should process all facts correctly');

    console.log(`Recovery test: ${duration.toFixed(2)}ms for 10 facts`);
  });
});

// Export performance utilities
export {
  PerformanceMonitor,
  LoadGenerator,
  PERF_CONFIG
};