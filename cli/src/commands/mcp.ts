import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export interface McpOptions {
  install?: boolean;
  list?: boolean;
  status?: boolean;
  uninstall?: boolean;
  json?: boolean;
}

interface ClaudeDesktopConfig {
  mcpServers?: Record<string, McpServerConfig>;
}

interface McpServerConfig {
  command?: string;
  args?: string[];
  url?: string;
  transport?: 'stdio' | 'sse' | 'http';
}

const CHITTYOS_MCP_SERVERS: Record<string, McpServerConfig> = {
  'chittyos-registry': {
    url: 'https://registry.chitty.cc/mcp',
    transport: 'http'
  },
  'chittyos-connect': {
    url: 'https://connect.chitty.cc/mcp',
    transport: 'http'
  },
  'chittyos-gateway': {
    url: 'https://mcp.chitty.cc',
    transport: 'http'
  }
};

function getClaudeDesktopConfigPath(): string {
  const platform = os.platform();
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else if (platform === 'win32') {
    return path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
  } else {
    return path.join(os.homedir(), '.config', 'claude', 'claude_desktop_config.json');
  }
}

async function readClaudeConfig(): Promise<ClaudeDesktopConfig> {
  const configPath = getClaudeDesktopConfigPath();
  try {
    if (await fs.pathExists(configPath)) {
      return await fs.readJson(configPath);
    }
  } catch {
    // Config doesn't exist or is invalid
  }
  return {};
}

async function writeClaudeConfig(config: ClaudeDesktopConfig): Promise<void> {
  const configPath = getClaudeDesktopConfigPath();
  await fs.ensureDir(path.dirname(configPath));
  await fs.writeJson(configPath, config, { spaces: 2 });
}

export async function mcpCommand(options: McpOptions): Promise<void> {
  const spinner = ora();

  if (options.list) {
    await listMcpServers(options.json);
    return;
  }

  if (options.status) {
    await checkMcpStatus(spinner, options.json);
    return;
  }

  if (options.uninstall) {
    await uninstallMcpServers(spinner);
    return;
  }

  if (options.install) {
    await installMcpServers(spinner);
    return;
  }

  // Default: show help
  console.log(chalk.cyan('\nChittyOS MCP Server Management\n'));
  console.log('Commands:');
  console.log('  --install    Install ChittyOS MCP servers to Claude Desktop');
  console.log('  --uninstall  Remove ChittyOS MCP servers from Claude Desktop');
  console.log('  --list       List available ChittyOS MCP servers');
  console.log('  --status     Check MCP server status');
  console.log('  --json       Output in JSON format');
}

async function listMcpServers(json?: boolean): Promise<void> {
  if (json) {
    console.log(JSON.stringify(CHITTYOS_MCP_SERVERS, null, 2));
    return;
  }

  console.log(chalk.cyan('\nAvailable ChittyOS MCP Servers:\n'));

  for (const [name, config] of Object.entries(CHITTYOS_MCP_SERVERS)) {
    console.log(chalk.white.bold(`  ${name}`));
    console.log(chalk.gray(`    URL: ${config.url}`));
    console.log(chalk.gray(`    Transport: ${config.transport}`));
    console.log();
  }

  // Fetch aggregated tools from gateway
  try {
    const response = await fetch('https://mcp.chitty.cc/tools');
    if (response.ok) {
      const data = await response.json() as { tools: Array<{ name: string; service: string; description: string }> };
      console.log(chalk.cyan(`Total tools available: ${data.tools?.length || 0}`));

      if (data.tools?.length > 0) {
        console.log(chalk.gray('\nSample tools:'));
        data.tools.slice(0, 5).forEach(tool => {
          console.log(chalk.white(`  • ${tool.name}`) + chalk.gray(` (${tool.service})`));
        });
        if (data.tools.length > 5) {
          console.log(chalk.gray(`  ... and ${data.tools.length - 5} more`));
        }
      }
    }
  } catch {
    console.log(chalk.yellow('Could not fetch tool list from gateway'));
  }
}

