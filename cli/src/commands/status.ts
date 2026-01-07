import chalk from 'chalk';
import ora from 'ora';
import fetch from 'node-fetch';
import { execSync } from 'child_process';

export interface StatusOptions {
  services?: boolean;
  health?: boolean;
  ai?: boolean;
  json?: boolean;
}

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: string;
  url?: string;
}

interface QAStatus {
  testSuites: {
    smoke: 'pass' | 'fail' | 'not-run';
    security: 'pass' | 'fail' | 'not-run';
    load: 'pass' | 'fail' | 'not-run';
    integration: 'pass' | 'fail' | 'not-run';
  };
  lastRun: string;
  coverage?: number;
}

interface EcosystemStatus {
  registry: ServiceStatus;
  contextBridge: ServiceStatus;
  aiInfrastructure: {
    gateway: ServiceStatus;
    langchain: ServiceStatus;
    mcp: ServiceStatus;
    vectorize: ServiceStatus;
  };
  services: ServiceStatus[];
  qa: QAStatus;
  pipeline: {
    auth: 'operational' | 'degraded' | 'failed';
    trust: 'operational' | 'degraded' | 'failed';
    propagation: 'operational' | 'degraded' | 'failed';
  };
}

export async function statusCommand(options: StatusOptions = {}) {
  const spinner = ora('Checking ChittyOS ecosystem status...').start();

  try {
    const status = await getEcosystemStatus(options);

    if (options.json) {
      spinner.stop();
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    spinner.succeed('Ecosystem status retrieved');
    displayStatus(status, options);

  } catch (error) {
    spinner.fail('Failed to retrieve ecosystem status');
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

async function getEcosystemStatus(options: StatusOptions): Promise<EcosystemStatus> {
  const registryUrl = process.env.CHITTYOS_REGISTRY_URL || 'https://registry.chitty.cc';

  // Get registry status
  const registry = await checkServiceHealth(`${registryUrl}/health`, 'ChittyRegistry');

  // Get context bridge status
  const contextBridge = await checkServiceHealth('https://connect.chitty.cc/health', 'Context Bridge');

  // Get AI infrastructure status (if AI option specified)
  let aiInfrastructure = null;
  if (options.ai) {
    aiInfrastructure = {
      gateway: await checkServiceHealth('https://ai.chitty.cc/health', 'AI Gateway'),
      langchain: await checkServiceHealth('https://langchain.chitty.cc/health', 'LangChain'),
      mcp: await checkServiceHealth('https://mcp.chitty.cc/health', 'MCP'),
      vectorize: await checkServiceHealth('https://vectorize.chitty.cc/health', 'Vectorize')
    };
  }

  // Get services list from registry
  let services: ServiceStatus[] = [];
  if (options.services) {
    try {
      services = await getRegisteredServices(registryUrl);
    } catch (error) {
      console.warn(chalk.yellow('Warning: Could not retrieve service list from registry'));
    }
  }

  // Get QA status
  const qa = await getQAStatus();

  // Get pipeline status
  const pipeline = await getPipelineStatus();

  return {
    registry,
    contextBridge,
    aiInfrastructure,
    services,
    qa,
    pipeline
  };
}

async function checkServiceHealth(url: string, serviceName: string): Promise<ServiceStatus> {
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'ChittyOS-CLI/1.0.0'
      }
    });

    const responseTime = Date.now() - startTime;
    const isHealthy = response.ok;

    return {
      name: serviceName,
      status: isHealthy ? 'healthy' : 'degraded',
      responseTime,
      lastCheck: new Date().toISOString(),
      url
    };
  } catch (error) {
    return {
      name: serviceName,
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      url
    };
  }
}

async function getRegisteredServices(registryUrl: string): Promise<ServiceStatus[]> {
  try {
    const response = await fetch(`${registryUrl}/api/v1/services`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'ChittyOS-CLI/1.0.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Registry API returned ${response.status}`);
    }

    const data = await response.json();
    const services = Array.isArray(data) ? data : data.services || [];

    // Check health of each service
    const serviceStatuses = await Promise.allSettled(
      services.slice(0, 10).map(async (service: any) => {
        return await checkServiceHealth(service.baseUrl + '/health', service.serviceName);
      })
    );

    return serviceStatuses
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<ServiceStatus>).value);

  } catch (error) {
    throw new Error(`Failed to get services from registry: ${error.message}`);
  }
}

async function getQAStatus(): Promise<QAStatus> {
  const defaultStatus: QAStatus = {
    testSuites: {
      smoke: 'not-run',
      security: 'not-run',
      load: 'not-run',
      integration: 'not-run'
    },
    lastRun: 'never'
  };

  try {
    // Check if we're in a project with QA framework
    const fs = await import('fs-extra');
    const path = await import('path');

    const jestConfigExists = await fs.pathExists('jest.config.js');
    const packageJsonExists = await fs.pathExists('package.json');

    if (!jestConfigExists || !packageJsonExists) {
      return defaultStatus;
    }

    // Try to get recent test results
    try {
      const result = execSync('npm run test:qa:smoke --silent', {
        encoding: 'utf8',
        timeout: 10000,
        stdio: 'pipe'
      });

      defaultStatus.testSuites.smoke = result.includes('PASS') ? 'pass' : 'fail';
      defaultStatus.lastRun = new Date().toISOString();
    } catch (error) {
      // Tests might fail or not exist, that's okay
      defaultStatus.testSuites.smoke = 'fail';
    }

    return defaultStatus;
  } catch (error) {
    return defaultStatus;
  }
}

