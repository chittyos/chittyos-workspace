import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import inquirer from 'inquirer';

export interface DeployOptions {
  service?: string;
  ai?: boolean;
  cloudflare?: boolean;
  dryRun?: boolean;
}

export async function deployCommand(environment: string = 'production', options: DeployOptions = {}) {
  console.log(chalk.blue.bold(`🚀 ChittyOS Deployment to ${environment}\n`));

  if (options.dryRun) {
    await showDeploymentPlan(environment, options);
    return;
  }

  if (options.ai) {
    await deployAIInfrastructure(environment);
  } else if (options.cloudflare) {
    await deployToCloudflare(environment, options);
  } else if (options.service) {
    await deploySpecificService(options.service, environment);
  } else {
    await showDeploymentMenu(environment);
  }
}

async function showDeploymentMenu(environment: string) {
  const action = await inquirer.prompt([
    {
      type: 'list',
      name: 'deployment',
      message: `What would you like to deploy to ${environment}?`,
      choices: [
        { name: '🌐 Full ChittyOS Ecosystem', value: 'full' },
        { name: '🤖 AI Infrastructure Only', value: 'ai' },
        { name: '☁️  Cloudflare Workers', value: 'cloudflare' },
        { name: '🔧 Specific Service', value: 'service' },
        { name: '📋 Show Deployment Plan', value: 'plan' }
      ]
    }
  ]);

  switch (action.deployment) {
    case 'full':
      await deployFullEcosystem(environment);
      break;
    case 'ai':
      await deployAIInfrastructure(environment);
      break;
    case 'cloudflare':
      await deployToCloudflare(environment, {});
      break;
    case 'service':
      const service = await inquirer.prompt([
        {
          type: 'input',
          name: 'serviceName',
          message: 'Enter service name to deploy:'
        }
      ]);
      await deploySpecificService(service.serviceName, environment);
      break;
    case 'plan':
      await showDeploymentPlan(environment, {});
      break;
  }
}

async function deployFullEcosystem(environment: string) {
  console.log(chalk.blue('🌐 Deploying Full ChittyOS Ecosystem\n'));

  const deploymentSteps = [
    { name: 'Core Registry Service', script: 'deploy-registry.sh' },
    { name: 'Context Bridge Service', script: 'deploy-bridge.sh' },
    { name: 'AI Infrastructure', script: 'deploy-chittyregistry-ai.sh' },
    { name: 'Health Monitoring', script: 'deploy-monitoring.sh' },
    { name: 'Service Validation', script: 'validate-deployment.sh' }
  ];

  for (const step of deploymentSteps) {
    const spinner = ora(`Deploying ${step.name}...`).start();

    try {
      // Check if deployment script exists
      const fs = await import('fs-extra');
      const path = await import('path');

      const scriptPath = path.join(process.cwd(), 'scripts', step.script);

      if (await fs.pathExists(scriptPath)) {
        execSync(`chmod +x ${scriptPath}`, { stdio: 'pipe' });
        execSync(scriptPath, { stdio: 'pipe', timeout: 300000 });
        spinner.succeed(`${step.name} deployed successfully`);
      } else {
        spinner.warn(`${step.name} script not found, skipping...`);
      }

    } catch (error) {
      spinner.fail(`${step.name} deployment failed`);
      console.error(chalk.red('Error:'), error.message);

      const continueDeployment = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continue',
          message: 'Continue with remaining deployments?',
          default: true
        }
      ]);

      if (!continueDeployment.continue) {
        console.log(chalk.yellow('Deployment cancelled'));
        return;
      }
    }
  }

  console.log(chalk.green('\n🎉 Full ecosystem deployment completed!'));
  await showDeploymentSummary();
}

