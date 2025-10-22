/**
 * Real File System Scanner
 * Actually scans and cleans files
 */

import fs from 'fs';
import path from 'path';

export class FileScanner {
  constructor() {
    // Safe cleanup targets
    this.scanTargets = [
      {
        name: 'Wrangler Cache',
        path: '.wrangler/state',
        type: 'cache',
        priority: 7,
        safe: true
      },
      {
        name: 'Wrangler Logs',
        path: '.wrangler/logs',
        type: 'large_log',
        priority: 6,
        safe: true
      },
      {
        name: 'Node Cache',
        path: 'node_modules/.cache',
        type: 'cache',
        priority: 6,
        safe: true
      },
      {
        name: 'NPM Cache',
        path: '/tmp/npm-*',
        type: 'temp_files',
        priority: 8,
        safe: true
      },
      {
        name: 'Old Logs',
        path: '*.log',
        type: 'large_log',
        priority: 5,
        safe: true,
        maxAge: 7 // days
      }
    ];
  }

  /**
   * Scan directory for cleanup opportunities
   */
  async scan(basePath) {
    const discoveries = [];

    try {
      // Scan common cache locations
      const cacheTargets = [
        path.join(basePath, '.wrangler'),
        path.join(basePath, 'node_modules/.cache'),
        '/tmp'
      ];

      for (const target of cacheTargets) {
        if (await this.exists(target)) {
          const info = await this.analyzeDirectory(target);
          if (info && info.size > 0) {
            discoveries.push({
              type: this.getTypeForPath(target),
              path: target,
              size: this.formatSize(info.size),
              sizeBytes: info.size,
              fileCount: info.fileCount,
              priority: this.getPriorityForPath(target),
              confidence: 95,
              timestamp: new Date().toISOString(),
              lastAccessed: info.lastAccessed,
              safe: true
            });
          }
        }
      }

      // Scan for large log files
      const logs = await this.findLargeFiles(basePath, '.log', 10 * 1024 * 1024); // >10MB
      for (const log of logs) {
        discoveries.push({
          type: 'large_log',
          path: log.path,
          size: this.formatSize(log.size),
          sizeBytes: log.size,
          fileCount: 1,
          priority: log.size > 100 * 1024 * 1024 ? 7 : 5,
          confidence: 90,
          timestamp: new Date().toISOString(),
          lastAccessed: log.lastAccessed,
          safe: true
        });
      }

      return discoveries.sort((a, b) => b.priority - a.priority);
    } catch (error) {
      console.error('Scan error:', error);
      return [];
    }
  }

  /**
   * Check if path exists
   */
  async exists(filePath) {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Analyze directory size and file count
   */
  async analyzeDirectory(dirPath) {
    try {
      const stats = await fs.promises.stat(dirPath);

      if (!stats.isDirectory()) {
        return {
          size: stats.size,
          fileCount: 1,
          lastAccessed: stats.atime
        };
      }

      let totalSize = 0;
      let fileCount = 0;
      let lastAccessed = stats.atime;

      const files = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const file of files) {
        const filePath = path.join(dirPath, file.name);

        try {
          if (file.isDirectory()) {
            const subInfo = await this.analyzeDirectory(filePath);
            totalSize += subInfo.size;
            fileCount += subInfo.fileCount;
            if (subInfo.lastAccessed > lastAccessed) {
              lastAccessed = subInfo.lastAccessed;
            }
          } else {
            const fileStats = await fs.promises.stat(filePath);
            totalSize += fileStats.size;
            fileCount++;
            if (fileStats.atime > lastAccessed) {
              lastAccessed = fileStats.atime;
            }
          }
        } catch (err) {
          // Skip files we can't access
          continue;
        }
      }

      return { size: totalSize, fileCount, lastAccessed };
    } catch (error) {
      return { size: 0, fileCount: 0, lastAccessed: new Date() };
    }
  }

  /**
   * Find large files
   */
  async findLargeFiles(dirPath, extension, minSize) {
    const largeFiles = [];

    try {
      const files = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const file of files) {
        const filePath = path.join(dirPath, file.name);

        try {
          if (file.isFile() && file.name.endsWith(extension)) {
            const stats = await fs.promises.stat(filePath);
            if (stats.size >= minSize) {
              largeFiles.push({
                path: filePath,
                size: stats.size,
                lastAccessed: stats.atime
              });
            }
          } else if (file.isDirectory() && !file.name.startsWith('.')) {
            // Recurse into subdirectories (skip hidden)
            const subFiles = await this.findLargeFiles(filePath, extension, minSize);
            largeFiles.push(...subFiles);
          }
        } catch (err) {
          continue;
        }
      }
    } catch (error) {
      // Directory not accessible
    }

    return largeFiles;
  }

  /**
   * Actually delete files/directories
   */
  async cleanup(filePath, action = 'delete') {
    try {
      const stats = await fs.promises.stat(filePath);
      const sizeBefore = stats.isDirectory()
        ? (await this.analyzeDirectory(filePath)).size
        : stats.size;

      if (action === 'delete') {
        if (stats.isDirectory()) {
          await fs.promises.rm(filePath, { recursive: true, force: true });
        } else {
          await fs.promises.unlink(filePath);
        }

        return {
          success: true,
          action: 'deleted',
          path: filePath,
          bytesFreed: sizeBefore
        };
      } else if (action === 'archive') {
        // Move to archive directory
        const archivePath = path.join('/tmp/chittysweep-archive', path.basename(filePath));
        await fs.promises.mkdir(path.dirname(archivePath), { recursive: true });
        await fs.promises.rename(filePath, archivePath);

        return {
          success: true,
          action: 'archived',
          path: filePath,
          archivePath,
          bytesFreed: sizeBefore
        };
      }

      return { success: false, error: 'Unknown action' };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        path: filePath
      };
    }
  }

  /**
   * Helper methods
   */
  getTypeForPath(filePath) {
    if (filePath.includes('.wrangler')) return 'cache';
    if (filePath.includes('node_modules')) return 'cache';
    if (filePath.includes('/tmp')) return 'temp_files';
    if (filePath.endsWith('.log')) return 'large_log';
    return 'unknown';
  }

  getPriorityForPath(filePath) {
    if (filePath.includes('.wrangler/state')) return 7;
    if (filePath.includes('/tmp')) return 8;
    if (filePath.includes('node_modules/.cache')) return 6;
    if (filePath.endsWith('.log')) return 5;
    return 4;
  }

  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
