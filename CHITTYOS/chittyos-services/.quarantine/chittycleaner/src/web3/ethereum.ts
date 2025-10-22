import { ethers } from 'ethers';
import { Logger } from 'winston';

export interface CleanupOperation {
  path: string;
  size: number;
  timestamp: number;
  ipfsHash?: string;
}

export interface StoragePolicy {
  maxSize: bigint;
  retentionDays: number;
  autoArchive: boolean;
  allowedExtensions: string[];
}

export class EthereumManager {
  private logger: Logger;
  private provider?: ethers.Provider;
  private wallet?: ethers.Wallet;
  private contract?: ethers.Contract;
  private contractAddress = process.env.CHITTY_CONTRACT_ADDRESS;

  private contractABI = [
    "function recordCleanup(string memory path, uint256 size, uint256 timestamp, string memory ipfsHash) public",
    "function getCleanupHistory(address user) public view returns (tuple(string path, uint256 size, uint256 timestamp, string ipfsHash)[])",
    "function setStoragePolicy(uint256 maxSize, uint256 retentionDays, bool autoArchive) public",
    "function getStoragePolicy(address user) public view returns (tuple(uint256 maxSize, uint256 retentionDays, bool autoArchive))",
    "event CleanupRecorded(address indexed user, string path, uint256 size, uint256 timestamp)",
    "event PolicyUpdated(address indexed user, uint256 maxSize, uint256 retentionDays, bool autoArchive)"
  ];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Ethereum integration');

    try {
      this.provider = new ethers.JsonRpcProvider(
        process.env.ETHEREUM_RPC_URL || 'https://cloudflare-eth.com'
      );

      if (process.env.ETHEREUM_PRIVATE_KEY) {
        this.wallet = new ethers.Wallet(process.env.ETHEREUM_PRIVATE_KEY, this.provider);
      }

      if (this.contractAddress && this.wallet) {
        this.contract = new ethers.Contract(
          this.contractAddress,
          this.contractABI,
          this.wallet
        );
      }

      const network = await this.provider.getNetwork();
      this.logger.info('Ethereum connection established', {
        network: network.name,
        chainId: network.chainId
      });

    } catch (error) {
      this.logger.warn('Ethereum initialization failed', { error: error.message });
    }
  }

  async recordCleanupOperation(operation: CleanupOperation): Promise<string | null> {
    if (!this.contract) {
      this.logger.warn('Ethereum contract not available, skipping cleanup recording');
      return null;
    }

    try {
      this.logger.info('Recording cleanup operation on blockchain', {
        path: operation.path,
        size: operation.size
      });

      const tx = await this.contract.recordCleanup(
        operation.path,
        operation.size,
        operation.timestamp,
        operation.ipfsHash || ''
      );

      const receipt = await tx.wait();

      this.logger.info('Cleanup operation recorded on blockchain', {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed
      });

      return receipt.hash;

    } catch (error) {
      this.logger.error('Failed to record cleanup operation', {
        operation,
        error: error.message
      });
      return null;
    }
  }

  async getCleanupHistory(): Promise<CleanupOperation[]> {
    if (!this.contract || !this.wallet) {
      return [];
    }

    try {
      const history = await this.contract.getCleanupHistory(this.wallet.address);

      return history.map((record: any) => ({
        path: record.path,
        size: Number(record.size),
        timestamp: Number(record.timestamp),
        ipfsHash: record.ipfsHash || undefined
      }));

    } catch (error) {
      this.logger.error('Failed to retrieve cleanup history', { error: error.message });
      return [];
    }
  }

  async setStoragePolicy(policy: StoragePolicy): Promise<string | null> {
    if (!this.contract) {
      this.logger.warn('Ethereum contract not available, cannot set storage policy');
      return null;
    }

    try {
      const tx = await this.contract.setStoragePolicy(
        policy.maxSize,
        policy.retentionDays,
        policy.autoArchive
      );

      const receipt = await tx.wait();

      this.logger.info('Storage policy updated on blockchain', {
        transactionHash: receipt.hash,
        policy
      });

      return receipt.hash;

    } catch (error) {
      this.logger.error('Failed to set storage policy', {
        policy,
        error: error.message
      });
      return null;
    }
  }

  async getStoragePolicy(): Promise<StoragePolicy | null> {
    if (!this.contract || !this.wallet) {
      return null;
    }

    try {
      const policy = await this.contract.getStoragePolicy(this.wallet.address);

      return {
        maxSize: policy.maxSize,
        retentionDays: Number(policy.retentionDays),
        autoArchive: policy.autoArchive,
        allowedExtensions: []
      };

    } catch (error) {
      this.logger.error('Failed to retrieve storage policy', { error: error.message });
      return null;
    }
  }

  async estimateGasForCleanup(operation: CleanupOperation): Promise<bigint | null> {
    if (!this.contract) {
      return null;
    }

    try {
      const gasEstimate = await this.contract.recordCleanup.estimateGas(
        operation.path,
        operation.size,
        operation.timestamp,
        operation.ipfsHash || ''
      );

      return gasEstimate;

    } catch (error) {
      this.logger.error('Failed to estimate gas', { error: error.message });
      return null;
    }
  }

  async getAccountBalance(): Promise<string | null> {
    if (!this.provider || !this.wallet) {
      return null;
    }

    try {
      const balance = await this.provider.getBalance(this.wallet.address);
      return ethers.formatEther(balance);
    } catch (error) {
      this.logger.error('Failed to get account balance', { error: error.message });
      return null;
    }
  }
}