/**
 * ChittySync CLI - Deploy Command
 *
 * Deploy ChittyOS workers with various strategies.
 */

import chalk from 'chalk';
import ora from 'ora';

/**
 * Deploy command handler
 * @param {string[]} services - Services to deploy
 * @param {Object} options - Command options
 * @param {Object} config - Config store
 */
export async function deployCommand(services, options, config) {
  const spinner = ora('Initializing deployment...').start();

  try {
    // Get deployment manager URL from config
    const deploymentUrl = config.get('deploymentUrl') || 'https://gateway.chitty.cc/api/deploy';
    const token = config.get('CHITTY_ID_TOKEN');

    if (!token) {
      spinner.fail('CHITTY_ID_TOKEN not configured. Run: chittysync config set CHITTY_ID_TOKEN=xxx');
      process.exit(1);
    }

    // Determine services to deploy
    const targetServices = options.batch ? [] : services;
    const strategy = options.strategy || 'blue-green';
    const environment = options.environment || 'production';

    spinner.text = `Deploying to ${environment} using ${strategy} strategy`;

    if (options.dryRun) {
      spinner.info(`[DRY RUN] Would deploy: ${targetServices.length > 0 ? targetServices.join(', ') : 'all services'}`);
      return;
    }

    // Call deployment manager
    const response = await fetch(`${deploymentUrl}/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        workers: targetServices,
        environment,
        strategy
      })
    });

    if (!response.ok) {
      throw new Error(`Deployment failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const data = result.data;

    spinner.succeed(chalk.green(`Deployment completed in ${data.duration}ms`));

    // Display results
    console.log(chalk.bold('\nDeployment Results:'));
    console.log(chalk.gray(`Deployment ID: ${data.deploymentId}`));
    console.log(chalk.green(`✓ Succeeded: ${data.succeeded}`));

    if (data.failed > 0) {
      console.log(chalk.red(`✗ Failed: ${data.failed}`));

      const failures = data.results.filter(r => !r.success);
      failures.forEach(f => {
        console.log(chalk.red(`  - ${f.worker}: ${f.error}`));
      });
    }

    // List deployed services
    if (data.succeeded > 0) {
      console.log(chalk.bold('\nDeployed Services:'));
      const successes = data.results.filter(r => r.success);
      successes.forEach(s => {
        console.log(chalk.green(`  ✓ ${s.worker} (${s.duration}ms)`));
      });
    }

  } catch (error) {
    spinner.fail(chalk.red(`Deployment failed: ${error.message}`));
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}