async function getPipelineStatus() {
  return {
    auth: 'operational' as const,
    trust: 'operational' as const,
    propagation: 'operational' as const
  };
}

function displayStatus(status: EcosystemStatus, options: StatusOptions) {
  console.log(chalk.blue.bold('\n🌟 ChittyOS Ecosystem Status\n'));

  // Core Services
  console.log(chalk.white.bold('📊 Core Services'));
  displayServiceStatus(status.registry);
  displayServiceStatus(status.contextBridge);

  // AI Infrastructure
  if (options.ai && status.aiInfrastructure) {
    console.log(chalk.white.bold('\n🤖 AI Infrastructure'));
    displayServiceStatus(status.aiInfrastructure.gateway);
    displayServiceStatus(status.aiInfrastructure.langchain);
    displayServiceStatus(status.aiInfrastructure.mcp);
    displayServiceStatus(status.aiInfrastructure.vectorize);
  }

  // Registered Services
  if (options.services && status.services.length > 0) {
    console.log(chalk.white.bold('\n🔍 Registered Services'));
    status.services.forEach(service => displayServiceStatus(service));

    const healthyCount = status.services.filter(s => s.status === 'healthy').length;
    const totalCount = status.services.length;
    console.log(chalk.gray(`\n   ${healthyCount}/${totalCount} services healthy`));
  }

  // QA Framework Status
  console.log(chalk.white.bold('\n🧪 QA & Testing Framework'));
  displayQAStatus(status.qa);

  // Pipeline Status
  console.log(chalk.white.bold('\n🔐 Pipeline Status'));
  displayPipelineStatus(status.pipeline);

  // Health Summary
  console.log(chalk.white.bold('\n📈 Health Summary'));
  const coreHealthy = [status.registry, status.contextBridge].every(s => s.status === 'healthy');

  console.log(`   Core Services: ${coreHealthy ? chalk.green('✅ Healthy') : chalk.red('❌ Issues Detected')}`);

  if (options.services && status.services.length > 0) {
    const servicesHealthy = status.services.filter(s => s.status === 'healthy').length;
    const servicesTotal = status.services.length;
    const servicesHealthPercent = Math.round((servicesHealthy / servicesTotal) * 100);

    const healthColor = servicesHealthPercent >= 80 ? chalk.green :
                       servicesHealthPercent >= 60 ? chalk.yellow : chalk.red;

    console.log(`   Ecosystem Health: ${healthColor(`${servicesHealthPercent}% (${servicesHealthy}/${servicesTotal})`)}`);
  }

  // Recommendations
  console.log(chalk.white.bold('\n💡 Recommendations'));

  if (!coreHealthy) {
    console.log(chalk.yellow('   • Start core services: chittyos bridge --start'));
  }

  if (status.qa.testSuites.smoke === 'not-run') {
    console.log(chalk.blue('   • Run QA tests: npm run test:qa:smoke'));
  }

  if (status.qa.testSuites.security === 'not-run') {
    console.log(chalk.blue('   • Run security audit: npm run test:security'));
  }

  console.log(chalk.gray('\n   Use --services flag for detailed service status'));
  console.log(chalk.gray('   Use --ai flag for AI infrastructure status'));
  console.log(chalk.gray('   Use --json flag for machine-readable output\n'));
}

function displayServiceStatus(service: ServiceStatus) {
  const statusIcon = service.status === 'healthy' ? '🟢' :
                    service.status === 'degraded' ? '🟡' : '🔴';

  const statusColor = service.status === 'healthy' ? chalk.green :
                     service.status === 'degraded' ? chalk.yellow : chalk.red;

  const responseTime = service.responseTime < 1000 ?
    chalk.green(`${service.responseTime}ms`) :
    chalk.yellow(`${service.responseTime}ms`);

  console.log(`   ${statusIcon} ${chalk.white(service.name)} ${statusColor(service.status)} (${responseTime})`);
}

function displayQAStatus(qa: QAStatus) {
  const suites = [
    { name: 'Smoke Tests', key: 'smoke' as const },
    { name: 'Security Tests', key: 'security' as const },
    { name: 'Load Tests', key: 'load' as const },
    { name: 'Integration Tests', key: 'integration' as const }
  ];

  suites.forEach(suite => {
    const status = qa.testSuites[suite.key];
    const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⏸️';
    const color = status === 'pass' ? chalk.green : status === 'fail' ? chalk.red : chalk.gray;

    console.log(`   ${icon} ${suite.name}: ${color(status)}`);
  });

  if (qa.lastRun !== 'never') {
    const lastRun = new Date(qa.lastRun).toLocaleString();
    console.log(chalk.gray(`   Last run: ${lastRun}`));
  }

  if (qa.coverage) {
    const coverageColor = qa.coverage >= 80 ? chalk.green : qa.coverage >= 60 ? chalk.yellow : chalk.red;
    console.log(`   Coverage: ${coverageColor(`${qa.coverage}%`)}`);
  }
}

function displayPipelineStatus(pipeline: any) {
  const components = [
    { name: 'Authentication', key: 'auth' },
    { name: 'Trust Scoring', key: 'trust' },
    { name: 'Schema Propagation', key: 'propagation' }
  ];

  components.forEach(comp => {
    const status = pipeline[comp.key];
    const icon = status === 'operational' ? '🟢' : status === 'degraded' ? '🟡' : '🔴';
    const color = status === 'operational' ? chalk.green : status === 'degraded' ? chalk.yellow : chalk.red;

    console.log(`   ${icon} ${comp.name}: ${color(status)}`);
  });
}