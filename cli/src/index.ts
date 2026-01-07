#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import gradient from 'gradient-string';
import boxen from 'boxen';
import { initCommand } from './commands/init';
import { statusCommand } from './commands/status';
import { deployCommand } from './commands/deploy';
import { servicesCommand } from './commands/services';
import { aiCommand } from './commands/ai';
import { bridgeCommand } from './commands/bridge';
import { projectCommand } from './commands/project';

const program = new Command();

// ASCII Art Banner
function showBanner() {
  console.log(
    gradient.pastel.multiline(
      figlet.textSync('ChittyOS', {
        font: 'Big',
        horizontalLayout: 'default',
        verticalLayout: 'default'
      })
    )
  );

  console.log(
    boxen(
      chalk.white.bold('🚀 Trust Operating System CLI') + '\n' +
      chalk.gray('Initialize, deploy, and manage ChittyOS services') + '\n\n' +
      chalk.blue('• Service Registry & Discovery') + '\n' +
      chalk.green('• AI Orchestration & Edge Computing') + '\n' +
      chalk.yellow('• Pipeline Authentication & Trust Scoring') + '\n' +
      chalk.magenta('• Distributed Session Management'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
        backgroundColor: '#1a1a1a'
      }
    )
  );
}

// Main CLI setup
program
  .name('chittyos')
  .description('ChittyOS Trust Operating System CLI')
  .version('1.0.0')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--registry <url>', 'ChittyOS Registry URL', 'https://registry.chitty.cc')
  .option('--no-banner', 'Skip banner display')
  .hook('preAction', (thisCommand) => {
    if (!thisCommand.opts().noBanner && !process.env.CHITTYOS_NO_BANNER) {
      showBanner();
    }
  });

// Commands
program
  .command('init')
  .description('Initialize a new ChittyOS project')
  .argument('[project-name]', 'Project name')
  .option('-t, --template <template>', 'Project template', 'service')
  .option('-r, --registry', 'Include service registry setup')
  .option('-a, --ai', 'Include AI orchestration setup')
  .option('-b, --bridge', 'Include context bridge setup')
  .option('--skip-install', 'Skip dependency installation')
  .action(initCommand);

program
  .command('status')
  .description('Check ChittyOS ecosystem status')
  .option('-s, --services', 'Show detailed service status')
  .option('-h, --health', 'Show health monitoring data')
  .option('-a, --ai', 'Show AI infrastructure status')
  .option('--json', 'Output in JSON format')
  .action(statusCommand);

program
  .command('deploy')
  .description('Deploy ChittyOS services')
  .argument('[environment]', 'Deployment environment', 'production')
  .option('-s, --service <name>', 'Deploy specific service')
  .option('-a, --ai', 'Deploy AI infrastructure')
  .option('-c, --cloudflare', 'Deploy to Cloudflare Workers')
  .option('--dry-run', 'Show deployment plan without executing')
  .action(deployCommand);

program
  .command('services')
  .description('Manage ChittyOS services')
  .option('-l, --list', 'List all available services')
  .option('-d, --discover <capability>', 'Discover services by capability')
  .option('-r, --register', 'Register a new service')
  .option('-u, --unregister <name>', 'Unregister a service')
  .option('--health-check <name>', 'Run health check on service')
  .action(servicesCommand);

program
  .command('ai')
  .description('AI orchestration and management')
  .option('-o, --orchestrate <pattern>', 'Run AI orchestration pattern')
  .option('-g, --gateway', 'Manage AI Gateway')
  .option('-l, --langchain', 'Manage LangChain agents')
  .option('-m, --mcp', 'Manage MCP agents')
  .option('-v, --vectorize', 'Manage vector indexes')
  .option('--test', 'Run AI infrastructure tests')
  .action(aiCommand);

program
  .command('bridge')
  .description('Context bridge management')
  .option('-s, --start', 'Start context bridge service')
  .option('-t, --stop', 'Stop context bridge service')
  .option('--sync', 'Trigger session sync')
  .option('--notion', 'Manage Notion integration')
  .option('--status', 'Show bridge status')
  .action(bridgeCommand);

program
  .command('project')
  .description('Project detection and configuration')
  .option('-d, --detect', 'Detect current project type')
  .option('-c, --configure', 'Configure project settings')
  .option('--hooks', 'Manage project hooks')
  .option('-l, --link <path>', 'Link to existing ChittyOS project')
  .option('--status', 'Show project status')
  .action(projectCommand);

// Hidden commands for advanced users
program
  .command('trust')
  .description('Trust score and authentication management')
  .option('-s, --score <chittyId>', 'Get trust score')
  .option('-u, --update <chittyId>', 'Update trust score')
  .option('-a, --auth', 'Test pipeline authentication')
  .option('--verify <token>', 'Verify authentication token')
  .action(async (options) => {
    const { trustCommand } = await import('./commands/trust');
    await trustCommand(options);
  });

program
  .command('dev')
  .description('Development tools and utilities')
  .option('-w, --watch', 'Watch for service changes')
  .option('-l, --logs <service>', 'Stream service logs')
  .option('-p, --proxy', 'Start development proxy')
  .option('--tunnel', 'Create secure tunnel for testing')
  .action(async (options) => {
    const { devCommand } = await import('./commands/dev');
    await devCommand(options);
  });

// Global error handling
process.on('uncaughtException', (error) => {
  console.error(chalk.red('❌ Uncaught Exception:'), error.message);
  if (program.opts().verbose) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('❌ Unhandled Rejection at:'), promise, 'reason:', reason);
  process.exit(1);
});

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}