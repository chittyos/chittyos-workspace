import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';

function getConfidenceColor(confidence: number) {
  if (confidence >= 70) return chalk.green.bold;
  if (confidence >= 50) return chalk.yellow.bold;
  if (confidence >= 30) return chalk.yellow.bold; // orange not available
  return chalk.red.bold;
}

export interface ProjectOptions {
  detect?: boolean;
  configure?: boolean;
  hooks?: boolean;
  link?: string;
}

export async function projectCommand(options: ProjectOptions = {}) {
  if (options.detect) {
    await detectProject();
  } else if (options.configure) {
    await configureProject();
  } else if (options.hooks) {
    await manageHooks();
  } else if (options.link) {
    await linkProject(options.link);
  } else {
    await showProjectMenu();
  }
}

async function showProjectMenu() {
  console.log(chalk.blue.bold('📁 ChittyOS Project Management\n'));

  const action = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '🔍 Detect Current Project', value: 'detect' },
        { name: '⚙️ Configure Project Settings', value: 'configure' },
        { name: '🪝 Manage Project Hooks', value: 'hooks' },
        { name: '🔗 Link to Existing Project', value: 'link' },
        { name: '📋 Show Project Status', value: 'status' }
      ]
    }
  ]);

  switch (action.action) {
    case 'detect':
      await detectProject();
      break;
    case 'configure':
      await configureProject();
      break;
    case 'hooks':
      await manageHooks();
      break;
    case 'link':
      const linkPath = await inquirer.prompt([
        {
          type: 'input',
          name: 'path',
          message: 'Enter project path to link:'
        }
      ]);
      await linkProject(linkPath.path);
      break;
    case 'status':
      await showProjectStatus();
      break;
  }
}

async function detectProject() {
  console.log(chalk.blue('🔍 Detecting ChittyOS Project\n'));

  const spinner = ora('Scanning for project indicators...').start();

  try {
    const cwd = process.cwd();
    const projectInfo = await scanForProject(cwd);

    if (projectInfo.detected) {
      spinner.succeed(`ChittyOS project detected (${projectInfo.confidence}% confidence)`);

      console.log(chalk.green('✅ Project Found!\n'));
      console.log(`   ${chalk.gray('Type:')} ${chalk.cyan(projectInfo.type)}`);
      console.log(`   ${chalk.gray('Name:')} ${chalk.cyan(projectInfo.name)}`);
      console.log(`   ${chalk.gray('Path:')} ${chalk.gray(projectInfo.path)}`);
      console.log(`   ${chalk.gray('Confidence:')} ${getConfidenceColor(projectInfo.confidence)}${projectInfo.confidence}%${chalk.reset()}`);

      if (projectInfo.features.length > 0) {
        console.log(`   ${chalk.gray('Features:')} ${projectInfo.features.join(', ')}`);
      }

      if (projectInfo.services.length > 0) {
        console.log(`   ${chalk.gray('Services:')} ${projectInfo.services.join(', ')}`);
      }

      if (projectInfo.indicators.length > 0) {
        console.log(`   ${chalk.gray('Indicators:')} ${projectInfo.indicators.slice(0, 3).join(', ')}${projectInfo.indicators.length > 3 ? ` (+${projectInfo.indicators.length - 3} more)` : ''}`);
      }

      // Show recommendations
      if (projectInfo.recommendations.length > 0) {
        console.log(chalk.yellow('\n💡 Recommendations:'));
        projectInfo.recommendations.forEach(rec => {
          console.log(`   ${chalk.gray('•')} ${rec}`);
        });
      }

      // Offer to configure hooks
      if (!projectInfo.hasHooks) {
        const setupHooks = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'setup',
            message: 'Set up ChittyOS hooks for this project?',
            default: true
          }
        ]);

        if (setupHooks.setup) {
          await setupProjectHooks(projectInfo);
        }
      }

      // Auto-link if this is a detected project but not explicitly configured
      if (projectInfo.confidence >= 50 && !await fs.pathExists('.chittyos/project.json')) {
        const autoLink = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'link',
            message: 'Automatically configure this as a ChittyOS project?',
            default: true
          }
        ]);

        if (autoLink.link) {
          await autoConfigureProject(projectInfo);
        }
      }

    } else {
      spinner.warn('No ChittyOS project detected');

      console.log(chalk.yellow('⚠️ No ChittyOS Project Found\n'));
      console.log(chalk.gray('Current directory does not appear to be a ChittyOS project.'));

      const action = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '🚀 Initialize new ChittyOS project here', value: 'init' },
            { name: '🔗 Link to existing ChittyOS project', value: 'link' },
            { name: '📁 Create .chittyos project config', value: 'config' },
            { name: '❌ Nothing, continue without project context', value: 'none' }
          ]
        }
      ]);

      switch (action.action) {
        case 'init':
          console.log(chalk.blue('\n🚀 Run: chittyos init [project-name]'));
          break;
        case 'link':
          await linkProject();
          break;
        case 'config':
          await createProjectConfig();
          break;
        case 'none':
          console.log(chalk.gray('Continuing without project context...'));
          // Still create a minimal marker to prevent Universal Intake System errors
          await createMinimalProjectMarker();
          break;
      }
    }

  } catch (error) {
    spinner.fail('Project detection failed');
    console.error(chalk.red('Error:'), error.message);
  }
}

