#!/usr/bin/env node

import { Command } from 'commander';
import { SecretsManager } from '../core/SecretsManager';
import { ConfigManager } from '../config/ConfigManager';
import { Logger } from '../utils/Logger';
import * as inquirer from 'inquirer';
import chalk from 'chalk';

const program = new Command();
const logger = new Logger();

program
  .name('secrets-manager')
  .description('Centralized secrets management with smart cycling and injection')
  .version('1.0.0');

// Global options
program
  .option('-c, --config <path>', 'Configuration file path')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-q, --quiet', 'Suppress non-error output');

// Initialize command
program
  .command('init')
  .description('Initialize a new secrets configuration')
  .option('-f, --force', 'Overwrite existing configuration')
  .action(async (options) => {
    try {
      const configPath = program.opts().config || 'secrets.yaml';
      const configManager = new ConfigManager(configPath, logger);

      // Check if config already exists
      if (await configManager.getConfig() && !options.force) {
        const { overwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: 'Configuration file already exists. Overwrite?',
            default: false
          }
        ]);

        if (!overwrite) {
          console.log('Initialization cancelled.');
          return;
        }
      }

      // Create default configuration
      const defaultConfig = await configManager.createDefaultConfig(configPath);

      console.log(chalk.green(`✓ Configuration file created: ${configPath}`));
      console.log(chalk.yellow('Please edit the configuration file to match your setup.'));

    } catch (error) {
      console.error(chalk.red(`Failed to initialize configuration: ${error}`));
      process.exit(1);
    }
  });

// Get secret command
program
  .command('get')
  .description('Get a secret value')
  .argument('<key>', 'Secret key to retrieve')
  .option('-e, --environment <env>', 'Environment name', 'development')
  .action(async (key, options) => {
    try {
      const secretsManager = await initializeSecretsManager();
      const value = await secretsManager.getSecret(key, options.environment);

      if (value !== null) {
        console.log(value);
      } else {
        console.error(chalk.red(`Secret '${key}' not found in environment '${options.environment}'`));
        process.exit(1);
      }

    } catch (error) {
      console.error(chalk.red(`Failed to get secret: ${error}`));
      process.exit(1);
    }
  });

// Set secret command
program
  .command('set')
  .description('Set a secret value')
  .argument('<key>', 'Secret key to set')
  .argument('[value]', 'Secret value (will prompt if not provided)')
  .option('-e, --environment <env>', 'Environment name', 'development')
  .action(async (key, value, options) => {
    try {
      let secretValue = value;

      // Prompt for value if not provided
      if (!secretValue) {
        const { inputValue } = await inquirer.prompt([
          {
            type: 'password',
            name: 'inputValue',
            message: `Enter value for ${key}:`,
            mask: '*'
          }
        ]);
        secretValue = inputValue;
      }

      const secretsManager = await initializeSecretsManager();
      const success = await secretsManager.setSecret(key, secretValue, options.environment);

      if (success) {
        console.log(chalk.green(`✓ Secret '${key}' set successfully`));
      } else {
        console.error(chalk.red(`Failed to set secret '${key}'`));
        process.exit(1);
      }

    } catch (error) {
      console.error(chalk.red(`Failed to set secret: ${error}`));
      process.exit(1);
    }
  });

// Inject secrets command
program
  .command('inject')
  .description('Inject secrets to target')
  .option('-e, --environment <env>', 'Environment name', 'development')
  .option('-t, --target <target>', 'Injection target', 'env')
  .option('-f, --file <path>', 'Output file path (for file target)')
  .option('--format <format>', 'Output format (env, json, yaml)', 'env')
  .action(async (options) => {
    try {
      const secretsManager = await initializeSecretsManager();
      const success = await secretsManager.injectSecrets(options.environment, options.target);

      if (success) {
        console.log(chalk.green(`✓ Secrets injected successfully to ${options.target}`));
      } else {
        console.error(chalk.red('Failed to inject secrets'));
        process.exit(1);
      }

    } catch (error) {
      console.error(chalk.red(`Failed to inject secrets: ${error}`));
      process.exit(1);
    }
  });

