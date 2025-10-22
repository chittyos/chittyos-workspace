/**
 * ChittySync CLI - Sync Command
 *
 * Sync todos and data across platforms.
 */

import chalk from 'chalk';
import ora from 'ora';

/**
 * Sync command handler
 * @param {string[]} platforms - Platforms to sync
 * @param {Object} options - Command options
 * @param {Object} config - Config store
 */
export async function syncCommand(platforms, options, config) {
  const spinner = ora('Initializing sync...').start();

  try {
    // Get orchestrator URL from config
    const orchestratorUrl = config.get('orchestratorUrl') || 'https://gateway.chitty.cc/api/sync';
    const token = config.get('CHITTY_ID_TOKEN');

    if (!token) {
      spinner.fail('CHITTY_ID_TOKEN not configured. Run: chittysync config set CHITTY_ID_TOKEN=xxx');
      process.exit(1);
    }

    // Determine platforms to sync
    const targetPlatforms = options.all ? ['all'] : platforms;
    spinner.text = `Syncing platforms: ${targetPlatforms.join(', ')}`;

    if (options.dryRun) {
      spinner.info(`[DRY RUN] Would sync: ${targetPlatforms.join(', ')}`);
      return;
    }

    // Call orchestrator
    const response = await fetch(`${orchestratorUrl}/orchestrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ platforms: targetPlatforms })
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const data = result.data;

    spinner.succeed(chalk.green(`Sync completed in ${data.duration}ms`));

    // Display results
    console.log(chalk.bold('\nResults:'));
    console.log(chalk.green(`✓ Succeeded: ${data.succeeded}`));
    if (data.failed > 0) {
      console.log(chalk.red(`✗ Failed: ${data.failed}`));
      data.failures.forEach(f => {
        console.log(chalk.red(`  - ${f.platform}: ${f.error}`));
      });
    }

  } catch (error) {
    spinner.fail(chalk.red(`Sync failed: ${error.message}`));
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}