async function scanForProject(projectPath: string): Promise<{
  detected: boolean;
  type: string;
  name: string;
  path: string;
  features: string[];
  services: string[];
  recommendations: string[];
  hasHooks: boolean;
  confidence: number;
  indicators: string[];
}> {
  const result = {
    detected: false,
    type: 'unknown',
    name: path.basename(projectPath),
    path: projectPath,
    features: [],
    services: [],
    recommendations: [],
    hasHooks: false,
    confidence: 0,
    indicators: []
  };

  let score = 0;

  // Check for package.json
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (await fs.pathExists(packageJsonPath)) {
    const packageJson = await fs.readJSON(packageJsonPath);

    // Check for ChittyOS dependencies
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const chittyOSPackages = Object.keys(deps).filter(dep => dep.startsWith('@chittyos/'));

    if (chittyOSPackages.length > 0 || deps['@chittyos/standard']) {
      result.detected = true;
      result.type = 'chittyos-service';
      score += 50;
      result.indicators.push('ChittyOS packages detected');

      if (packageJson.name) {
        result.name = packageJson.name;
      }

      // Detect features with scoring
      if (deps['@cloudflare/mcp-agent-api']) {
        result.features.push('AI Orchestration');
        score += 10;
        result.indicators.push('MCP Agent API');
      }
      if (deps['ws'] && deps['uuid']) {
        result.features.push('Context Bridge');
        score += 10;
        result.indicators.push('WebSocket/UUID deps');
      }
      if (deps['jest']) {
        result.features.push('QA Framework');
        score += 5;
        result.indicators.push('Jest testing');
      }
      if (await fs.pathExists(path.join(projectPath, 'wrangler.toml'))) {
        result.features.push('Cloudflare Workers');
        score += 15;
        result.indicators.push('Wrangler config');
      }
    }

    // Check for broader Node.js ecosystem indicators
    if (deps['express'] || deps['fastify'] || deps['koa']) {
      score += 5;
      result.indicators.push('Web framework');
    }

    // Check for ChittyOS naming patterns
    if (packageJson.name?.includes('chitty') || packageJson.name?.includes('mcp') || packageJson.name?.includes('bridge')) {
      score += 10;
      result.indicators.push('ChittyOS naming pattern');
    }
  }

  // Check for ChittyOS configuration files
  const configFiles = [
    '.chittyos.json',
    '.chittyos/project.json',
    '.chittyos/marker.json',
    'chittyos.config.js',
    'wrangler.toml'
  ];

  for (const configFile of configFiles) {
    if (await fs.pathExists(path.join(projectPath, configFile))) {
      result.detected = true;
      if (result.type === 'unknown') result.type = 'chittyos-project';
      score += configFile.includes('.chittyos') ? 25 : 15;
      result.indicators.push(`Config: ${configFile}`);
    }
  }

  // Check for service directories
  const serviceIndicators = [
    'src/services',
    'src/mcp-agents',
    'src/bridge',
    'tests/qa',
    'tests/security',
    'src/registry',
    'src/ai',
    'packages/cli'
  ];

  for (const indicator of serviceIndicators) {
    if (await fs.pathExists(path.join(projectPath, indicator))) {
      result.detected = true;
      score += 10;
      const serviceName = indicator.split('/')[1];
      if (serviceName && !result.services.includes(serviceName)) {
        result.services.push(serviceName);
      }
      result.indicators.push(`Directory: ${indicator}`);
    }
  }

  // Check for environment files (common in ChittyOS projects)
  const envFiles = ['.env', '.env.example', '.env.local', '.env.production'];
  for (const envFile of envFiles) {
    if (await fs.pathExists(path.join(projectPath, envFile))) {
      score += 3;
      result.indicators.push(`Env: ${envFile}`);
    }
  }

  // Check for Docker/deployment files
  const deployFiles = ['Dockerfile', 'docker-compose.yml', 'deploy.sh', 'scripts/deploy.sh'];
  for (const deployFile of deployFiles) {
    if (await fs.pathExists(path.join(projectPath, deployFile))) {
      score += 5;
      result.indicators.push(`Deploy: ${deployFile}`);
    }
  }

  // Check for hooks
  const hookFiles = [
    '.chittyos/hooks',
    'scripts/hooks',
    '.hooks',
    '.git/hooks'
  ];

  for (const hookPath of hookFiles) {
    if (await fs.pathExists(path.join(projectPath, hookPath))) {
      result.hasHooks = true;
      score += 5;
      result.indicators.push(`Hooks: ${hookPath}`);
      break;
    }
  }

  // Check for git repository (lower score but still indicator)
  if (await fs.pathExists(path.join(projectPath, '.git'))) {
    score += 2;
    result.indicators.push('Git repository');
  }

  // Set confidence based on score
  result.confidence = Math.min(score, 100);

  // Consider it detected if confidence >= 15 (flexible threshold)
  if (score >= 15 && !result.detected) {
    result.detected = true;
    result.type = 'chittyos-compatible';
  }

  // Generate recommendations
  if (result.detected) {
    if (!result.hasHooks) {
      result.recommendations.push('Set up ChittyOS hooks for automation');
    }

    if (!result.features.includes('QA Framework')) {
      result.recommendations.push('Add QA framework for testing');
    }

    if (!await fs.pathExists(path.join(projectPath, '.env.example'))) {
      result.recommendations.push('Create .env.example for configuration');
    }

    if (!await fs.pathExists(path.join(projectPath, 'README.md'))) {
      result.recommendations.push('Add README.md documentation');
    }

    if (result.confidence < 50) {
      result.recommendations.push('Strengthen ChittyOS integration');
    }
  } else {
    // Always offer minimal setup option for Universal Intake System
    result.recommendations.push('Create minimal ChittyOS project marker to prevent "no project" errors');
  }

  return result;
}

