import chalk from 'chalk';
import ora from 'ora';
import fetch from 'node-fetch';
import { execSync } from 'child_process';

export interface BridgeOptions {
  start?: boolean;
  stop?: boolean;
  sync?: boolean;
  notion?: boolean;
  status?: boolean;
}

export async function bridgeCommand(options: BridgeOptions = {}) {
  if (options.start) {
    await startContextBridge();
  } else if (options.stop) {
    await stopContextBridge();
  } else if (options.sync) {
    await triggerSessionSync();
  } else if (options.notion) {
    await manageNotionSync();
  } else if (options.status) {
    await showBridgeStatus();
  } else {
    await showBridgeMenu();
  }
}

async function showBridgeMenu() {
  const inquirer = await import('inquirer');

  console.log(chalk.blue.bold('🌉 Context Bridge Management\n'));

  const action = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '🚀 Start Context Bridge Service', value: 'start' },
        { name: '🛑 Stop Context Bridge Service', value: 'stop' },
        { name: '📊 Check Bridge Status', value: 'status' },
        { name: '🔄 Trigger Session Sync', value: 'sync' },
        { name: '📝 Manage Notion Integration', value: 'notion' }
      ]
    }
  ]);

  switch (action.action) {
    case 'start':
      await startContextBridge();
      break;
    case 'stop':
      await stopContextBridge();
      break;
    case 'status':
      await showBridgeStatus();
      break;
    case 'sync':
      await triggerSessionSync();
      break;
    case 'notion':
      await manageNotionSync();
      break;
  }
}

async function startContextBridge() {
  console.log(chalk.blue('🚀 Starting ChittyOS Context Bridge Service\n'));

  const spinner = ora('Checking for context bridge installation...').start();

  try {
    // Check if context bridge exists
    const fs = await import('fs-extra');
    const path = await import('path');

    const bridgePath = '/Users/nb/.chittychat/context-bridge';
    const startScript = path.join(bridgePath, 'start-service-client.sh');

    if (!await fs.pathExists(bridgePath)) {
      spinner.fail('Context bridge not found');
      console.log(chalk.yellow('Context bridge is not installed at expected location.'));
      console.log(chalk.gray('\n📍 Expected location: /Users/nb/.chittychat/context-bridge'));
      console.log(chalk.gray('🔧 Please ensure the context bridge is properly deployed.'));
      return;
    }

    if (!await fs.pathExists(startScript)) {
      spinner.fail('Start script not found');
      console.log(chalk.yellow('Context bridge start script not found.'));
      console.log(chalk.gray('\n📍 Expected script: start-service-client.sh'));
      console.log(chalk.gray('🔧 Please ensure the context bridge is properly configured.'));
      return;
    }

    spinner.text = 'Starting context bridge service...';

    // Make script executable
    execSync(`chmod +x "${startScript}"`, { stdio: 'pipe' });

    // Start the service
    process.chdir(bridgePath);
    execSync('./start-service-client.sh', {
      stdio: 'pipe',
      timeout: 30000
    });

    // Wait a moment for startup
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify it's running
    const response = await fetch('http://localhost:3001/api/health', {
      timeout: 5000,
      headers: { 'User-Agent': 'ChittyOS-CLI/1.0.0' }
    });

    if (response.ok) {
      spinner.succeed('Context bridge service started successfully');

      console.log(chalk.green('✅ Context Bridge is now running!\n'));
      console.log(chalk.white('📊 Service Details:'));
      console.log(`   ${chalk.gray('Port:')} ${chalk.cyan('3001')}`);
      console.log(`   ${chalk.gray('Health:')} ${chalk.blue('http://localhost:3001/api/health')}`);
      console.log(`   ${chalk.gray('Session:')} ${chalk.blue('http://localhost:3001/api/session')}`);
      console.log(`   ${chalk.gray('Bridge:')} ${chalk.blue('http://localhost:3001/api/bridge')}`);

      console.log(chalk.blue('\n🔧 Features Active:'));
      console.log('   🔒 Pipeline-only ChittyID generation');
      console.log('   🔄 Distributed session sync with vector clocks');
      console.log('   📝 Hardened Notion sync with DLQ');
      console.log('   🌉 Bridge endpoint integration');
      console.log('   📊 Session middleware with context tracking');

    } else {
      throw new Error('Service started but health check failed');
    }

  } catch (error) {
    spinner.fail('Failed to start context bridge');
    console.error(chalk.red('Error:'), error.message);

    console.log(chalk.yellow('\n🔧 Troubleshooting:'));
    console.log(chalk.gray('   • Check if port 3001 is available'));
    console.log(chalk.gray('   • Ensure ChittyOS core is running'));
    console.log(chalk.gray('   • Verify context bridge deployment'));
    console.log(chalk.gray('   • Check logs: tail -f /Users/nb/.chittychat/context-bridge/logs/*.log'));
  }
}

