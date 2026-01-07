import chalk from 'chalk';
import ora from 'ora';
import fetch from 'node-fetch';
import inquirer from 'inquirer';

export interface ServicesOptions {
  list?: boolean;
  discover?: string;
  register?: boolean;
  unregister?: string;
  healthCheck?: string;
}

export async function servicesCommand(options: ServicesOptions = {}) {
  const registryUrl = process.env.CHITTYOS_REGISTRY_URL || 'http://localhost:3001';

  if (options.list) {
    await listServices(registryUrl);
  } else if (options.discover) {
    await discoverServices(registryUrl, options.discover);
  } else if (options.register) {
    await registerService(registryUrl);
  } else if (options.unregister) {
    await unregisterService(registryUrl, options.unregister);
  } else if (options.healthCheck) {
    await runHealthCheck(registryUrl, options.healthCheck);
  } else {
    // Interactive mode
    const action = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '📋 List all services', value: 'list' },
          { name: '🔍 Discover services by capability', value: 'discover' },
          { name: '➕ Register a new service', value: 'register' },
          { name: '🏥 Run health check', value: 'health' }
        ]
      }
    ]);

    switch (action.action) {
      case 'list':
        await listServices(registryUrl);
        break;
      case 'discover':
        const capability = await inquirer.prompt([
          {
            type: 'input',
            name: 'capability',
            message: 'Enter capability to search for:'
          }
        ]);
        await discoverServices(registryUrl, capability.capability);
        break;
      case 'register':
        await registerService(registryUrl);
        break;
      case 'health':
        const serviceName = await inquirer.prompt([
          {
            type: 'input',
            name: 'serviceName',
            message: 'Enter service name to check:'
          }
        ]);
        await runHealthCheck(registryUrl, serviceName.serviceName);
        break;
    }
  }
}

