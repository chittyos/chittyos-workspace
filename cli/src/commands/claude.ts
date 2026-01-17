/**
 * Claude Command - CLAUDE.md file management
 */

import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';
import {
  listClaudeTemplates,
  renderTemplate,
  previewTemplate,
  type TemplateContext
} from '../lib/template-engine';

export interface ClaudeOptions {
  template?: string;
  path?: string;
  force?: boolean;
  preview?: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export async function claudeCommand(action?: string, options: ClaudeOptions = {}): Promise<void> {
  switch (action) {
    case 'init':
      await initClaudeMd(options);
      break;
    case 'template':
      await applyTemplate(options);
      break;
    case 'validate':
      await validateClaudeMd(options);
      break;
    case 'list':
      await listTemplates();
      break;
    default:
      await showClaudeHelp();
  }
}

async function showClaudeHelp(): Promise<void> {
  console.log(chalk.cyan('\nClaude Configuration Management\n'));
  console.log('Commands:');
  console.log('  chitty claude init         Create a new CLAUDE.md file');
  console.log('  chitty claude template     Apply a template to CLAUDE.md');
  console.log('  chitty claude validate     Validate CLAUDE.md structure');
  console.log('  chitty claude list         List available templates');
  console.log('\nOptions:');
  console.log('  -t, --template <name>      Template to use');
  console.log('  -p, --path <path>          Target directory');
  console.log('  -f, --force                Overwrite existing file');
  console.log('  --preview                  Preview without writing');
}

async function initClaudeMd(options: ClaudeOptions): Promise<void> {
  const spinner = ora();
  const targetDir = options.path || process.cwd();
  const claudeMdPath = path.join(targetDir, 'CLAUDE.md');

  // Check if CLAUDE.md already exists
  if (await fs.pathExists(claudeMdPath) && !options.force) {
    console.log(chalk.yellow('\n⚠ CLAUDE.md already exists'));
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'Overwrite existing CLAUDE.md?',
        default: false
      }
    ]);

    if (!overwrite) {
      console.log(chalk.gray('Cancelled'));
      return;
    }
  }

  // Detect project type
  const projectInfo = await detectProjectType(targetDir);

  // If template specified, use it directly
  if (options.template) {
    await createFromTemplate(options.template, projectInfo, claudeMdPath, options.preview);
    return;
  }

  // Interactive wizard
  console.log(chalk.cyan('\n📝 Create CLAUDE.md\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'serviceName',
      message: 'Service/Project name:',
      default: projectInfo.serviceName
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description:',
      default: projectInfo.description
    },
    {
      type: 'list',
      name: 'template',
      message: 'Template:',
      choices: [
        { name: 'Service (API + MCP)', value: 'service' },
        { name: 'Cloudflare Worker', value: 'worker' },
        { name: 'Minimal', value: 'minimal' }
      ],
      default: projectInfo.suggestedTemplate
    },
    {
      type: 'list',
      name: 'runtime',
      message: 'Runtime:',
      choices: ['Cloudflare Workers', 'Node.js', 'Deno'],
      default: projectInfo.runtime
    },
    {
      type: 'input',
      name: 'domain',
      message: 'Domain (optional):',
      default: projectInfo.domain
    },
    {
      type: 'checkbox',
      name: 'capabilities',
      message: 'Capabilities:',
      choices: [
        { name: 'API endpoints', value: 'api', checked: true },
        { name: 'MCP server', value: 'mcp', checked: projectInfo.hasMcp },
        { name: 'Documentation', value: 'docs' },
        { name: 'Health endpoint', value: 'health', checked: true }
      ]
    }
  ]);

  const context: TemplateContext = {
    serviceName: answers.serviceName,
    description: answers.description,
    runtime: answers.runtime,
    domain: answers.domain,
    packageManager: projectInfo.packageManager,
    hasApi: answers.capabilities.includes('api'),
    hasMcp: answers.capabilities.includes('mcp'),
    hasDocs: answers.capabilities.includes('docs'),
    hasHealth: answers.capabilities.includes('health')
  };

  await createFromTemplate(answers.template, context, claudeMdPath, options.preview);
}

async function createFromTemplate(
  templateName: string,
  context: TemplateContext,
  outputPath: string,
  preview?: boolean
): Promise<void> {
  const spinner = ora();

  try {
    spinner.start(`Generating CLAUDE.md from '${templateName}' template...`);

    const content = await renderTemplate(templateName, context);

    if (preview) {
      spinner.stop();
      console.log(chalk.cyan('\n--- Preview ---\n'));
      console.log(content);
      console.log(chalk.cyan('\n--- End Preview ---\n'));
      return;
    }

    await fs.writeFile(outputPath, content, 'utf-8');
    spinner.succeed(`Created ${outputPath}`);

    console.log(chalk.gray('\nNext steps:'));
    console.log(chalk.gray('  1. Review and customize the CLAUDE.md'));
    console.log(chalk.gray('  2. Add project-specific patterns and commands'));
    console.log(chalk.gray('  3. Run: chitty claude validate'));
  } catch (error: any) {
    spinner.fail(`Failed to create CLAUDE.md: ${error.message}`);
  }
}

async function applyTemplate(options: ClaudeOptions): Promise<void> {
  if (!options.template) {
    console.log(chalk.yellow('\nNo template specified'));
    console.log('Usage: chitty claude template -t <template-name>');
    console.log('\nAvailable templates:');
    await listTemplates();
    return;
  }

  const targetDir = options.path || process.cwd();
  const claudeMdPath = path.join(targetDir, 'CLAUDE.md');
  const projectInfo = await detectProjectType(targetDir);

  await createFromTemplate(options.template, projectInfo, claudeMdPath, options.preview);
}

