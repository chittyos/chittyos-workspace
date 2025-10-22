#!/usr/bin/env node

/**
 * ChittySync CLI
 *
 * Unified command-line interface for ChittySync orchestration hub.
 * Manages platform syncs, worker deployments, and service health.
 *
 * @module chittysync-cli
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Conf from 'conf';
import { syncCommand } from './commands/sync.js';
import { deployCommand } from './commands/deploy.js';
import { statusCommand } from './commands/status.js';
import { configCommand } from './commands/config.js';

const program = new Command();
const config = new Conf({ projectName: 'chittysync' });

// Version and description
program
  .name('chittysync')
  .description('ChittySync Universal Orchestration Hub')
  .version('2.0.0');

// Global options
program
  .option('-v, --verbose', 'Verbose output')
  .option('--dry-run', 'Dry run (no actual changes)');

// Sync command
program
  .command('sync')
  .description('Sync platforms (google, cloudflare, neon, github, mcp, docs)')
  .argument('[platforms...]', 'Platforms to sync (default: all)', ['all'])
  .option('-a, --all', 'Sync all platforms')
  .option('--dry-run', 'Dry run')
  .action(async (platforms, options) => {
    await syncCommand(platforms, options, config);
  });

// Deploy command
program
  .command('deploy')
  .description('Deploy ChittyOS workers')
  .argument('[services...]', 'Services to deploy (default: all)')
  .option('-b, --batch', 'Batch deploy all services')
  .option('-s, --strategy <strategy>', 'Deployment strategy (blue-green, rolling, force)', 'blue-green')
  .option('-e, --environment <env>', 'Environment (development, production)', 'production')
  .action(async (services, options) => {
    await deployCommand(services, options, config);
  });

// Status command
program
  .command('status')
  .description('Check service status')
  .option('-w, --watch', 'Watch mode (refresh every 5s)')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    await statusCommand(options, config);
  });

// Config command
program
  .command('config')
  .description('Manage configuration')
  .argument('<action>', 'Action (set, get, list)')
  .argument('[key]', 'Config key')
  .argument('[value]', 'Config value (for set)')
  .action(async (action, key, value, options) => {
    await configCommand(action, key, value, config);
  });

// Health command (alias for status)
program
  .command('health')
  .description('Check health of ChittyOS services')
  .argument('[service]', 'Specific service to check')
  .action(async (service, options) => {
    await statusCommand({ ...options, service }, config);
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