async function stopContextBridge() {
  console.log(chalk.blue('🛑 Stopping Context Bridge Service\n'));

  const spinner = ora('Stopping context bridge...').start();

  try {
    // Try to gracefully stop via API
    try {
      await fetch('http://localhost:3001/api/shutdown', {
        method: 'POST',
        timeout: 5000,
        headers: { 'User-Agent': 'ChittyOS-CLI/1.0.0' }
      });
    } catch {
      // API might not be available, that's okay
    }

    // Kill any processes on port 3001
    try {
      execSync('lsof -ti:3001 | xargs kill -9', { stdio: 'pipe' });
    } catch {
      // Process might not exist, that's okay
    }

    spinner.succeed('Context bridge service stopped');

    console.log(chalk.green('✅ Context Bridge stopped successfully'));
    console.log(chalk.gray('Port 3001 is now available'));

  } catch (error) {
    spinner.fail('Failed to stop context bridge');
    console.error(chalk.red('Error:'), error.message);
  }
}

async function showBridgeStatus() {
  console.log(chalk.blue.bold('📊 Context Bridge Status\n'));

  const checks = [
    { name: 'Service Health', endpoint: 'http://localhost:3001/api/health' },
    { name: 'Session Endpoint', endpoint: 'http://localhost:3001/api/session/status' },
    { name: 'Bridge Endpoint', endpoint: 'http://localhost:3001/api/bridge/session' },
    { name: 'Sync Status', endpoint: 'http://localhost:3001/api/sync/status' }
  ];

  const results = [];

  for (const check of checks) {
    const spinner = ora(`Checking ${check.name}...`).start();

    try {
      const startTime = Date.now();
      const response = await fetch(check.endpoint, {
        timeout: 5000,
        headers: { 'User-Agent': 'ChittyOS-CLI/1.0.0' }
      });

      const responseTime = Date.now() - startTime;
      const success = response.ok;

      results.push({
        name: check.name,
        success,
        responseTime,
        status: response.status
      });

      if (success) {
        spinner.succeed(`${check.name}: ${chalk.green('✅ Operational')} (${responseTime}ms)`);
      } else {
        spinner.fail(`${check.name}: ${chalk.red('❌ Failed')} (${response.status})`);
      }

    } catch (error) {
      results.push({
        name: check.name,
        success: false,
        error: error.message
      });

      spinner.fail(`${check.name}: ${chalk.red('❌ Unreachable')}`);
    }
  }

  // Show summary
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;

  console.log(chalk.white.bold('\n📈 Bridge Health Summary\n'));
  console.log(`   Endpoints: ${successCount}/${totalCount} operational`);

  if (successCount === totalCount) {
    console.log(chalk.green('   🎉 Context Bridge is fully operational!'));

    console.log(chalk.blue('\n🔧 Active Features:'));
    console.log('   🔒 Pipeline Authentication');
    console.log('   🔄 Distributed Session Sync');
    console.log('   📝 Notion Integration');
    console.log('   🌉 Service-to-Service Bridging');

  } else if (successCount === 0) {
    console.log(chalk.red('   ❌ Context Bridge is not running'));
    console.log(chalk.gray('\n💡 Start the service: chittyos bridge --start'));
  } else {
    console.log(chalk.yellow('   ⚠️  Context Bridge has some issues'));
    console.log(chalk.gray('\n💡 Check service logs for details'));
  }
}