async function validateClaudeMd(options: ClaudeOptions): Promise<void> {
  const targetDir = options.path || process.cwd();
  const claudeMdPath = path.join(targetDir, 'CLAUDE.md');

  if (!await fs.pathExists(claudeMdPath)) {
    console.log(chalk.red('\n✗ CLAUDE.md not found'));
    console.log(chalk.gray(`Expected at: ${claudeMdPath}`));
    console.log(chalk.gray('\nRun: chitty claude init'));
    return;
  }

  const spinner = ora('Validating CLAUDE.md...').start();

  try {
    const content = await fs.readFile(claudeMdPath, 'utf-8');
    const result = validateClaudeMdContent(content);

    spinner.stop();

    if (result.valid) {
      console.log(chalk.green('\n✓ CLAUDE.md is valid'));
    } else {
      console.log(chalk.red('\n✗ CLAUDE.md has issues'));
    }

    if (result.errors.length > 0) {
      console.log(chalk.red('\nErrors:'));
      result.errors.forEach(e => console.log(chalk.red(`  • ${e}`)));
    }

    if (result.warnings.length > 0) {
      console.log(chalk.yellow('\nWarnings:'));
      result.warnings.forEach(w => console.log(chalk.yellow(`  • ${w}`)));
    }

    if (result.suggestions.length > 0) {
      console.log(chalk.cyan('\nSuggestions:'));
      result.suggestions.forEach(s => console.log(chalk.gray(`  • ${s}`)));
    }
  } catch (error: any) {
    spinner.fail(`Validation failed: ${error.message}`);
  }
}

function validateClaudeMdContent(content: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    suggestions: []
  };

  // Check for title
  if (!content.match(/^#\s+\w+/m)) {
    result.errors.push('Missing title (should start with # Title)');
    result.valid = false;
  }

  // Check for required sections
  const requiredSections = ['## '];
  if (!content.includes('## ')) {
    result.errors.push('Missing sections (should have ## headings)');
    result.valid = false;
  }

  // Check for code blocks
  const codeBlockCount = (content.match(/```/g) || []).length;
  if (codeBlockCount % 2 !== 0) {
    result.errors.push('Unclosed code block');
    result.valid = false;
  }

  // Warnings
  if (!content.toLowerCase().includes('command')) {
    result.warnings.push('No commands section found');
  }

  if (!content.toLowerCase().includes('environment')) {
    result.warnings.push('No environment variables section found');
  }

  // Suggestions
  if (content.length < 500) {
    result.suggestions.push('CLAUDE.md is quite short - consider adding more details');
  }

  if (!content.includes('```bash')) {
    result.suggestions.push('Consider adding bash code examples');
  }

  if (!content.includes('chitty')) {
    result.suggestions.push('Consider documenting ChittyOS integration patterns');
  }

  return result;
}

async function listTemplates(): Promise<void> {
  console.log(chalk.cyan('\nAvailable CLAUDE.md Templates:\n'));

  const templates = await listClaudeTemplates();

  for (const template of templates) {
    console.log(chalk.white.bold(`  ${template.name}`));
    console.log(chalk.gray(`    ${template.description}`));
  }

  console.log(chalk.gray('\nUsage: chitty claude init -t <template-name>'));
}

interface ProjectInfo extends TemplateContext {
  suggestedTemplate: string;
}

async function detectProjectType(dir: string): Promise<ProjectInfo> {
  const info: ProjectInfo = {
    serviceName: path.basename(dir),
    description: '',
    runtime: 'Cloudflare Workers',
    packageManager: 'pnpm',
    suggestedTemplate: 'minimal',
    hasMcp: false,
    hasApi: false
  };

  // Check for package.json
  const pkgPath = path.join(dir, 'package.json');
  if (await fs.pathExists(pkgPath)) {
    try {
      const pkg = await fs.readJson(pkgPath);
      info.serviceName = pkg.name?.replace('@chittyos/', '') || info.serviceName;
      info.description = pkg.description || '';
    } catch {
      // Ignore
    }
  }

  // Check for wrangler.toml (Cloudflare Worker)
  if (await fs.pathExists(path.join(dir, 'wrangler.toml'))) {
    info.runtime = 'Cloudflare Workers';
    info.suggestedTemplate = 'worker';

    try {
      const wrangler = await fs.readFile(path.join(dir, 'wrangler.toml'), 'utf-8');
      const routeMatch = wrangler.match(/pattern\s*=\s*["']([^"']+)/);
      if (routeMatch) {
        info.domain = routeMatch[1].replace('/*', '');
      }
    } catch {
      // Ignore
    }
  }

  // Check for MCP-related files
  if (await fs.pathExists(path.join(dir, 'src', 'mcp')) ||
      await fs.pathExists(path.join(dir, 'mcp'))) {
    info.hasMcp = true;
    info.suggestedTemplate = 'service';
  }

  // Check for API-related files
  if (await fs.pathExists(path.join(dir, 'src', 'api')) ||
      await fs.pathExists(path.join(dir, 'api'))) {
    info.hasApi = true;
    info.suggestedTemplate = 'service';
  }

  // Detect package manager
  if (await fs.pathExists(path.join(dir, 'pnpm-lock.yaml'))) {
    info.packageManager = 'pnpm';
  } else if (await fs.pathExists(path.join(dir, 'yarn.lock'))) {
    info.packageManager = 'yarn';
  } else {
    info.packageManager = 'npm';
  }

  return info;
}