async function configureProject() {
  console.log(chalk.blue('⚙️ Configure ChittyOS Project\n'));

  const config = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Project name:',
      default: path.basename(process.cwd())
    },
    {
      type: 'list',
      name: 'type',
      message: 'Project type:',
      choices: [
        'chittyos-service',
        'chittyos-app',
        'chittyos-infrastructure',
        'chittyos-qa'
      ]
    },
    {
      type: 'checkbox',
      name: 'features',
      message: 'Enabled features:',
      choices: [
        { name: 'Service Registry Integration', value: 'registry' },
        { name: 'AI Orchestration', value: 'ai' },
        { name: 'Context Bridge', value: 'bridge' },
        { name: 'QA Framework', value: 'qa' },
        { name: 'Cloudflare Workers', value: 'cloudflare' },
        { name: 'Health Monitoring', value: 'health' }
      ]
    },
    {
      type: 'input',
      name: 'registryUrl',
      message: 'Registry URL:',
      default: 'http://localhost:3001'
    },
    {
      type: 'confirm',
      name: 'setupHooks',
      message: 'Set up project hooks?',
      default: true
    }
  ]);

  const spinner = ora('Creating project configuration...').start();

  try {
    // Create .chittyos directory
    await fs.ensureDir('.chittyos');

    // Create project config
    const projectConfig = {
      name: config.name,
      type: config.type,
      features: config.features,
      registry: {
        url: config.registryUrl
      },
      created: new Date().toISOString(),
      version: '1.0.0'
    };

    await fs.writeJSON('.chittyos/project.json', projectConfig, { spaces: 2 });

    if (config.setupHooks) {
      await setupProjectHooks({ type: config.type, features: config.features });
    }

    spinner.succeed('Project configuration created');

    console.log(chalk.green('\n✅ Project Configured Successfully!'));
    console.log(`   ${chalk.gray('Config:')} ${chalk.blue('.chittyos/project.json')}`);
    console.log(`   ${chalk.gray('Type:')} ${chalk.cyan(config.type)}`);
    console.log(`   ${chalk.gray('Features:')} ${config.features.join(', ')}`);

  } catch (error) {
    spinner.fail('Configuration failed');
    console.error(chalk.red('Error:'), error.message);
  }
}

