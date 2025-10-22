#!/usr/bin/env node

import { Command } from 'commander';
import { ChittyCleaner, DaemonConfig } from '../core/daemon';
import { createLogger } from '../core/logger';

const program = new Command();

program
  .name('chittycleaner')
  .description('Intelligent storage management daemon with Web3 integration')
  .version('1.0.0');

program
  .command('start')
  .description('Start the ChittyCleaner daemon')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-i, --interval <ms>', 'Scan interval in milliseconds', '3600000')
  .option('-t, --threshold <bytes>', 'Cleanup threshold in bytes', '104857600')
  .option('--ipfs', 'Enable IPFS integration')
  .option('--ethereum', 'Enable Ethereum integration')
  .option('-l, --log-level <level>', 'Log level', 'info')
  .action(async (options) => {
    const config: DaemonConfig = {
      scanInterval: parseInt(options.interval),
      cleanupThreshold: parseInt(options.threshold),
      ipfsEnabled: options.ipfs || false,
      ethereumEnabled: options.ethereum || false,
      logLevel: options.logLevel
    };

    const daemon = new ChittyCleaner(config);

    daemon.on('started', () => {
      console.log('🧹 ChittyCleaner daemon started');
    });

    daemon.on('cleanup-completed', (results) => {
      console.log(`✅ Cleanup cycle completed: ${results.candidates.length} files processed`);
    });

    daemon.on('stopped', () => {
      console.log('🛑 ChittyCleaner daemon stopped');
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('\n👋 Shutting down ChittyCleaner daemon...');
      await daemon.stop();
    });

    await daemon.start();
  });

program
  .command('scan')
  .description('Perform a one-time filesystem scan')
  .option('-p, --paths <paths...>', 'Paths to scan', ['/'])
  .option('-l, --log-level <level>', 'Log level', 'info')
  .action(async (options) => {
    const logger = createLogger(options.logLevel);
    const { StorageScanner } = await import('../storage/scanner');

    const scanner = new StorageScanner(logger);
    const results = await scanner.scanFileSystem(options.paths);

    console.log('\n📊 Scan Results:');
    console.log(`Total files scanned: ${results.totalScanned}`);
    console.log(`Total size: ${formatBytes(results.totalSize)}`);
    console.log(`Cleanup candidates: ${results.candidates.length}`);
    console.log(`Duplicates found: ${results.duplicates.size} groups`);

    if (results.candidates.length > 0) {
      console.log('\n🗂️  Top cleanup candidates:');
      results.candidates
        .sort((a, b) => b.size - a.size)
        .slice(0, 10)
        .forEach(candidate => {
          console.log(`  ${candidate.type.padEnd(8)} ${formatBytes(candidate.size).padEnd(10)} ${candidate.path}`);
        });
    }
  });

program
  .command('ipfs')
  .description('IPFS operations')
  .command('archive <file>')
  .description('Archive a file to IPFS')
  .action(async (file) => {
    const logger = createLogger();
    const { IPFSGateway } = await import('../web3/ipfs-gateway');

    const gateway = new IPFSGateway(logger);
    await gateway.initialize();

    const result = await gateway.archiveFile(file);
    console.log(`📦 File archived to IPFS: ${result.hash}`);
  });

program
  .command('ipfs')
  .command('restore <reference>')
  .description('Restore a file from IPFS reference')
  .action(async (reference) => {
    const logger = createLogger();
    const { IPFSGateway } = await import('../web3/ipfs-gateway');

    const gateway = new IPFSGateway(logger);
    await gateway.initialize();

    await gateway.restoreFromReference(reference);
    console.log('📥 File restored from IPFS');
  });

program
  .command('ethereum')
  .description('Ethereum operations')
  .command('history')
  .description('Show cleanup history from blockchain')
  .action(async () => {
    const logger = createLogger();
    const { EthereumManager } = await import('../web3/ethereum');

    const ethereum = new EthereumManager(logger);
    await ethereum.initialize();

    const history = await ethereum.getCleanupHistory();

    console.log('🔗 Cleanup History:');
    history.forEach(operation => {
      console.log(`  ${new Date(operation.timestamp).toISOString()} - ${operation.path} (${formatBytes(operation.size)})`);
    });
  });

program
  .command('ethereum')
  .command('policy')
  .description('Manage storage policies')
  .option('--set', 'Set new policy')
  .option('--max-size <bytes>', 'Maximum storage size')
  .option('--retention <days>', 'Retention period in days')
  .option('--auto-archive', 'Enable auto-archive')
  .action(async (options) => {
    const logger = createLogger();
    const { EthereumManager } = await import('../web3/ethereum');

    const ethereum = new EthereumManager(logger);
    await ethereum.initialize();

    if (options.set) {
      const policy = {
        maxSize: BigInt(options.maxSize || '1000000000'),
        retentionDays: parseInt(options.retention || '30'),
        autoArchive: options.autoArchive || false,
        allowedExtensions: []
      };

      await ethereum.setStoragePolicy(policy);
      console.log('📋 Storage policy updated');
    } else {
      const policy = await ethereum.getStoragePolicy();
      if (policy) {
        console.log('📋 Current Storage Policy:');
        console.log(`  Max Size: ${formatBytes(Number(policy.maxSize))}`);
        console.log(`  Retention: ${policy.retentionDays} days`);
        console.log(`  Auto-archive: ${policy.autoArchive}`);
      }
    }
  });

program
  .command('status')
  .description('Show ChittyCleaner status')
  .action(async () => {
    console.log('🧹 ChittyCleaner Status:');
    console.log(`  Version: 1.0.0`);
    console.log(`  Node: ${process.version}`);
    console.log(`  Platform: ${process.platform}`);

    // Check if daemon is running
    try {
      const { exec } = await import('child_process');
      exec('pgrep -f chittycleaner', (error, stdout) => {
        if (stdout) {
          console.log(`  Daemon: Running (PID: ${stdout.trim()})`);
        } else {
          console.log(`  Daemon: Stopped`);
        }
      });
    } catch {
      console.log(`  Daemon: Unknown`);
    }
  });

function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

program.parse();