async function installMcpServers(spinner: ora.Ora): Promise<void> {
  spinner.start('Installing ChittyOS MCP servers...');

  try {
    const config = await readClaudeConfig();
    config.mcpServers = config.mcpServers || {};

    let installed = 0;
    for (const [name, serverConfig] of Object.entries(CHITTYOS_MCP_SERVERS)) {
      if (!config.mcpServers[name]) {
        config.mcpServers[name] = serverConfig;
        installed++;
      }
    }

    await writeClaudeConfig(config);

    if (installed > 0) {
      spinner.succeed(`Installed ${installed} MCP server(s) to Claude Desktop`);
      console.log(chalk.gray(`\nConfig location: ${getClaudeDesktopConfigPath()}`));
      console.log(chalk.yellow('\nRestart Claude Desktop to activate the servers.'));
    } else {
      spinner.info('All ChittyOS MCP servers already installed');
    }

    console.log(chalk.cyan('\nInstalled servers:'));
    for (const name of Object.keys(CHITTYOS_MCP_SERVERS)) {
      const status = config.mcpServers[name] ? chalk.green('✓') : chalk.gray('○');
      console.log(`  ${status} ${name}`);
    }

  } catch (error: any) {
    spinner.fail(`Failed to install: ${error.message}`);
  }
}

async function uninstallMcpServers(spinner: ora.Ora): Promise<void> {
  spinner.start('Removing ChittyOS MCP servers...');

  try {
    const config = await readClaudeConfig();

    if (!config.mcpServers) {
      spinner.info('No MCP servers configured');
      return;
    }

    let removed = 0;
    for (const name of Object.keys(CHITTYOS_MCP_SERVERS)) {
      if (config.mcpServers[name]) {
        delete config.mcpServers[name];
        removed++;
      }
    }

    await writeClaudeConfig(config);

    if (removed > 0) {
      spinner.succeed(`Removed ${removed} MCP server(s) from Claude Desktop`);
      console.log(chalk.yellow('\nRestart Claude Desktop to apply changes.'));
    } else {
      spinner.info('No ChittyOS MCP servers were installed');
    }

  } catch (error: any) {
    spinner.fail(`Failed to uninstall: ${error.message}`);
  }
}

async function checkMcpStatus(spinner: ora.Ora, json?: boolean): Promise<void> {
  spinner.start('Checking MCP server status...');

  const results: Record<string, { healthy: boolean; responseTime?: number; tools?: number }> = {};

  for (const [name, config] of Object.entries(CHITTYOS_MCP_SERVERS)) {
    const start = Date.now();
    try {
      const url = config.url!;
      const healthUrl = url.endsWith('/mcp') ? url.replace('/mcp', '/health') : `${url}/health`;

      const response = await fetch(healthUrl, {
        signal: AbortSignal.timeout(5000)
      });

      results[name] = {
        healthy: response.ok,
        responseTime: Date.now() - start
      };

      if (response.ok) {
        const data = await response.json() as { tools?: number };
        if (data.tools !== undefined) {
          results[name].tools = data.tools;
        }
      }
    } catch {
      results[name] = { healthy: false, responseTime: Date.now() - start };
    }
  }

  spinner.stop();

  if (json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log(chalk.cyan('\nChittyOS MCP Server Status:\n'));

  for (const [name, status] of Object.entries(results)) {
    const icon = status.healthy ? chalk.green('●') : chalk.red('●');
    const state = status.healthy ? chalk.green('healthy') : chalk.red('unreachable');
    const time = status.responseTime ? chalk.gray(`${status.responseTime}ms`) : '';
    const tools = status.tools !== undefined ? chalk.gray(`${status.tools} tools`) : '';

    console.log(`  ${icon} ${chalk.white(name)} ${state} ${time} ${tools}`);
  }

  // Check Claude Desktop config
  const configPath = getClaudeDesktopConfigPath();
  const configExists = await fs.pathExists(configPath);

  console.log(chalk.cyan('\nClaude Desktop Configuration:'));
  console.log(`  Config path: ${chalk.gray(configPath)}`);
  console.log(`  Config exists: ${configExists ? chalk.green('yes') : chalk.yellow('no')}`);

  if (configExists) {
    try {
      const config = await readClaudeConfig();
      const installedServers = Object.keys(config.mcpServers || {}).filter(
        name => name.startsWith('chittyos-')
      );
      console.log(`  ChittyOS servers: ${installedServers.length > 0 ? chalk.green(installedServers.join(', ')) : chalk.yellow('none')}`);
    } catch {
      console.log(`  ChittyOS servers: ${chalk.red('error reading config')}`);
    }
  }
}