async function manageHooks() {
  console.log(chalk.blue('🪝 Manage ChittyOS Project Hooks\n'));

  const action = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Hook management action:',
      choices: [
        { name: '📋 List current hooks', value: 'list' },
        { name: '➕ Add new hook', value: 'add' },
        { name: '🔧 Configure existing hook', value: 'configure' },
        { name: '❌ Remove hook', value: 'remove' },
        { name: '🧪 Test hooks', value: 'test' }
      ]
    }
  ]);

  switch (action.action) {
    case 'list':
      await listHooks();
      break;
    case 'add':
      await addHook();
      break;
    case 'configure':
      await configureHooks();
      break;
    case 'remove':
      await removeHook();
      break;
    case 'test':
      await testHooks();
      break;
  }
}

async function setupProjectHooks(projectInfo: any) {
  console.log(chalk.blue('🪝 Setting up ChittyOS hooks...\n'));

  await fs.ensureDir('.chittyos/hooks');

  // Create basic hooks based on project type
  const hooks = {
    'pre-commit': `#!/bin/bash
# ChittyOS pre-commit hook
echo "🔍 Running ChittyOS pre-commit checks..."

# Run tests if available
if [ -f "package.json" ] && npm run test:qa:smoke --silent > /dev/null 2>&1; then
  echo "✅ QA smoke tests passed"
else
  echo "⚠️  No QA tests found or tests failed"
fi

# Check service health if registry feature enabled
${projectInfo.features?.includes('registry') ? `
if command -v chittyos &> /dev/null; then
  chittyos status --json > /dev/null 2>&1 || echo "⚠️  Registry not accessible"
fi
` : ''}

echo "✅ Pre-commit checks completed"
`,

    'post-deploy': `#!/bin/bash
# ChittyOS post-deploy hook
echo "🚀 Running ChittyOS post-deploy checks..."

# Verify service health
${projectInfo.features?.includes('registry') ? `
if command -v chittyos &> /dev/null; then
  chittyos services --health-check $CHITTYOS_SERVICE_NAME
fi
` : ''}

# Run integration tests
${projectInfo.features?.includes('qa') ? `
if [ -f "package.json" ]; then
  npm run test:qa:integration || echo "⚠️  Integration tests failed"
fi
` : ''}

echo "✅ Post-deploy checks completed"
`,

    'project-detect': `#!/bin/bash
# ChittyOS project detection hook
echo "📁 ChittyOS Project: $(basename $PWD)"
echo "🔧 Type: ${projectInfo.type || 'chittyos-service'}"
echo "🌟 Features: ${projectInfo.features?.join(', ') || 'basic'}"

# Set environment for other tools
export CHITTYOS_PROJECT_DETECTED=true
export CHITTYOS_PROJECT_TYPE="${projectInfo.type || 'chittyos-service'}"
export CHITTYOS_PROJECT_NAME="$(basename $PWD)"
`
  };

  for (const [hookName, hookContent] of Object.entries(hooks)) {
    const hookPath = `.chittyos/hooks/${hookName}`;
    await fs.writeFile(hookPath, hookContent);
    await fs.chmod(hookPath, 0o755); // Make executable
  }

  console.log(chalk.green('✅ Project hooks created successfully!'));
  console.log(chalk.gray('\nCreated hooks:'));
  Object.keys(hooks).forEach(hook => {
    console.log(`   • ${chalk.cyan(hook)}`);
  });
}

