/**
 * Discover Command - Command/skill/agent discovery
 */

import chalk from 'chalk';
import ora from 'ora';

export interface DiscoverOptions {
  commands?: boolean;
  skills?: boolean;
  agents?: boolean;
  tools?: boolean;
  json?: boolean;
}

interface McpTool {
  name: string;
  service: string;
  description: string;
}

interface DiscoveryResult {
  tools: McpTool[];
  commands: string[];
  skills: string[];
  agents: string[];
}

export async function discoverCommand(options: DiscoverOptions = {}): Promise<void> {
  // If no specific option, show all
  const showAll = !options.commands && !options.skills && !options.agents && !options.tools;

  const result: DiscoveryResult = {
    tools: [],
    commands: [],
    skills: [],
    agents: []
  };

  const spinner = ora('Discovering available resources...').start();

  try {
    // Discover MCP tools
    if (showAll || options.tools) {
      result.tools = await discoverMcpTools();
    }

    // Discover CLI commands
    if (showAll || options.commands) {
      result.commands = discoverCliCommands();
    }

    // Discover skills (placeholder for future)
    if (showAll || options.skills) {
      result.skills = await discoverSkills();
    }

    // Discover agents (placeholder for future)
    if (showAll || options.agents) {
      result.agents = await discoverAgents();
    }

    spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // Display results
    displayDiscoveryResults(result, options);
  } catch (error: any) {
    spinner.fail(`Discovery failed: ${error.message}`);
  }
}

async function discoverMcpTools(): Promise<McpTool[]> {
  try {
    const response = await fetch('https://mcp.chitty.cc/tools', {
      headers: { 'User-Agent': 'ChittyOS-CLI/1.0.0' },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json() as { tools?: McpTool[] };
    return data.tools || [];
  } catch {
    return [];
  }
}

function discoverCliCommands(): string[] {
  return [
    'chitty init',
    'chitty status',
    'chitty deploy',
    'chitty services',
    'chitty ai',
    'chitty bridge',
    'chitty project',
    'chitty trust',
    'chitty dev',
    'chitty mcp',
    'chitty claude',
    'chitty config',
    'chitty discover',
    'chitty cicd'
  ];
}

async function discoverSkills(): Promise<string[]> {
  // Query ChittyConnect for available skills
  try {
    const response = await fetch('https://connect.chitty.cc/api/skills', {
      headers: { 'User-Agent': 'ChittyOS-CLI/1.0.0' },
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      const data = await response.json() as { skills?: string[] };
      return data.skills || [];
    }
  } catch {
    // Fallback to static list
  }

  return [
    'code-review',
    'commit',
    'feature-dev',
    'frontend-design',
    'review-pr'
  ];
}

async function discoverAgents(): Promise<string[]> {
  // Query for available agents
  try {
    const response = await fetch('https://connect.chitty.cc/api/agents', {
      headers: { 'User-Agent': 'ChittyOS-CLI/1.0.0' },
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      const data = await response.json() as { agents?: string[] };
      return data.agents || [];
    }
  } catch {
    // Fallback to static list
  }

  return [
    'Explore',
    'Plan',
    'Bash',
    'code-reviewer',
    'code-explorer',
    'code-architect'
  ];
}

function displayDiscoveryResults(result: DiscoveryResult, options: DiscoverOptions): void {
  const showAll = !options.commands && !options.skills && !options.agents && !options.tools;

  console.log(chalk.cyan('\n🔍 Discovery Results\n'));

  // CLI Commands
  if (showAll || options.commands) {
    console.log(chalk.white.bold('CLI Commands:'));
    for (const cmd of result.commands) {
      console.log(chalk.gray(`  ${cmd}`));
    }
    console.log();
  }

  // MCP Tools
  if ((showAll || options.tools) && result.tools.length > 0) {
    console.log(chalk.white.bold(`MCP Tools (${result.tools.length}):`));

    // Group by service
    const byService = new Map<string, McpTool[]>();
    for (const tool of result.tools) {
      const service = tool.service || 'unknown';
      if (!byService.has(service)) {
        byService.set(service, []);
      }
      byService.get(service)!.push(tool);
    }

    for (const [service, tools] of byService) {
      console.log(chalk.blue(`  ${service}:`));
      for (const tool of tools.slice(0, 5)) {
        console.log(chalk.gray(`    • ${tool.name}`));
        if (tool.description) {
          console.log(chalk.gray(`      ${tool.description.slice(0, 60)}${tool.description.length > 60 ? '...' : ''}`));
        }
      }
      if (tools.length > 5) {
        console.log(chalk.gray(`    ... and ${tools.length - 5} more`));
      }
    }
    console.log();
  } else if (showAll || options.tools) {
    console.log(chalk.white.bold('MCP Tools:'));
    console.log(chalk.yellow('  Could not fetch tools from mcp.chitty.cc'));
    console.log(chalk.gray('  Ensure the MCP gateway is running'));
    console.log();
  }

  // Skills
  if (showAll || options.skills) {
    console.log(chalk.white.bold('Skills:'));
    for (const skill of result.skills) {
      console.log(chalk.gray(`  /${skill}`));
    }
    console.log();
  }

  // Agents
  if (showAll || options.agents) {
    console.log(chalk.white.bold('Agents:'));
    for (const agent of result.agents) {
      console.log(chalk.gray(`  ${agent}`));
    }
    console.log();
  }

  // Summary
  const total = result.commands.length + result.tools.length + result.skills.length + result.agents.length;
  console.log(chalk.cyan(`Total: ${total} resources discovered`));
}
