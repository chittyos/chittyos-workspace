#!/usr/bin/env node

/**
 * Automated QA Pipeline
 * Orchestrates comprehensive testing suite execution
 */

import { spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Test suite configuration
 */
const TEST_CONFIG = {
  suites: [
    {
      name: 'QA Functional Tests',
      file: 'test/qa-test-suite.js',
      timeout: 30000,
      parallel: true,
      critical: true
    },
    {
      name: 'Security Validation',
      file: 'test/security-validation.js',
      timeout: 20000,
      parallel: true,
      critical: true
    },
    {
      name: 'Penetration Tests',
      file: 'test/penetration-test.js',
      timeout: 60000,
      parallel: false,
      critical: false,
      requiresServer: true
    },
    {
      name: 'Performance Tests',
      file: 'test/performance-load-test.js',
      timeout: 120000,
      parallel: false,
      critical: true
    },
    {
      name: 'Integration Scenarios',
      file: 'test/integration-scenarios.js',
      timeout: 90000,
      parallel: false,
      critical: true,
      requiresNotionAPI: true
    }
  ],
  reporting: {
    outputDir: 'test-results',
    formats: ['console', 'json', 'junit'],
    includeMetrics: true
  },
  environment: {
    timeout: 300000, // 5 minutes total
    retries: 1,
    failFast: false
  }
};

/**
 * Test result aggregator
 */
class TestResultAggregator {
  constructor() {
    this.results = {
      suites: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        coverage: null
      },
      environment: {
        node: process.version,
        platform: process.platform,
        timestamp: new Date().toISOString(),
        ci: !!process.env.CI
      }
    };
  }

  addSuiteResult(suite, result) {
    this.results.suites.push({
      name: suite.name,
      file: suite.file,
      ...result
    });

    this.results.summary.total += result.stats?.total || 0;
    this.results.summary.passed += result.stats?.passed || 0;
    this.results.summary.failed += result.stats?.failed || 0;
    this.results.summary.skipped += result.stats?.skipped || 0;
    this.results.summary.duration += result.duration || 0;
  }

  generateReport() {
    const { outputDir, formats } = TEST_CONFIG.reporting;

    // Ensure output directory exists
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (error) {
      console.warn(`Warning: Could not create output directory: ${error.message}`);
    }

    // Generate reports in different formats
    if (formats.includes('json')) {
      this.generateJSONReport();
    }

    if (formats.includes('junit')) {
      this.generateJUnitReport();
    }

    if (formats.includes('console')) {
      this.generateConsoleReport();
    }
  }

  generateJSONReport() {
    const reportPath = join(TEST_CONFIG.reporting.outputDir, 'test-results.json');

    try {
      writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
      console.log(`📄 JSON report written to: ${reportPath}`);
    } catch (error) {
      console.error(`Failed to write JSON report: ${error.message}`);
    }
  }

  generateJUnitReport() {
    const reportPath = join(TEST_CONFIG.reporting.outputDir, 'junit.xml');

    const xml = this.generateJUnitXML();

    try {
      writeFileSync(reportPath, xml);
      console.log(`📄 JUnit report written to: ${reportPath}`);
    } catch (error) {
      console.error(`Failed to write JUnit report: ${error.message}`);
    }
  }

  generateJUnitXML() {
    const { summary, suites } = this.results;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<testsuites tests="${summary.total}" failures="${summary.failed}" time="${summary.duration / 1000}">\n`;

    for (const suite of suites) {
      const tests = suite.stats?.total || 0;
      const failures = suite.stats?.failed || 0;
      const time = (suite.duration || 0) / 1000;

      xml += `  <testsuite name="${suite.name}" tests="${tests}" failures="${failures}" time="${time}">\n`;

      if (suite.tests) {
        for (const test of suite.tests) {
          xml += `    <testcase name="${test.name}" time="${(test.duration || 0) / 1000}">`;

          if (test.status === 'failed') {
            xml += `\n      <failure message="${test.error || 'Test failed'}">${test.stack || ''}</failure>\n    `;
          } else if (test.status === 'skipped') {
            xml += `\n      <skipped/>\n    `;
          }

          xml += `</testcase>\n`;
        }
      }

      xml += `  </testsuite>\n`;
    }

    xml += `</testsuites>\n`;
    return xml;
  }

  generateConsoleReport() {
    const { summary, suites } = this.results;

    console.log('\n' + '='.repeat(80));
    console.log('🧪 TEST RESULTS SUMMARY');
    console.log('='.repeat(80));

    // Overall summary
    console.log(`📊 Total Tests: ${summary.total}`);
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`⏭️ Skipped: ${summary.skipped}`);
    console.log(`⏱️ Duration: ${(summary.duration / 1000).toFixed(2)}s`);

    const successRate = summary.total > 0 ? (summary.passed / summary.total * 100) : 0;
    console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);

    // Suite breakdown
    console.log('\n📋 Test Suite Breakdown:');
    for (const suite of suites) {
      const status = suite.success ? '✅' : '❌';
      const duration = (suite.duration || 0) / 1000;
      console.log(`${status} ${suite.name}: ${duration.toFixed(2)}s`);

      if (suite.stats) {
        console.log(`   Tests: ${suite.stats.passed}/${suite.stats.total} passed`);
      }

      if (!suite.success && suite.error) {
        console.log(`   Error: ${suite.error}`);
      }
    }

    // Environment info
    console.log('\n🌍 Environment:');
    console.log(`   Node.js: ${this.results.environment.node}`);
    console.log(`   Platform: ${this.results.environment.platform}`);
    console.log(`   CI: ${this.results.environment.ci ? 'Yes' : 'No'}`);
    console.log(`   Timestamp: ${this.results.environment.timestamp}`);

    console.log('='.repeat(80));

    // Final verdict
    if (summary.failed === 0) {
      console.log('🎉 ALL TESTS PASSED!');
    } else {
      console.log(`⚠️ ${summary.failed} TESTS FAILED`);
    }

    console.log('='.repeat(80) + '\n');
  }
}

/**
 * Test runner orchestrator
 */
class TestRunner {
  constructor() {
    this.aggregator = new TestResultAggregator();
    this.serverProcess = null;
  }

  async run() {
    console.log('🚀 Starting Automated QA Pipeline...\n');

    const startTime = Date.now();

    try {
      // Pre-flight checks
      await this.preflightChecks();

      // Start test server if needed
      if (this.needsTestServer()) {
        await this.startTestServer();
      }

      // Run test suites
      await this.runTestSuites();

      // Generate reports
      this.aggregator.generateReport();

      const totalDuration = Date.now() - startTime;
      console.log(`\n⏱️ Total pipeline duration: ${(totalDuration / 1000).toFixed(2)}s`);

      // Exit with appropriate code
      const failed = this.aggregator.results.summary.failed;
      process.exit(failed > 0 ? 1 : 0);

    } catch (error) {
      console.error('❌ Pipeline failed:', error.message);
      process.exit(1);

    } finally {
      await this.cleanup();
    }
  }

  async preflightChecks() {
    console.log('🔍 Running preflight checks...');

    // Check Node.js version
    const nodeVersion = process.version;
    const requiredVersion = 'v18.0.0';

    if (nodeVersion < requiredVersion) {
      throw new Error(`Node.js ${requiredVersion} or higher required, found ${nodeVersion}`);
    }

    // Check environment variables for integration tests
    const requiredEnvVars = [
      'NOTION_INTEGRATION_TOKEN',
      'NOTION_DATABASE_ID_ATOMIC_FACTS'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      console.warn(`⚠️ Missing environment variables: ${missingVars.join(', ')}`);
      console.warn('   Some integration tests may be skipped');
    }

    console.log('✅ Preflight checks completed');
  }

  needsTestServer() {
    return TEST_CONFIG.suites.some(suite => suite.requiresServer);
  }

  async startTestServer() {
    console.log('🌐 Starting test server...');

    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('node', ['index.js', 'server'], {
        env: { ...process.env, PORT: '3001', NODE_ENV: 'test' },
        stdio: 'pipe'
      });

      let started = false;

      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('running on port') && !started) {
          started = true;
          console.log('✅ Test server started');
          resolve();
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        console.error('Server error:', data.toString());
      });

      this.serverProcess.on('error', (error) => {
        if (!started) {
          reject(new Error(`Failed to start test server: ${error.message}`));
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!started) {
          reject(new Error('Test server failed to start within timeout'));
        }
      }, 10000);
    });
  }

  async runTestSuites() {
    console.log('🧪 Running test suites...\n');

    const { parallel, failFast } = TEST_CONFIG.environment;

    // Separate parallel and sequential suites
    const parallelSuites = TEST_CONFIG.suites.filter(suite => suite.parallel);
    const sequentialSuites = TEST_CONFIG.suites.filter(suite => !suite.parallel);

    // Run parallel suites
    if (parallelSuites.length > 0) {
      console.log('⚡ Running parallel test suites...');

      const parallelPromises = parallelSuites.map(suite => this.runSuite(suite));
      const parallelResults = await Promise.allSettled(parallelPromises);

      for (let i = 0; i < parallelSuites.length; i++) {
        const suite = parallelSuites[i];
        const result = parallelResults[i];

        if (result.status === 'fulfilled') {
          this.aggregator.addSuiteResult(suite, result.value);
        } else {
          this.aggregator.addSuiteResult(suite, {
            success: false,
            error: result.reason.message,
            duration: 0
          });
        }

        // Fail fast check
        if (failFast && !result.value?.success && suite.critical) {
          throw new Error(`Critical test suite failed: ${suite.name}`);
        }
      }
    }

    // Run sequential suites
    if (sequentialSuites.length > 0) {
      console.log('🔄 Running sequential test suites...');

      for (const suite of sequentialSuites) {
        try {
          const result = await this.runSuite(suite);
          this.aggregator.addSuiteResult(suite, result);

          // Fail fast check
          if (failFast && !result.success && suite.critical) {
            throw new Error(`Critical test suite failed: ${suite.name}`);
          }

        } catch (error) {
          this.aggregator.addSuiteResult(suite, {
            success: false,
            error: error.message,
            duration: 0
          });

          if (failFast && suite.critical) {
            throw error;
          }
        }
      }
    }
  }

  async runSuite(suite) {
    console.log(`📝 Running: ${suite.name}`);

    const startTime = Date.now();

    return new Promise((resolve) => {
      // Skip if dependencies not met
      if (suite.requiresNotionAPI && !process.env.NOTION_INTEGRATION_TOKEN) {
        console.log(`⏭️ Skipping ${suite.name} (Notion API not configured)`);
        resolve({
          success: true,
          skipped: true,
          reason: 'Notion API not configured',
          duration: 0
        });
        return;
      }

      const testProcess = spawn('node', ['--test', suite.file], {
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let stdout = '';
      let stderr = '';

      testProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      testProcess.on('close', (code) => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Parse test output for statistics
        const stats = this.parseTestOutput(stdout);

        const result = {
          success: code === 0,
          exitCode: code,
          duration,
          stats,
          output: stdout,
          error: stderr
        };

        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${suite.name}: ${(duration / 1000).toFixed(2)}s`);

        if (stats) {
          console.log(`   Tests: ${stats.passed}/${stats.total} passed`);
        }

        resolve(result);
      });

      testProcess.on('error', (error) => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(`❌ ${suite.name}: Process error`);

        resolve({
          success: false,
          error: error.message,
          duration
        });
      });

      // Set timeout
      if (suite.timeout) {
        setTimeout(() => {
          testProcess.kill('SIGTERM');
          console.log(`⏰ ${suite.name}: Timeout after ${suite.timeout}ms`);
        }, suite.timeout);
      }
    });
  }

  parseTestOutput(output) {
    // Parse Node.js test runner output
    const lines = output.split('\n');

    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const line of lines) {
      if (line.includes('tests ')) {
        // Look for summary line like "✓ test/qa-test-suite.js (15 tests, 15 passed)"
        const match = line.match(/\((\d+) tests?, (\d+) passed/);
        if (match) {
          total = parseInt(match[1]);
          passed = parseInt(match[2]);
          failed = total - passed;
        }
      }
    }

    return total > 0 ? { total, passed, failed, skipped } : null;
  }

  async cleanup() {
    if (this.serverProcess) {
      console.log('🛑 Stopping test server...');
      this.serverProcess.kill('SIGTERM');

      // Wait for graceful shutdown
      await new Promise(resolve => {
        this.serverProcess.on('close', resolve);
        setTimeout(resolve, 5000); // Force after 5 seconds
      });
    }
  }
}