async function listServices(registryUrl: string) {
  const spinner = ora('Fetching services from registry...').start();

  try {
    const response = await fetch(`${registryUrl}/api/v1/services`, {
      headers: { 'User-Agent': 'ChittyOS-CLI/1.0.0' }
    });

    if (!response.ok) {
      throw new Error(`Registry returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const services = Array.isArray(data) ? data : data.services || [];

    spinner.succeed(`Found ${services.length} registered services`);

    if (services.length === 0) {
      console.log(chalk.yellow('No services are currently registered.'));
      return;
    }

    // Group services by category
    const servicesByCategory = services.reduce((acc, service) => {
      const category = service.category || 'uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(service);
      return acc;
    }, {});

    console.log(chalk.blue.bold('\n🔍 ChittyOS Services Registry\n'));

    Object.entries(servicesByCategory).forEach(([category, categoryServices]: [string, any[]]) => {
      console.log(chalk.white.bold(`📁 ${category.toUpperCase()}`));

      categoryServices.forEach(service => {
        const healthIcon = service.health?.status === 'HEALTHY' ? '🟢' :
                          service.health?.status === 'DEGRADED' ? '🟡' : '🔴';

        console.log(`   ${healthIcon} ${chalk.cyan(service.serviceName || service.name)}`);
        console.log(`      ${chalk.gray(service.description || 'No description')}`);

        if (service.baseUrl) {
          console.log(`      ${chalk.blue(service.baseUrl)}`);
        }

        if (service.capabilities && service.capabilities.length > 0) {
          const caps = service.capabilities.slice(0, 3).join(', ');
          const moreCount = service.capabilities.length > 3 ? ` +${service.capabilities.length - 3} more` : '';
          console.log(`      ${chalk.green('Capabilities:')} ${caps}${moreCount}`);
        }

        if (service.trustScore !== undefined) {
          const trustColor = service.trustScore >= 80 ? chalk.green :
                           service.trustScore >= 60 ? chalk.yellow : chalk.red;
          console.log(`      ${chalk.white('Trust Score:')} ${trustColor(service.trustScore)}`);
        }

        console.log('');
      });
    });

    // Summary
    const healthyCount = services.filter(s => s.health?.status === 'HEALTHY').length;
    const categoryCount = Object.keys(servicesByCategory).length;

    console.log(chalk.white.bold('📊 Summary'));
    console.log(`   Total Services: ${chalk.cyan(services.length)}`);
    console.log(`   Categories: ${chalk.cyan(categoryCount)}`);
    console.log(`   Healthy: ${chalk.green(healthyCount)}/${services.length}`);

  } catch (error) {
    spinner.fail('Failed to fetch services');
    console.error(chalk.red('Error:'), error.message);

    if (error.message.includes('ECONNREFUSED')) {
      console.log(chalk.yellow('\n💡 Tip: Make sure ChittyRegistry is running:'));
      console.log(chalk.gray('   chittyos status'));
    }
  }
}

async function discoverServices(registryUrl: string, capability: string) {
  const spinner = ora(`Discovering services with capability: ${capability}...`).start();

  try {
    const response = await fetch(`${registryUrl}/api/v1/discover?capability=${encodeURIComponent(capability)}`, {
      headers: { 'User-Agent': 'ChittyOS-CLI/1.0.0' }
    });

    if (!response.ok) {
      throw new Error(`Discovery failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const services = data.services || [];

    spinner.succeed(`Found ${services.length} services with capability: ${capability}`);

    if (services.length === 0) {
      console.log(chalk.yellow(`No services found with capability: ${capability}`));
      console.log(chalk.gray('\n💡 Try these common capabilities:'));
      console.log(chalk.gray('   • authentication'));
      console.log(chalk.gray('   • ai-orchestration'));
      console.log(chalk.gray('   • document-processing'));
      console.log(chalk.gray('   • blockchain'));
      return;
    }

    console.log(chalk.blue.bold(`\n🔍 Services with capability: ${capability}\n`));

    services.forEach((service, index) => {
      console.log(`${chalk.cyan(`${index + 1}.`)} ${chalk.white.bold(service.serviceName)}`);
      console.log(`   ${chalk.gray(service.description)}`);
      console.log(`   ${chalk.blue(service.baseUrl)}`);

      if (service.endpoints && service.endpoints.length > 0) {
        console.log(`   ${chalk.green('Endpoints:')} ${service.endpoints.map(e => e.path).join(', ')}`);
      }

      if (service.healthCheck) {
        const health = service.healthCheck.status || 'unknown';
        const healthColor = health === 'HEALTHY' ? chalk.green :
                           health === 'DEGRADED' ? chalk.yellow : chalk.red;
        console.log(`   ${chalk.white('Health:')} ${healthColor(health)}`);
      }

      console.log('');
    });

  } catch (error) {
    spinner.fail('Discovery failed');
    console.error(chalk.red('Error:'), error.message);
  }
}

async function registerService(registryUrl: string) {
  console.log(chalk.blue('📝 Register New ChittyOS Service\n'));

  const serviceInfo = await inquirer.prompt([
    {
      type: 'input',
      name: 'serviceName',
      message: 'Service name:',
      validate: (input) => input.trim().length > 0 || 'Service name is required'
    },
    {
      type: 'input',
      name: 'displayName',
      message: 'Display name:',
      validate: (input) => input.trim().length > 0 || 'Display name is required'
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description:'
    },
    {
      type: 'input',
      name: 'baseUrl',
      message: 'Base URL:',
      validate: (input) => {
        try {
          new URL(input);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      }
    },
    {
      type: 'list',
      name: 'category',
      message: 'Category:',
      choices: [
        'core-infrastructure',
        'security-verification',
        'blockchain-infrastructure',
        'ai-intelligence',
        'document-evidence',
        'business-operations',
        'foundation-governance',
        'other'
      ]
    },
    {
      type: 'input',
      name: 'capabilities',
      message: 'Capabilities (comma-separated):',
      filter: (input) => input.split(',').map(s => s.trim()).filter(s => s.length > 0)
    },
    {
      type: 'input',
      name: 'version',
      message: 'Version:',
      default: '1.0.0'
    }
  ]);

  const spinner = ora('Registering service...').start();

  try {
    const registrationData = {
      ...serviceInfo,
      endpoints: [
        { path: '/health', method: 'GET', description: 'Health check endpoint' }
      ],
      healthCheck: {
        enabled: true,
        endpoint: '/health',
        interval: 30
      },
      metadata: {
        registeredBy: 'chittyos-cli',
        registrationTime: new Date().toISOString()
      }
    };

    const response = await fetch(`${registryUrl}/api/v1/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ChittyOS-CLI/1.0.0'
      },
      body: JSON.stringify(registrationData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || `Registration failed: ${response.status}`);
    }

    const result = await response.json();

    spinner.succeed(`Service ${serviceInfo.serviceName} registered successfully`);

    console.log(chalk.green('\n✅ Registration Complete'));
    console.log(`   Service ID: ${chalk.cyan(result.serviceId || 'N/A')}`);
    console.log(`   Registry URL: ${chalk.blue(`${registryUrl}/api/v1/services/${serviceInfo.serviceName}`)}`);

    console.log(chalk.blue('\n📋 Next Steps:'));
    console.log(chalk.gray('   1. Implement /health endpoint in your service'));
    console.log(chalk.gray('   2. Test service health: chittyos services --health-check ' + serviceInfo.serviceName));
    console.log(chalk.gray('   3. Monitor service status: chittyos status --services'));

  } catch (error) {
    spinner.fail('Registration failed');
    console.error(chalk.red('Error:'), error.message);
  }
}

async function unregisterService(registryUrl: string, serviceName: string) {
  const confirm = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: `Are you sure you want to unregister service "${serviceName}"?`,
      default: false
    }
  ]);

  if (!confirm.confirmed) {
    console.log(chalk.yellow('Unregistration cancelled'));
    return;
  }

  const spinner = ora(`Unregistering service: ${serviceName}...`).start();

  try {
    const response = await fetch(`${registryUrl}/api/v1/services/${serviceName}`, {
      method: 'DELETE',
      headers: { 'User-Agent': 'ChittyOS-CLI/1.0.0' }
    });

    if (!response.ok) {
      throw new Error(`Unregistration failed: ${response.status} ${response.statusText}`);
    }

    spinner.succeed(`Service ${serviceName} unregistered successfully`);

  } catch (error) {
    spinner.fail('Unregistration failed');
    console.error(chalk.red('Error:'), error.message);
  }
}

async function runHealthCheck(registryUrl: string, serviceName: string) {
  const spinner = ora(`Running health check for: ${serviceName}...`).start();

  try {
    // First get service info
    const serviceResponse = await fetch(`${registryUrl}/api/v1/services/${serviceName}`, {
      headers: { 'User-Agent': 'ChittyOS-CLI/1.0.0' }
    });

    if (!serviceResponse.ok) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    const service = await serviceResponse.json();

    // Run health check
    const healthResponse = await fetch(`${service.baseUrl}/health`, {
      timeout: 10000,
      headers: { 'User-Agent': 'ChittyOS-CLI/1.0.0' }
    });

    const responseTime = Date.now();
    const isHealthy = healthResponse.ok;

    spinner.succeed(`Health check completed for: ${serviceName}`);

    console.log(chalk.blue.bold(`\n🏥 Health Check Results: ${serviceName}\n`));

    const statusIcon = isHealthy ? '🟢' : '🔴';
    const statusColor = isHealthy ? chalk.green : chalk.red;
    const status = isHealthy ? 'HEALTHY' : 'UNHEALTHY';

    console.log(`   ${statusIcon} Status: ${statusColor(status)}`);
    console.log(`   ⏱️  Response Time: ${chalk.cyan(`${healthResponse.status ? 'Connected' : 'Failed'}`)}`);
    console.log(`   🌐 URL: ${chalk.blue(service.baseUrl + '/health')}`);

    if (isHealthy) {
      try {
        const healthData = await healthResponse.json();
        console.log(`   📊 Health Data:`);
        console.log(`      ${chalk.gray(JSON.stringify(healthData, null, 6))}`);
      } catch {
        console.log(`   📊 Health endpoint returned: ${healthResponse.status}`);
      }
    } else {
      console.log(`   ❌ HTTP Status: ${chalk.red(healthResponse.status)}`);
    }

    console.log(`\n   ${chalk.gray('Last checked:')} ${new Date().toLocaleString()}`);

  } catch (error) {
    spinner.fail('Health check failed');
    console.error(chalk.red('Error:'), error.message);
  }
}