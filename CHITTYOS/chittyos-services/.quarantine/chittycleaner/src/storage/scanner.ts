import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { Logger } from 'winston';
import * as glob from 'glob';

export interface ScanResult {
  path: string;
  size: number;
  type: 'temp' | 'cache' | 'log' | 'duplicate' | 'large';
  lastAccessed: Date;
  archivable: boolean;
}

export interface ScanSummary {
  totalScanned: number;
  totalSize: number;
  candidates: ScanResult[];
  duplicates: Map<string, ScanResult[]>;
}

export class StorageScanner {
  private logger: Logger;
  private knownTempPatterns = [
    '**/.DS_Store',
    '**/Thumbs.db',
    '**/*.tmp',
    '**/*.temp',
    '**/node_modules/.cache/**',
    '**/.npm/**',
    '**/.yarn/cache/**',
    '**/Library/Caches/**',
    '**/AppData/Local/Temp/**'
  ];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async scanFileSystem(rootPaths: string[] = ['/']): Promise<ScanSummary> {
    this.logger.info('Starting filesystem scan', { rootPaths });

    const summary: ScanSummary = {
      totalScanned: 0,
      totalSize: 0,
      candidates: [],
      duplicates: new Map()
    };

    for (const rootPath of rootPaths) {
      await this.scanPath(rootPath, summary);
    }

    await this.findDuplicates(summary);

    this.logger.info('Filesystem scan completed', {
      totalScanned: summary.totalScanned,
      totalSize: summary.totalSize,
      candidates: summary.candidates.length
    });

    return summary;
  }

  private async scanPath(path: string, summary: ScanSummary): Promise<void> {
    try {
      const stats = await fs.stat(path);
      summary.totalScanned++;

      if (stats.isDirectory()) {
        const entries = await fs.readdir(path);
        for (const entry of entries) {
          await this.scanPath(join(path, entry), summary);
        }
      } else {
        summary.totalSize += stats.size;
        const candidate = await this.analyzeFile(path, stats);
        if (candidate) {
          summary.candidates.push(candidate);
        }
      }
    } catch (error) {
      this.logger.warn('Error scanning path', { path, error: error.message });
    }
  }

  private async analyzeFile(path: string, stats: any): Promise<ScanResult | null> {
    const size = stats.size;
    const lastAccessed = stats.atime;

    let type: ScanResult['type'] = 'large';
    let archivable = false;

    if (this.isTempFile(path)) {
      type = 'temp';
      archivable = true;
    } else if (this.isCacheFile(path)) {
      type = 'cache';
      archivable = true;
    } else if (this.isLogFile(path)) {
      type = 'log';
      archivable = this.isOldFile(lastAccessed);
    } else if (size > 100 * 1024 * 1024) { // 100MB
      type = 'large';
      archivable = this.isOldFile(lastAccessed);
    } else {
      return null;
    }

    return {
      path,
      size,
      type,
      lastAccessed,
      archivable
    };
  }

  private isTempFile(path: string): boolean {
    return this.knownTempPatterns.some(pattern =>
      glob.minimatch(path, pattern)
    );
  }

  private isCacheFile(path: string): boolean {
    return path.includes('/cache/') ||
           path.includes('/.cache/') ||
           path.includes('/Cache/');
  }

  private isLogFile(path: string): boolean {
    const ext = extname(path).toLowerCase();
    return ext === '.log' ||
           path.includes('/logs/') ||
           path.includes('/var/log/');
  }

  private isOldFile(lastAccessed: Date): boolean {
    const daysSinceAccess = (Date.now() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceAccess > 30;
  }

  private async findDuplicates(summary: ScanSummary): Promise<void> {
    const fileHashes = new Map<string, ScanResult[]>();

    for (const candidate of summary.candidates) {
      const hash = await this.calculateFileHash(candidate.path);
      if (!fileHashes.has(hash)) {
        fileHashes.set(hash, []);
      }
      fileHashes.get(hash)!.push(candidate);
    }

    for (const [hash, files] of fileHashes) {
      if (files.length > 1) {
        summary.duplicates.set(hash, files);
        files.forEach(file => {
          file.type = 'duplicate';
          file.archivable = true;
        });
      }
    }
  }

  private async calculateFileHash(filePath: string): Promise<string> {
    try {
      const crypto = await import('crypto');
      const fileBuffer = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (error) {
      return `error-${filePath}`;
    }
  }
}