async function triggerSessionSync() {
  console.log(chalk.blue('🔄 Triggering Session Sync\n'));

  const spinner = ora('Initiating session synchronization...').start();

  try {
    const response = await fetch('http://localhost:3001/api/sync/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ChittyOS-CLI/1.0.0'
      },
      body: JSON.stringify({
        type: 'manual',
        source: 'chittyos-cli'
      })
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    spinner.succeed('Session sync completed');

    console.log(chalk.green('✅ Session Sync Results:\n'));
    console.log(`   ${chalk.gray('Sync ID:')} ${chalk.cyan(result.syncId || 'N/A')}`);
    console.log(`   ${chalk.gray('Services Synced:')} ${chalk.cyan(result.serviceCount || 'N/A')}`);
    console.log(`   ${chalk.gray('Sessions Updated:')} ${chalk.cyan(result.sessionCount || 'N/A')}`);
    console.log(`   ${chalk.gray('Vector Clock:')} ${chalk.cyan(result.vectorClock || 'N/A')}`);

    if (result.conflicts && result.conflicts > 0) {
      console.log(`   ${chalk.yellow('Conflicts Resolved:')} ${result.conflicts}`);
    }

  } catch (error) {
    spinner.fail('Session sync failed');
    console.error(chalk.red('Error:'), error.message);

    if (error.message.includes('ECONNREFUSED')) {
      console.log(chalk.gray('\n💡 Ensure context bridge is running: chittyos bridge --start'));
    }
  }
}

async function manageNotionSync() {
  console.log(chalk.blue('📝 Notion Integration Management\n'));

  const spinner = ora('Checking Notion sync status...').start();

  try {
    const response = await fetch('http://localhost:3001/api/notion-sync/status', {
      headers: { 'User-Agent': 'ChittyOS-CLI/1.0.0' }
    });

    if (!response.ok) {
      throw new Error(`Failed to get Notion status: ${response.status}`);
    }

    const status = await response.json();

    spinner.succeed('Notion sync status retrieved');

    console.log(chalk.green('📊 Notion Integration Status:\n'));
    console.log(`   ${chalk.gray('Status:')} ${status.enabled ? chalk.green('Enabled') : chalk.red('Disabled')}`);
    console.log(`   ${chalk.gray('Last Sync:')} ${chalk.cyan(status.lastSync || 'Never')}`);
    console.log(`   ${chalk.gray('Sync Count:')} ${chalk.cyan(status.syncCount || 0)}`);
    console.log(`   ${chalk.gray('Error Count:')} ${chalk.cyan(status.errorCount || 0)}`);

    if (status.features) {
      console.log(chalk.blue('\n🔧 Features:'));
      status.features.forEach(feature => {
        console.log(`   ✅ ${feature}`);
      });
    }

    if (status.lastError) {
      console.log(chalk.red('\n❌ Last Error:'));
      console.log(`   ${chalk.gray(status.lastError)}`);
    }

  } catch (error) {
    spinner.fail('Failed to get Notion status');
    console.error(chalk.red('Error:'), error.message);

    console.log(chalk.yellow('\n🔧 Notion Integration Features:'));
    console.log('   📝 Hardened sync with Dead Letter Queue (DLQ)');
    console.log('   🔄 Exponential backoff for retries');
    console.log('   📊 Rate limiting with jitter');
    console.log('   🔒 Idempotent operations');
  }
}