async function createProjectConfig() {
  console.log(chalk.blue('📁 Creating minimal project configuration...\n'));

  const config = {
    name: path.basename(process.cwd()),
    type: 'chittyos-compatible',
    created: new Date().toISOString(),
    description: 'ChittyOS-compatible project'
  };

  await fs.ensureDir('.chittyos');
  await fs.writeJSON('.chittyos/project.json', config, { spaces: 2 });

  console.log(chalk.green('✅ Created .chittyos/project.json'));
  console.log(chalk.gray('This directory is now recognized as ChittyOS-compatible'));
}

async function linkProject(projectPath?: string) {
  if (!projectPath) {
    const input = await inquirer.prompt([
      {
        type: 'input',
        name: 'path',
        message: 'Enter path to ChittyOS project:',
        validate: async (input) => {
          try {
            const fullPath = path.resolve(input);
            const exists = await fs.pathExists(fullPath);
            if (!exists) return 'Path does not exist';

            const projectInfo = await scanForProject(fullPath);
            if (!projectInfo.detected) return 'Not a ChittyOS project';

            return true;
          } catch {
            return 'Invalid path';
          }
        }
      }
    ]);
    projectPath = input.path;
  }

  const spinner = ora('Linking to ChittyOS project...').start();

  try {
    const fullPath = path.resolve(projectPath!);
    const projectInfo = await scanForProject(fullPath);

    if (!projectInfo.detected) {
      throw new Error('Target is not a ChittyOS project');
    }

    // Create symlink or reference
    await fs.ensureDir('.chittyos');
    const linkConfig = {
      linkedTo: fullPath,
      linkedAt: new Date().toISOString(),
      projectInfo
    };

    await fs.writeJSON('.chittyos/link.json', linkConfig, { spaces: 2 });

    spinner.succeed('Project linked successfully');

    console.log(chalk.green('\n✅ Project Linked!'));
    console.log(`   ${chalk.gray('Linked to:')} ${chalk.blue(fullPath)}`);
    console.log(`   ${chalk.gray('Project:')} ${chalk.cyan(projectInfo.name)}`);
    console.log(`   ${chalk.gray('Type:')} ${chalk.cyan(projectInfo.type)}`);

  } catch (error) {
    spinner.fail('Failed to link project');
    console.error(chalk.red('Error:'), error.message);
  }
}

async function showProjectStatus() {
  console.log(chalk.blue.bold('📊 ChittyOS Project Status\n'));

  const cwd = process.cwd();
  const projectInfo = await scanForProject(cwd);

  if (projectInfo.detected) {
    console.log(chalk.green('✅ ChittyOS Project Detected\n'));
    console.log(`   ${chalk.gray('Name:')} ${chalk.cyan(projectInfo.name)}`);
    console.log(`   ${chalk.gray('Type:')} ${chalk.cyan(projectInfo.type)}`);
    console.log(`   ${chalk.gray('Path:')} ${chalk.gray(projectInfo.path)}`);

    if (projectInfo.features.length > 0) {
      console.log(`   ${chalk.gray('Features:')} ${projectInfo.features.join(', ')}`);
    }

    if (projectInfo.services.length > 0) {
      console.log(`   ${chalk.gray('Services:')} ${projectInfo.services.join(', ')}`);
    }

    console.log(`   ${chalk.gray('Hooks:')} ${projectInfo.hasHooks ? chalk.green('Configured') : chalk.yellow('Not configured')}`);

    // Check for link
    const linkPath = path.join(cwd, '.chittyos/link.json');
    if (await fs.pathExists(linkPath)) {
      const linkConfig = await fs.readJSON(linkPath);
      console.log(`   ${chalk.gray('Linked to:')} ${chalk.blue(linkConfig.linkedTo)}`);
    }

  } else {
    console.log(chalk.yellow('⚠️ No ChittyOS Project\n'));
    console.log(chalk.gray('This directory is not a ChittyOS project.'));
    console.log(chalk.blue('\n💡 To fix this:'));
    console.log(chalk.gray('   • Run: chittyos init [project-name]'));
    console.log(chalk.gray('   • Or: chittyos project --configure'));
  }
}