// CLI interface
function printUsage() {
  console.log(`
🧪 Notion Sync QA Pipeline

Usage:
  node test/run-tests.js [options]

Options:
  --suite <name>     Run specific test suite
  --parallel         Run all tests in parallel (faster, less isolation)
  --fail-fast        Stop on first critical failure
  --skip-security    Skip security tests
  --skip-perf        Skip performance tests
  --skip-integration Skip integration tests
  --dry-run          Show what would run without executing
  --help             Show this help

Examples:
  node test/run-tests.js
  node test/run-tests.js --suite "QA Functional Tests"
  node test/run-tests.js --fail-fast --parallel
  node test/run-tests.js --skip-perf --skip-integration
  `);
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    suite: null,
    parallel: false,
    failFast: false,
    skipSecurity: false,
    skipPerf: false,
    skipIntegration: false,
    dryRun: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--suite':
        options.suite = args[++i];
        break;
      case '--parallel':
        options.parallel = true;
        break;
      case '--fail-fast':
        options.failFast = true;
        break;
      case '--skip-security':
        options.skipSecurity = true;
        break;
      case '--skip-perf':
        options.skipPerf = true;
        break;
      case '--skip-integration':
        options.skipIntegration = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        options.help = true;
        break;
    }
  }

  return options;
}