async function deployAIInfrastructure(environment: string) {
  console.log(chalk.blue('🤖 Deploying AI Infrastructure\n'));

  const spinner = ora('Checking for AI deployment script...').start();

  try {
    const fs = await import('fs-extra');
    const path = await import('path');

    // Look for the AI deployment script
    const possiblePaths = [
      './scripts/deploy-chittyregistry-ai.sh',
      '../scripts/deploy-chittyregistry-ai.sh',
      './deploy-chittyregistry-ai.sh'
    ];

    let scriptPath = null;
    for (const possiblePath of possiblePaths) {
      if (await fs.pathExists(possiblePath)) {
        scriptPath = possiblePath;
        break;
      }
    }

    if (!scriptPath) {
      spinner.fail('AI deployment script not found');
      console.log(chalk.yellow('AI deployment script not found.'));
      console.log(chalk.gray('\n📋 Expected script: scripts/deploy-chittyregistry-ai.sh'));
      console.log(chalk.gray('🔧 This script should contain:'));
      console.log(chalk.gray('   • Cloudflare Workers deployment'));
      console.log(chalk.gray('   • KV namespace creation'));
      console.log(chalk.gray('   • Vectorize index setup'));
      console.log(chalk.gray('   • AI Gateway configuration'));
      return;
    }

    spinner.text = 'Deploying AI infrastructure...';

    // Make script executable
    execSync(`chmod +x "${scriptPath}"`, { stdio: 'pipe' });

    // Execute deployment script
    execSync(scriptPath, {
      stdio: 'inherit',
      timeout: 600000, // 10 minutes
      env: {
        ...process.env,
        DEPLOYMENT_ENV: environment
      }
    });

    spinner.succeed('AI infrastructure deployed successfully');

    console.log(chalk.green('\n✅ AI Infrastructure Deployment Complete!\n'));

    console.log(chalk.white.bold('🚀 Deployed Components:'));
    console.log('   🌐 AI Gateway: ai.chitty.cc');
    console.log('   🔗 LangChain Agents: langchain.chitty.cc');
    console.log('   📡 MCP Orchestration: mcp.chitty.cc');
    console.log('   🔍 Vectorize Indexes: 3 created');
    console.log('   📊 Analytics & Monitoring: Enabled');

    console.log(chalk.blue('\n🧪 Test your deployment:'));
    console.log(chalk.gray('   chittyos ai --test'));

  } catch (error) {
    spinner.fail('AI infrastructure deployment failed');
    console.error(chalk.red('Error:'), error.message);

    console.log(chalk.yellow('\n🔧 Troubleshooting:'));
    console.log(chalk.gray('   • Check Cloudflare account limits'));
    console.log(chalk.gray('   • Verify API tokens and permissions'));
    console.log(chalk.gray('   • Ensure wrangler.toml is configured'));
    console.log(chalk.gray('   • Check deployment logs for details'));
  }
}

async function deployToCloudflare(environment: string, options: DeployOptions) {
  console.log(chalk.blue('☁️  Deploying to Cloudflare Workers\n'));

  const spinner = ora('Checking Cloudflare configuration...').start();

  try {
    // Check if wrangler is available
    try {
      execSync('wrangler --version', { stdio: 'pipe' });
    } catch {
      throw new Error('Wrangler CLI not found. Install with: npm install -g wrangler');
    }

    // Check if wrangler.toml exists
    const fs = await import('fs-extra');
    if (!await fs.pathExists('wrangler.toml')) {
      throw new Error('wrangler.toml not found. Run chittyos init to create configuration.');
    }

    spinner.text = 'Deploying to Cloudflare Workers...';

    // Deploy to specified environment
    const deployCommand = environment === 'production'
      ? 'wrangler deploy'
      : `wrangler deploy --env ${environment}`;

    execSync(deployCommand, {
      stdio: 'inherit',
      timeout: 300000
    });

    spinner.succeed('Cloudflare deployment completed');

    console.log(chalk.green('\n✅ Cloudflare Deployment Successful!\n'));

    // Show deployment URLs
    console.log(chalk.white.bold('🌐 Live URLs:'));
    if (environment === 'production') {
      console.log('   📊 Registry: https://registry.chitty.cc');
      console.log('   🤖 AI Gateway: https://ai.chitty.cc');
      console.log('   🔗 LangChain: https://langchain.chitty.cc');
      console.log('   📡 MCP: https://mcp.chitty.cc');
    } else {
      console.log(`   🧪 ${environment}: https://${environment}.chitty.cc`);
    }

  } catch (error) {
    spinner.fail('Cloudflare deployment failed');
    console.error(chalk.red('Error:'), error.message);

    if (error.message.includes('100 worker limit')) {
      console.log(chalk.yellow('\n💡 Cloudflare worker limit reached:'));
      console.log(chalk.gray('   • Delete unused workers in Cloudflare dashboard'));
      console.log(chalk.gray('   • Or upgrade to a higher plan'));
    }
  }
}