// Placeholder implementations for additional hook functions
async function listHooks() {
  console.log(chalk.green('Hook listing - Feature coming soon!'));
}

async function addHook() {
  console.log(chalk.green('Add hook - Feature coming soon!'));
}

async function configureHooks() {
  console.log(chalk.green('Configure hooks - Feature coming soon!'));
}

async function removeHook() {
  console.log(chalk.green('Remove hook - Feature coming soon!'));
}

async function testHooks() {
  console.log(chalk.green('Test hooks - Feature coming soon!'));
}

async function autoConfigureProject(projectInfo: any) {
  console.log(chalk.blue('🔧 Auto-configuring ChittyOS project...\n'));

  const spinner = ora('Creating project configuration...').start();

  try {
    await fs.ensureDir('.chittyos');

    // Create comprehensive project config based on detection
    const projectConfig = {
      name: projectInfo.name,
      type: projectInfo.type,
      features: projectInfo.features,
      services: projectInfo.services,
      confidence: projectInfo.confidence,
      indicators: projectInfo.indicators,
      autoConfigured: true,
      created: new Date().toISOString(),
      version: '1.0.0',
      registry: {
        url: 'http://localhost:3001'
      }
    };

    await fs.writeJSON('.chittyos/project.json', projectConfig, { spaces: 2 });

    // Set up hooks automatically
    await setupProjectHooks(projectInfo);

    spinner.succeed('Project auto-configured successfully');

    console.log(chalk.green('\n✅ ChittyOS Project Auto-Configured!'));
    console.log(`   ${chalk.gray('Config:')} ${chalk.blue('.chittyos/project.json')}`);
    console.log(`   ${chalk.gray('Type:')} ${chalk.cyan(projectInfo.type)}`);
    console.log(`   ${chalk.gray('Features:')} ${projectInfo.features.join(', ')}`);
    console.log(`   ${chalk.gray('Confidence:')} ${getConfidenceColor(projectInfo.confidence)}${projectInfo.confidence}%${chalk.reset()}`);

  } catch (error) {
    spinner.fail('Auto-configuration failed');
    console.error(chalk.red('Error:'), error.message);
  }
}

async function createMinimalProjectMarker() {
  console.log(chalk.blue('📝 Creating minimal ChittyOS project marker...\n'));

  const config = {
    name: path.basename(process.cwd()),
    type: 'chittyos-external',
    description: 'External project with ChittyOS integration',
    created: new Date().toISOString(),
    version: '1.0.0',
    marker: true,
    purpose: 'Prevent Universal Intake System "no project" errors'
  };

  try {
    await fs.ensureDir('.chittyos');
    await fs.writeJSON('.chittyos/marker.json', config, { spaces: 2 });

    // Create a simple hook for project detection
    const detectHook = `#!/bin/bash
# ChittyOS External Project Detection Hook
export CHITTYOS_PROJECT_DETECTED=true
export CHITTYOS_PROJECT_TYPE="chittyos-external"
export CHITTYOS_PROJECT_NAME="$(basename $PWD)"
export CHITTYOS_PROJECT_MARKER=true

# Prevent Universal Intake System from storing in general
echo "📁 ChittyOS External Project: $(basename $PWD)"
echo "🔧 Type: chittyos-external (marker)"
`;

    await fs.ensureDir('.chittyos/hooks');
    await fs.writeFile('.chittyos/hooks/project-detect', detectHook);
    await fs.chmod('.chittyos/hooks/project-detect', 0o755);

    console.log(chalk.green('✅ Minimal project marker created'));
    console.log(chalk.gray(`   • Created: ${chalk.blue('.chittyos/marker.json')}`));
    console.log(chalk.gray(`   • Created: ${chalk.blue('.chittyos/hooks/project-detect')}`));
    console.log(chalk.gray('   • Universal Intake System will now detect project context'));

  } catch (error) {
    console.error(chalk.red('Failed to create project marker:'), error.message);
  }
}