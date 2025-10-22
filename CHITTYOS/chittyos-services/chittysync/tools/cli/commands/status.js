/**
 * ChittySync CLI - Status Command
 *
 * Check health and status of ChittyOS services.
 */

import chalk from 'chalk';
import ora from 'ora';

/**
 * Status command handler
 * @param {Object} options - Command options
 * @param {Object} config - Config store
 */
export async function statusCommand(options, config) {
  const spinner = ora('Checking service status...').start();

  try {
    // Get health monitor URL from config
    const healthUrl = config.get('healthUrl') || 'https://gateway.chitty.cc/api/health';
    const token = config.get('CHITTY_ID_TOKEN');

    if (!token) {
      spinner.fail('CHITTY_ID_TOKEN not configured. Run: chittysync config set CHITTY_ID_TOKEN=xxx');
      process.exit(1);
    }

    // Check specific service or all services
    const endpoint = options.service
      ? `${healthUrl}/service/${encodeURIComponent(options.service)}`
      : `${healthUrl}/all`;

    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const data = result.data;

    spinner.stop();

    // Display results
    if (options.service) {
      // Single service
      displayServiceStatus(data, options.verbose);
    } else {
      // All services
      displayAllServicesStatus(data, options.verbose);
    }

    // Watch mode
    if (options.watch) {
      console.log(chalk.gray('\n[Watch mode - refreshing every 5s. Press Ctrl+C to exit]'));
      setInterval(async () => {
        console.clear();
        const spinner = ora('Refreshing...').start();

        try {
          const response = await fetch(endpoint, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const result = await response.json();
          spinner.stop();

          if (options.service) {
            displayServiceStatus(result.data, options.verbose);
          } else {
            displayAllServicesStatus(result.data, options.verbose);
          }
        } catch (error) {
          spinner.fail(chalk.red(`Update failed: ${error.message}`));
        }
      }, 5000);
    }

  } catch (error) {
    spinner.fail(chalk.red(`Status check failed: ${error.message}`));
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Display single service status
 */
function displayServiceStatus(service, verbose) {
  const statusIcon = service.healthy ? chalk.green('✓') : chalk.red('✗');
  const statusText = service.healthy ? chalk.green('HEALTHY') : chalk.red('UNHEALTHY');

  console.log(chalk.bold(`\n${service.name}`));
  console.log(`${statusIcon} Status: ${statusText}`);
  console.log(chalk.gray(`URL: ${service.url}`));
  console.log(chalk.gray(`Response Time: ${service.responseTime}ms`));

  if (service.error) {
    console.log(chalk.red(`Error: ${service.error}`));
  }

  if (verbose && service.data) {
    console.log(chalk.bold('\nDetails:'));
    console.log(JSON.stringify(service.data, null, 2));
  }
}

/**
 * Display all services status
 */
function displayAllServicesStatus(data, verbose) {
  const services = data.services || [];
  const summary = data.summary || {
    total: services.length,
    healthy: services.filter(s => s.healthy).length,
    unhealthy: services.filter(s => !s.healthy).length
  };

  // Summary
  console.log(chalk.bold('\nChittyOS Service Status'));
  console.log(chalk.gray(`Last check: ${new Date(data.timestamp).toLocaleString()}\n`));

  const healthPercentage = Math.round((summary.healthy / summary.total) * 100);
  const healthColor = healthPercentage === 100 ? chalk.green :
                      healthPercentage >= 80 ? chalk.yellow : chalk.red;

  console.log(chalk.bold('Summary:'));
  console.log(`Total Services: ${summary.total}`);
  console.log(chalk.green(`✓ Healthy: ${summary.healthy}`));
  if (summary.unhealthy > 0) {
    console.log(chalk.red(`✗ Unhealthy: ${summary.unhealthy}`));
  }
  console.log(healthColor(`Health: ${healthPercentage}%\n`));

  // Services table
  console.log(chalk.bold('Services:'));

  services.forEach(service => {
    const statusIcon = service.healthy ? chalk.green('✓') : chalk.red('✗');
    const critical = service.critical ? chalk.yellow('[CRITICAL]') : '';
    const responseTime = chalk.gray(`(${service.responseTime}ms)`);

    console.log(`${statusIcon} ${service.name} ${critical} ${responseTime}`);

    if (service.error) {
      console.log(chalk.red(`  └─ Error: ${service.error}`));
    }

    if (verbose && service.data) {
      console.log(chalk.gray(`  └─ Data: ${JSON.stringify(service.data)}`));
    }
  });
}
