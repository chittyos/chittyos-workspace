import chalk from 'chalk';
import ora from 'ora';

interface TrustOptions {
  score?: string;
  update?: string;
  auth?: boolean;
  verify?: string;
}

export async function trustCommand(options: TrustOptions): Promise<void> {
  const spinner = ora();

  if (options.score) {
    spinner.start(`Fetching trust score for ${options.score}...`);
    try {
      const response = await fetch(`https://trust.chitty.cc/api/score/${options.score}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as any;
      spinner.succeed('Trust score retrieved');
      console.log(chalk.cyan(`\nTrust Score for ${options.score}:`));
      console.log(chalk.white(`  Score: ${data.score || 'N/A'}`));
      console.log(chalk.white(`  Level: ${data.level || 'N/A'}`));
      console.log(chalk.white(`  Last Updated: ${data.updatedAt || 'N/A'}`));
    } catch (error: any) {
      spinner.fail(`Failed to get trust score: ${error.message}`);
    }
    return;
  }

  if (options.update) {
    spinner.start(`Updating trust score for ${options.update}...`);
    try {
      const response = await fetch(`https://trust.chitty.cc/api/score/${options.update}/refresh`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      spinner.succeed('Trust score update triggered');
    } catch (error: any) {
      spinner.fail(`Failed to update trust score: ${error.message}`);
    }
    return;
  }

  if (options.auth) {
    spinner.start('Testing pipeline authentication...');
    try {
      const response = await fetch('https://auth.chitty.cc/api/health');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      spinner.succeed('Pipeline authentication is working');
    } catch (error: any) {
      spinner.fail(`Pipeline auth test failed: ${error.message}`);
    }
    return;
  }

  if (options.verify) {
    spinner.start('Verifying token...');
    try {
      const response = await fetch('https://auth.chitty.cc/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: options.verify })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as any;
      spinner.succeed('Token verified');
      console.log(chalk.cyan('\nToken Details:'));
      console.log(chalk.white(`  Valid: ${data.valid}`));
      console.log(chalk.white(`  Subject: ${data.sub || 'N/A'}`));
      console.log(chalk.white(`  Expires: ${data.exp || 'N/A'}`));
    } catch (error: any) {
      spinner.fail(`Token verification failed: ${error.message}`);
    }
    return;
  }

  console.log(chalk.yellow('No action specified. Use --score, --update, --auth, or --verify'));
}