// Cycle secrets command
program
  .command('cycle')
  .description('Cycle secrets (rotate/regenerate)')
  .option('-e, --environment <env>', 'Environment name (all if not specified)')
  .option('--dry-run', 'Show what would be cycled without making changes')
  .action(async (options) => {
    try {
      const secretsManager = await initializeSecretsManager();

      if (options.dryRun) {
        console.log(chalk.yellow('Dry run mode - no changes will be made'));
        // Implementation for dry run would go here
        return;
      }

      await secretsManager.cycleSecrets(options.environment);
      console.log(chalk.green('✓ Secret cycling completed'));

    } catch (error) {
      console.error(chalk.red(`Failed to cycle secrets: ${error}`));
      process.exit(1);
    }
  });

// List environments command
program
  .command('environments')
  .alias('envs')
  .description('List available environments')
  .action(async () => {
    try {
      const configManager = new ConfigManager(program.opts().config, logger);
      const config = await configManager.loadConfig();

      console.log(chalk.blue('Available environments:'));
      for (const env of config.environments) {
        console.log(`  • ${chalk.green(env.name)} - ${env.description || 'No description'}`);
        console.log(`    Secrets: ${env.secrets.length}`);
        if (env.inheritFrom) {
          console.log(`    Inherits from: ${env.inheritFrom}`);
        }
        console.log();
      }

    } catch (error) {
      console.error(chalk.red(`Failed to list environments: ${error}`));
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show system status and statistics')
  .action(async () => {
    try {
      const secretsManager = await initializeSecretsManager();
      const stats = secretsManager.getStats();

      console.log(chalk.blue('Secrets Manager Status:'));
      console.log(`  Cached secrets: ${stats.cachedSecrets}`);
      console.log(`  Environments: ${stats.environments}`);
      console.log(`  Cycling enabled: ${stats.cycling.enabled ? 'Yes' : 'No'}`);
      console.log(`  Cycling rules: ${stats.cycling.rules}`);
      console.log(`  Loaded plugins: ${stats.plugins}`);

    } catch (error) {
      console.error(chalk.red(`Failed to get status: ${error}`));
      process.exit(1);
    }
  });

// Validate config command
program
  .command('validate')
  .description('Validate configuration file')
  .action(async () => {
    try {
      const configManager = new ConfigManager(program.opts().config, logger);
      const config = await configManager.loadConfig();
      const validation = await configManager.validateConfig(config);

      if (validation.valid) {
        console.log(chalk.green('✓ Configuration is valid'));
      } else {
        console.log(chalk.red('✗ Configuration validation failed:'));
        for (const error of validation.errors) {
          console.log(`  • ${error}`);
        }
        process.exit(1);
      }

    } catch (error) {
      console.error(chalk.red(`Failed to validate configuration: ${error}`));
      process.exit(1);
    }
  });

// Run command with environment injection
program
  .command('run')
  .description('Run a command with injected secrets')
  .argument('<command>', 'Command to run')
  .option('-e, --environment <env>', 'Environment name', 'development')
  .allowUnknownOption()
  .action(async (command, options, program) => {
    try {
      const secretsManager = await initializeSecretsManager();

      // Inject secrets to environment
      await secretsManager.injectSecrets(options.environment, 'env');

      // Execute the command
      const { spawn } = await import('child_process');
      const args = program.args.slice(1); // Remove the command itself

      const child = spawn(command, args, {
        stdio: 'inherit',
        env: { ...process.env },
        shell: true
      });

      child.on('exit', (code) => {
        process.exit(code || 0);
      });

    } catch (error) {
      console.error(chalk.red(`Failed to run command: ${error}`));
      process.exit(1);
    }
  });

async function initializeSecretsManager(): Promise<SecretsManager> {
  const configManager = new ConfigManager(program.opts().config, logger);
  const config = await configManager.loadConfig();

  // Set log level based on options
  const globalOptions = program.opts();
  if (globalOptions.verbose) {
    logger.logLevel = 'debug';
  } else if (globalOptions.quiet) {
    logger.logLevel = 'error';
  }

  const secretsManager = new SecretsManager(config);
  await secretsManager.initialize();

  return secretsManager;
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error);
  process.exit(1);
});

program.parse();