/**
 * Claude Configuration Utilities
 * Manages Claude Desktop config and Claude Code settings
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export interface McpServerConfig {
  command?: string;
  args?: string[];
  url?: string;
  transport?: 'stdio' | 'sse' | 'http';
  env?: Record<string, string>;
}

export interface ClaudeDesktopConfig {
  mcpServers?: Record<string, McpServerConfig>;
}

export interface ClaudeCodeConfig {
  model?: string;
  maxTokens?: number;
  allowedTools?: string[];
  permissions?: {
    allowBash?: boolean;
    allowWrite?: boolean;
    allowNetwork?: boolean;
  };
}

// ChittyOS MCP Servers
export const CHITTYOS_MCP_SERVERS: Record<string, McpServerConfig> = {
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
  },
  'chittyos-id': {
    url: 'https://id.chitty.cc/mcp',
    transport: 'http'
  },
  'chittyos-auth': {
    url: 'https://auth.chitty.cc/mcp',
    transport: 'http'
  }
};

/**
 * Get Claude Desktop config file path
 */
export function getClaudeDesktopConfigPath(): string {
  const platform = os.platform();
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else if (platform === 'win32') {
    return path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
  } else {
    return path.join(os.homedir(), '.config', 'claude', 'claude_desktop_config.json');
  }
}

/**
 * Get Claude Code config directory path
 */
export function getClaudeCodeConfigDir(): string {
  return path.join(os.homedir(), '.claude');
}

/**
 * Get Claude Code config file path
 */
export function getClaudeCodeConfigPath(): string {
  return path.join(getClaudeCodeConfigDir(), 'config.json');
}

/**
 * Read Claude Desktop configuration
 */
export async function readClaudeDesktopConfig(): Promise<ClaudeDesktopConfig> {
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

/**
 * Write Claude Desktop configuration
 */
export async function writeClaudeDesktopConfig(config: ClaudeDesktopConfig): Promise<void> {
  const configPath = getClaudeDesktopConfigPath();
  await fs.ensureDir(path.dirname(configPath));
  await fs.writeJson(configPath, config, { spaces: 2 });
}

/**
 * Read Claude Code configuration
 */
export async function readClaudeCodeConfig(): Promise<ClaudeCodeConfig> {
  const configPath = getClaudeCodeConfigPath();
  try {
    if (await fs.pathExists(configPath)) {
      return await fs.readJson(configPath);
    }
  } catch {
    // Config doesn't exist or is invalid
  }
  return {};
}

/**
 * Write Claude Code configuration
 */
export async function writeClaudeCodeConfig(config: ClaudeCodeConfig): Promise<void> {
  const configPath = getClaudeCodeConfigPath();
  await fs.ensureDir(path.dirname(configPath));
  await fs.writeJson(configPath, config, { spaces: 2 });
}

/**
 * Add an MCP server to Claude Desktop config
 */
export async function addMcpServer(name: string, serverConfig: McpServerConfig): Promise<void> {
  const config = await readClaudeDesktopConfig();
  config.mcpServers = config.mcpServers || {};
  config.mcpServers[name] = serverConfig;
  await writeClaudeDesktopConfig(config);
}

/**
 * Remove an MCP server from Claude Desktop config
 */
export async function removeMcpServer(name: string): Promise<boolean> {
  const config = await readClaudeDesktopConfig();
  if (config.mcpServers && config.mcpServers[name]) {
    delete config.mcpServers[name];
    await writeClaudeDesktopConfig(config);
    return true;
  }
  return false;
}

/**
 * List all configured MCP servers
 */
export async function listMcpServers(): Promise<Record<string, McpServerConfig>> {
  const config = await readClaudeDesktopConfig();
  return config.mcpServers || {};
}

/**
 * Check if an MCP server is configured
 */
export async function hasMcpServer(name: string): Promise<boolean> {
  const servers = await listMcpServers();
  return name in servers;
}

/**
 * Install all ChittyOS MCP servers
 */
export async function installChittyOsMcpServers(): Promise<number> {
  const config = await readClaudeDesktopConfig();
  config.mcpServers = config.mcpServers || {};

  let installed = 0;
  for (const [name, serverConfig] of Object.entries(CHITTYOS_MCP_SERVERS)) {
    if (!config.mcpServers[name]) {
      config.mcpServers[name] = serverConfig;
      installed++;
    }
  }

  await writeClaudeDesktopConfig(config);
  return installed;
}

/**
 * Remove all ChittyOS MCP servers
 */
export async function uninstallChittyOsMcpServers(): Promise<number> {
  const config = await readClaudeDesktopConfig();
  if (!config.mcpServers) return 0;

  let removed = 0;
  for (const name of Object.keys(CHITTYOS_MCP_SERVERS)) {
    if (config.mcpServers[name]) {
      delete config.mcpServers[name];
      removed++;
    }
  }

  await writeClaudeDesktopConfig(config);
  return removed;
}

/**
 * Get Claude Desktop config status
 */
export async function getConfigStatus(): Promise<{
  configExists: boolean;
  configPath: string;
  serverCount: number;
  chittyOsServers: string[];
}> {
  const configPath = getClaudeDesktopConfigPath();
  const configExists = await fs.pathExists(configPath);

  const servers = await listMcpServers();
  const chittyOsServers = Object.keys(servers).filter(name => name.startsWith('chittyos-'));

  return {
    configExists,
    configPath,
    serverCount: Object.keys(servers).length,
    chittyOsServers
  };
}
