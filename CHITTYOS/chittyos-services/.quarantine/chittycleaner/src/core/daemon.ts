import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { StorageScanner } from '../storage/scanner';
import { IPFSGateway } from '../web3/ipfs-gateway';
import { EthereumManager } from '../web3/ethereum';
import { createLogger } from './logger';

export interface DaemonConfig {
  scanInterval: number;
  cleanupThreshold: number;
  ipfsEnabled: boolean;
  ethereumEnabled: boolean;
  logLevel: string;
}

export class ChittyCleaner extends EventEmitter {
  private logger: Logger;
  private scanner: StorageScanner;
  private ipfsGateway?: IPFSGateway;
  private ethereum?: EthereumManager;
  private config: DaemonConfig;
  private isRunning = false;

  constructor(config: DaemonConfig) {
    super();
    this.config = config;
    this.logger = createLogger(config.logLevel);
    this.scanner = new StorageScanner(this.logger);

    if (config.ipfsEnabled) {
      this.ipfsGateway = new IPFSGateway(this.logger);
    }

    if (config.ethereumEnabled) {
      this.ethereum = new EthereumManager(this.logger);
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('ChittyCleaner daemon is already running');
    }

    this.logger.info('Starting ChittyCleaner daemon');
    this.isRunning = true;

    await this.initializeServices();
    this.startPeriodicScanning();

    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping ChittyCleaner daemon');
    this.isRunning = false;

    this.emit('stopped');
  }

  private async initializeServices(): Promise<void> {
    if (this.ipfsGateway) {
      await this.ipfsGateway.initialize();
    }

    if (this.ethereum) {
      await this.ethereum.initialize();
    }
  }

  private startPeriodicScanning(): void {
    setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.performCleanupCycle();
      } catch (error) {
        this.logger.error('Error during cleanup cycle:', error);
      }
    }, this.config.scanInterval);
  }

  private async performCleanupCycle(): Promise<void> {
    this.logger.info('Starting cleanup cycle');

    const scanResults = await this.scanner.scanFileSystem();

    for (const result of scanResults.candidates) {
      if (result.size > this.config.cleanupThreshold) {
        await this.handleLargeFile(result);
      }
    }

    this.emit('cleanup-completed', scanResults);
  }

  private async handleLargeFile(file: any): Promise<void> {
    if (this.ipfsGateway && file.archivable) {
      await this.ipfsGateway.archiveFile(file.path);
    }

    if (this.ethereum) {
      await this.ethereum.recordCleanupOperation({
        path: file.path,
        size: file.size,
        timestamp: Date.now()
      });
    }
  }
}