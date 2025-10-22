import axios from 'axios';
import { promises as fs } from 'fs';
import { Logger } from 'winston';
import { createHash } from 'crypto';

export interface IPFSUploadResult {
  hash: string;
  size: number;
  originalPath: string;
}

export class IPFSGateway {
  private logger: Logger;
  private gatewayUrl = 'https://cloudflare-ipfs.com';
  private uploadEndpoint = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing IPFS Gateway with Cloudflare');

    try {
      const response = await axios.get(`${this.gatewayUrl}/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/readme`);
      this.logger.info('IPFS Gateway connection verified');
    } catch (error) {
      this.logger.warn('IPFS Gateway verification failed', { error: error.message });
    }
  }

  async archiveFile(filePath: string): Promise<IPFSUploadResult> {
    this.logger.info('Archiving file to IPFS', { filePath });

    try {
      const fileContent = await fs.readFile(filePath);
      const hash = this.calculateFileHash(fileContent);

      const existingFile = await this.checkIfExists(hash);
      if (existingFile) {
        this.logger.info('File already exists in IPFS', { hash });
        return {
          hash,
          size: fileContent.length,
          originalPath: filePath
        };
      }

      const uploadResult = await this.uploadToIPFS(fileContent, filePath);

      await this.createLocalReference(filePath, uploadResult.hash);

      this.logger.info('File archived to IPFS successfully', {
        originalPath: filePath,
        hash: uploadResult.hash,
        size: uploadResult.size
      });

      return uploadResult;

    } catch (error) {
      this.logger.error('Failed to archive file to IPFS', {
        filePath,
        error: error.message
      });
      throw error;
    }
  }

  async retrieveFile(hash: string, outputPath: string): Promise<void> {
    this.logger.info('Retrieving file from IPFS', { hash, outputPath });

    try {
      const response = await axios.get(`${this.gatewayUrl}/ipfs/${hash}`, {
        responseType: 'arraybuffer'
      });

      await fs.writeFile(outputPath, response.data);

      this.logger.info('File retrieved from IPFS successfully', {
        hash,
        outputPath,
        size: response.data.length
      });

    } catch (error) {
      this.logger.error('Failed to retrieve file from IPFS', {
        hash,
        outputPath,
        error: error.message
      });
      throw error;
    }
  }

  private calculateFileHash(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private async checkIfExists(hash: string): Promise<boolean> {
    try {
      const response = await axios.head(`${this.gatewayUrl}/ipfs/${hash}`);
      return response.status === 200;
    } catch {
      return false;
    }
  }

  private async uploadToIPFS(content: Buffer, originalPath: string): Promise<IPFSUploadResult> {
    const formData = new FormData();
    const blob = new Blob([content]);
    formData.append('file', blob, originalPath.split('/').pop());

    const response = await axios.post(this.uploadEndpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'pinata_api_key': process.env.PINATA_API_KEY,
        'pinata_secret_api_key': process.env.PINATA_SECRET_KEY
      }
    });

    return {
      hash: response.data.IpfsHash,
      size: content.length,
      originalPath
    };
  }

  private async createLocalReference(originalPath: string, ipfsHash: string): Promise<void> {
    const referenceData = {
      originalPath,
      ipfsHash,
      archivedAt: new Date().toISOString(),
      size: (await fs.stat(originalPath)).size
    };

    const referencePath = `${originalPath}.ipfs-ref`;
    await fs.writeFile(referencePath, JSON.stringify(referenceData, null, 2));

    await fs.unlink(originalPath);

    this.logger.info('Created IPFS reference file', {
      originalPath,
      referencePath,
      ipfsHash
    });
  }

  async restoreFromReference(referencePath: string): Promise<void> {
    const referenceData = JSON.parse(await fs.readFile(referencePath, 'utf8'));

    await this.retrieveFile(referenceData.ipfsHash, referenceData.originalPath);
    await fs.unlink(referencePath);

    this.logger.info('Restored file from IPFS reference', {
      originalPath: referenceData.originalPath,
      ipfsHash: referenceData.ipfsHash
    });
  }
}