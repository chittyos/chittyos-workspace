/**
 * Config Command - Claude configuration management
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import {
  getClaudeDesktopConfigPath,
  getClaudeCodeConfigPath,
  readClaudeDesktopConfig,
  listMcpServers,
  addMcpServer,
  removeMcpServer,
  installChittyOsMcpServers,
  uninstallChittyOsMcpServers,
  getConfigStatus,
  CHITTYOS_MCP_SERVERS,
  type McpServerConfig
} from '../lib/claude-config';

export interface ConfigOptions {
  show?: boolean;
  set?: boolean;
  mcp?: string;
  json?: boolean;
}

export async function configCommand(action?: string, options: ConfigOptions = {}): Promise<void> {
  // Handle MCP subcommand
  if (action === 'mcp' || options.mcp) {
    const mcpAction = options.mcp || 'list';
    await handleMcpCommand(mcpAction, options);
    return;
  }

  switch (action) {
    case 'show':
      await showConfig(options);
      break;
    case 'set':
      await setConfig(options);
      break;
    case 'status':
      await showStatus(options);
      break;
    default:
      await showConfigHelp();
  }
}

async function showConfigHelp(): Promise<void> {
  console.log(chalk.cyan('\nClaude Configuration Management\n'));
  console.log('Commands:');
  console.log('  chitty config show         Show current configuration');
  console.log('  chitty config status       Show config status');
  console.log('  chitty config mcp list     List configured MCP servers');
  console.log('  chitty config mcp add      Add an MCP server');
  console.log('  chitty config mcp remove   Remove an MCP server');
  console.log('  chitty config mcp install  Install all ChittyOS MCP servers');
  console.log('\nOptions:');
  console.log('  --json                     Output in JSON format');
}

async function showConfig(options: ConfigOptions): Promise<void> {
  const config = await readClaudeDesktopConfig();
  const status = await getConfigStatus();

  if (options.json) {
    console.log(JSON.stringify({ config, status }, null, 2));
    return;
  }

  console.log(chalk.cyan('\nClaude Configuration\n'));

  console.log(chalk.white.bold('Claude Desktop Config:'));
  console.log(chalk.gray(`  Path: ${getClaudeDesktopConfigPath()}`));
  console.log(chalk.gray(`  Exists: ${status.configExists ? chalk.green('yes') : chalk.yellow('no')}`));

  if (status.serverCount > 0) {
    console.log(chalk.gray(`  MCP Servers: ${status.serverCount}`));
    if (status.chittyOsServers.length > 0) {
      console.log(chalk.gray(`  ChittyOS Servers: ${status.chittyOsServers.join(', ')}`));
    }
  }

  console.log(chalk.white.bold('\nClaude Code Config:'));
  console.log(chalk.gray(`  Path: ${getClaudeCodeConfigPath()}`));
}

async function showStatus(options: ConfigOptions): Promise<void> {
  const spinner = ora('Checking configuration status...').start();

  try {
    const status = await getConfigStatus();
    const servers = await listMcpServers();

    spinner.stop();

    if (options.json) {
      console.log(JSON.stringify({ status, servers }, null, 2));
      return;
    }

    console.log(chalk.cyan('\nConfiguration Status\n'));

    // Config file status
    const configIcon = status.configExists ? chalk.green('●') : chalk.yellow('○');
    console.log(`${configIcon} Claude Desktop Config: ${status.configExists ? 'exists' : 'not found'}`);
    console.log(chalk.gray(`  ${status.configPath}`));

    // MCP servers
    console.log(chalk.white.bold('\nMCP Servers:'));

    if (Object.keys(servers).length === 0) {
      console.log(chalk.gray('  No MCP servers configured'));
    } else {
      for (const [name, config] of Object.entries(servers)) {
        const isChittyOs = name.startsWith('chittyos-');
        const icon = isChittyOs ? chalk.blue('◆') : chalk.gray('○');
        console.log(`  ${icon} ${chalk.white(name)}`);
        if (config.url) {
          console.log(chalk.gray(`    URL: ${config.url}`));
        }
        if (config.command) {
          console.log(chalk.gray(`    Command: ${config.command}`));
        }
      }
    }

    // ChittyOS MCP servers status
    console.log(chalk.white.bold('\nChittyOS MCP Servers:'));
    for (const name of Object.keys(CHITTYOS_MCP_SERVERS)) {
      const installed = name in servers;
      const icon = installed ? chalk.green('✓') : chalk.gray('○');
      console.log(`  ${icon} ${name}`);
    }

    // Recommendation
    const missingCount = Object.keys(CHITTYOS_MCP_SERVERS).length - status.chittyOsServers.length;
    if (missingCount > 0) {
      console.log(chalk.yellow(`\n💡 ${missingCount} ChittyOS MCP server(s) not installed`));
      console.log(chalk.gray('   Run: chitty config mcp install'));
    }
  } catch (error: any) {
    spinner.fail(`Failed to check status: ${error.message}`);
  }
}

async function setConfig(options: ConfigOptions): Promise<void> {
  console.log(chalk.yellow('\nConfig set is not yet implemented'));
  console.log(chalk.gray('Currently supported: MCP server management'));
  console.log(chalk.gray('Run: chitty config mcp --help'));
}

async function handleMcpCommand(action: string, options: ConfigOptions): Promise<void> {
  switch (action) {
    case 'list':
      await listMcpServersCommand(options);
      break;
    case 'add':
      await addMcpServerCommand();
      break;
    case 'remove':
      await removeMcpServerCommand();
      break;
    case 'install':
      await installMcpServersCommand();
      break;
    case 'uninstall':
      await uninstallMcpServersCommand();
      break;
    default:
      console.log(chalk.cyan('\nMCP Server Management\n'));
      console.log('Commands:');
      console.log('  chitty config mcp list      List configured servers');
      console.log('  chitty config mcp add       Add a new server');
      console.log('  chitty config mcp remove    Remove a server');
      console.log('  chitty config mcp install   Install all ChittyOS servers');
      console.log('  chitty config mcp uninstall Remove all ChittyOS servers');
  }
}

async function listMcpServersCommand(options: ConfigOptions): Promise<void> {
  const servers = await listMcpServers();

  if (options.json) {
    console.log(JSON.stringify(servers, null, 2));
    return;
  }

  console.log(chalk.cyan('\nConfigured MCP Servers:\n'));

  if (Object.keys(servers).length === 0) {
    console.log(chalk.gray('  No MCP servers configured'));
    console.log(chalk.gray('\n  Run: chitty config mcp install'));
    return;
  }

  for (const [name, config] of Object.entries(servers)) {
    console.log(chalk.white.bold(`  ${name}`));
    if (config.url) {
      console.log(chalk.gray(`    URL: ${config.url}`));
    }
    if (config.command) {
      console.log(chalk.gray(`    Command: ${config.command} ${(config.args || []).join(' ')}`));
    }
    if (config.transport) {
      console.log(chalk.gray(`    Transport: ${config.transport}`));
    }
    console.log();
  }
}

async function addMcpServerCommand(): Promise<void> {
  console.log(chalk.cyan('\nAdd MCP Server\n'));

  // Show available ChittyOS servers first
  const currentServers = await listMcpServers();
  const availableChittyOs = Object.entries(CHITTYOS_MCP_SERVERS)
    .filter(([name]) => !(name in currentServers))
    .map(([name, config]) => ({
      name: `${name} (ChittyOS)`,
      value: { name, config }
    }));

  const choices = [
    ...availableChittyOs,
    { name: 'Custom server...', value: 'custom' }
  ];

  const { selection } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selection',
      message: 'Select server to add:',
      choices
    }
  ]);

  if (selection === 'custom') {
    // Custom server configuration
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Server name:',
        validate: (input: string) => input.length > 0 || 'Name is required'
      },
      {
        type: 'list',
        name: 'type',
        message: 'Connection type:',
        choices: [
          { name: 'HTTP URL', value: 'http' },
          { name: 'SSE URL', value: 'sse' },
          { name: 'Local command (stdio)', value: 'stdio' }
        ]
      }
    ]);

    let config: McpServerConfig;

    if (answers.type === 'stdio') {
      const cmdAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'command',
          message: 'Command to run:',
          validate: (input: string) => input.length > 0 || 'Command is required'
        },
        {
          type: 'input',
          name: 'args',
          message: 'Arguments (space-separated):',
          default: ''
        }
      ]);

      config = {
        command: cmdAnswers.command,
        args: cmdAnswers.args.split(' ').filter(Boolean),
        transport: 'stdio'
      };
    } else {
      const urlAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'url',
          message: 'Server URL:',
          validate: (input: string) => {
            try {
              new URL(input);
              return true;
            } catch {
              return 'Invalid URL';
            }
          }
        }
      ]);

      config = {
        url: urlAnswers.url,
        transport: answers.type
      };
    }

    const spinner = ora('Adding MCP server...').start();
    try {
      await addMcpServer(answers.name, config);
      spinner.succeed(`Added MCP server: ${answers.name}`);
      console.log(chalk.yellow('\nRestart Claude Desktop to activate the server.'));
    } catch (error: any) {
      spinner.fail(`Failed to add server: ${error.message}`);
    }
  } else {
    // Pre-configured ChittyOS server
    const spinner = ora(`Adding ${selection.name}...`).start();
    try {
      await addMcpServer(selection.name, selection.config);
      spinner.succeed(`Added MCP server: ${selection.name}`);
      console.log(chalk.yellow('\nRestart Claude Desktop to activate the server.'));
    } catch (error: any) {
      spinner.fail(`Failed to add server: ${error.message}`);
    }
  }
}

async function removeMcpServerCommand(): Promise<void> {
  const servers = await listMcpServers();
  const serverNames = Object.keys(servers);

  if (serverNames.length === 0) {
    console.log(chalk.yellow('\nNo MCP servers configured'));
    return;
  }

  const { serverName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'serverName',
      message: 'Select server to remove:',
      choices: serverNames
    }
  ]);

  const spinner = ora(`Removing ${serverName}...`).start();
  try {
    const removed = await removeMcpServer(serverName);
    if (removed) {
      spinner.succeed(`Removed MCP server: ${serverName}`);
      console.log(chalk.yellow('\nRestart Claude Desktop to apply changes.'));
    } else {
      spinner.info(`Server ${serverName} was not found`);
    }
  } catch (error: any) {
    spinner.fail(`Failed to remove server: ${error.message}`);
  }
}

async function installMcpServersCommand(): Promise<void> {
  const spinner = ora('Installing ChittyOS MCP servers...').start();

  try {
    const installed = await installChittyOsMcpServers();

    if (installed > 0) {
      spinner.succeed(`Installed ${installed} MCP server(s)`);
      console.log(chalk.gray(`\nConfig: ${getClaudeDesktopConfigPath()}`));
      console.log(chalk.yellow('\nRestart Claude Desktop to activate the servers.'));
    } else {
      spinner.info('All ChittyOS MCP servers already installed');
    }

    // Show installed servers
    console.log(chalk.cyan('\nInstalled servers:'));
    for (const name of Object.keys(CHITTYOS_MCP_SERVERS)) {
      console.log(chalk.green(`  ✓ ${name}`));
    }
  } catch (error: any) {
    spinner.fail(`Failed to install: ${error.message}`);
  }
}

async function uninstallMcpServersCommand(): Promise<void> {
  const spinner = ora('Removing ChittyOS MCP servers...').start();

  try {
    const removed = await uninstallChittyOsMcpServers();

    if (removed > 0) {
      spinner.succeed(`Removed ${removed} MCP server(s)`);
      console.log(chalk.yellow('\nRestart Claude Desktop to apply changes.'));
    } else {
      spinner.info('No ChittyOS MCP servers were installed');
    }
  } catch (error: any) {
    spinner.fail(`Failed to uninstall: ${error.message}`);
  }
}