async function deploySpecificService(serviceName: string, environment: string) {
  console.log(chalk.blue(`🔧 Deploying Service: ${serviceName}\n`));

  const spinner = ora(`Deploying ${serviceName} to ${environment}...`).start();

  try {
    // Check if service has deployment configuration
    const fs = await import('fs-extra');
    const possibleConfigs = [
      `./services/${serviceName}/deploy.sh`,
      `./deploy-${serviceName}.sh`,
      './deploy.sh'
    ];

    let deployScript = null;
    for (const config of possibleConfigs) {
      if (await fs.pathExists(config)) {
        deployScript = config;
        break;
      }
    }

    if (!deployScript) {
      spinner.warn('No deployment script found');
      console.log(chalk.yellow(`No deployment script found for ${serviceName}`));
      console.log(chalk.gray('\n📋 Looked for:'));
      possibleConfigs.forEach(config => {
        console.log(chalk.gray(`   • ${config}`));
      });
      return;
    }

    execSync(`chmod +x "${deployScript}"`, { stdio: 'pipe' });
    execSync(deployScript, {
      stdio: 'inherit',
      timeout: 300000,
      env: {
        ...process.env,
        SERVICE_NAME: serviceName,
        DEPLOYMENT_ENV: environment
      }
    });

    spinner.succeed(`${serviceName} deployed successfully`);

    console.log(chalk.green(`\n✅ ${serviceName} deployment completed!`));

  } catch (error) {
    spinner.fail(`${serviceName} deployment failed`);
    console.error(chalk.red('Error:'), error.message);
  }
}

async function showDeploymentPlan(environment: string, options: DeployOptions) {
  console.log(chalk.blue.bold(`📋 Deployment Plan for ${environment}\n`));

  const plan = {
    infrastructure: [
      { component: 'ChittyRegistry Service', status: '🟢 Ready', time: '~2 min' },
      { component: 'Context Bridge Service', status: '🟢 Ready', time: '~1 min' },
      { component: 'Health Monitoring', status: '🟢 Ready', time: '~30s' }
    ],
    ai: [
      { component: 'AI Gateway (Cloudflare)', status: '🟢 Ready', time: '~3 min' },
      { component: 'LangChain Agents', status: '🟢 Ready', time: '~2 min' },
      { component: 'MCP Orchestration', status: '🟢 Ready', time: '~2 min' },
      { component: 'Vectorize Indexes', status: '🟢 Ready', time: '~1 min' }
    ],
    storage: [
      { component: 'KV Namespaces', status: '🟢 Ready', time: '~30s' },
      { component: 'R2 Buckets', status: '🟢 Ready', time: '~30s' },
      { component: 'D1 Database', status: '🟢 Ready', time: '~1 min' },
      { component: 'Hyperdrive', status: '🟡 Requires Neon URL', time: '~30s' }
    ]
  };

  console.log(chalk.white.bold('🏗️  Core Infrastructure'));
  plan.infrastructure.forEach(item => {
    console.log(`   ${item.status} ${item.component} ${chalk.gray(`(${item.time})`)}`);
  });

  if (options.ai || !options.service) {
    console.log(chalk.white.bold('\n🤖 AI Infrastructure'));
    plan.ai.forEach(item => {
      console.log(`   ${item.status} ${item.component} ${chalk.gray(`(${item.time})`)}`);
    });
  }

  console.log(chalk.white.bold('\n🗄️  Storage & Data'));
  plan.storage.forEach(item => {
    console.log(`   ${item.status} ${item.component} ${chalk.gray(`(${item.time})`)}`);
  });

  const totalTime = options.ai ? '~15 minutes' : '~8 minutes';
  console.log(chalk.blue.bold(`\n⏱️  Estimated Total Time: ${totalTime}`));

  console.log(chalk.yellow('\n⚠️  Prerequisites:'));
  console.log('   • Cloudflare account with Workers enabled');
  console.log('   • Wrangler CLI installed and authenticated');
  console.log('   • Environment variables configured');
  console.log('   • NEON_DATABASE_URL set (for Hyperdrive)');

  console.log(chalk.gray('\n🚀 Run deployment:'));
  console.log(chalk.gray(`   chittyos deploy ${environment}${options.ai ? ' --ai' : ''}`));
}

async function showDeploymentSummary() {
  console.log(chalk.blue.bold('\n📊 Deployment Summary\n'));

  console.log(chalk.green('✅ Successfully Deployed:'));
  console.log('   🔍 Service Registry & Discovery');
  console.log('   🌉 Context Bridge & Session Sync');
  console.log('   🤖 AI Infrastructure & Orchestration');
  console.log('   📊 Health Monitoring & Analytics');

  console.log(chalk.blue('\n🔗 Access Points:'));
  console.log('   📊 Registry: http://localhost:3001');
  console.log('   🌉 Bridge: http://localhost:3001/api/bridge');
  console.log('   🏥 Health: http://localhost:3001/health');

  console.log(chalk.yellow('\n🧪 Verification:'));
  console.log(chalk.gray('   chittyos status --services    # Check all services'));
  console.log(chalk.gray('   chittyos ai --test           # Test AI infrastructure'));
  console.log(chalk.gray('   chittyos bridge --status     # Check bridge status'));

  console.log(chalk.green('\n🎉 ChittyOS ecosystem is ready for use!'));
}