// Apply CLI options
function applyOptions(options) {
  if (options.suite) {
    TEST_CONFIG.suites = TEST_CONFIG.suites.filter(suite =>
      suite.name.toLowerCase().includes(options.suite.toLowerCase())
    );
  }

  if (options.parallel) {
    TEST_CONFIG.suites.forEach(suite => suite.parallel = true);
  }

  if (options.failFast) {
    TEST_CONFIG.environment.failFast = true;
  }

  if (options.skipSecurity) {
    TEST_CONFIG.suites = TEST_CONFIG.suites.filter(suite =>
      !suite.name.toLowerCase().includes('security') &&
      !suite.name.toLowerCase().includes('penetration')
    );
  }

  if (options.skipPerf) {
    TEST_CONFIG.suites = TEST_CONFIG.suites.filter(suite =>
      !suite.name.toLowerCase().includes('performance')
    );
  }

  if (options.skipIntegration) {
    TEST_CONFIG.suites = TEST_CONFIG.suites.filter(suite =>
      !suite.name.toLowerCase().includes('integration')
    );
  }
}

// Main execution
async function main() {
  const options = parseArgs();

  if (options.help) {
    printUsage();
    process.exit(0);
  }

  applyOptions(options);

  if (options.dryRun) {
    console.log('🔍 Dry run - would execute the following test suites:');
    for (const suite of TEST_CONFIG.suites) {
      console.log(`  - ${suite.name} (${suite.file})`);
    }
    process.exit(0);
  }

  const runner = new TestRunner();
  await runner.run();
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Pipeline error:', error.message);
    process.exit(1);
  });
}

export { TestRunner, TestResultAggregator, TEST_CONFIG };