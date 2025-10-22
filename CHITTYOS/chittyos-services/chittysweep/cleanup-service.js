#!/usr/bin/env node
/**
 * ChittySweep Local Cleanup Service
 * Runs locally to actually scan and clean files
 * Receives commands from ChittySweep Worker
 */

import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = 8788;

class CleanupService {
  constructor() {
    this.basePath = process.cwd();
    this.chittyhd = '/Volumes/ChittyHD - Data/ChittySweep-Archive';
  }

  async scan() {
    const discoveries = [];

    // Scan multiple base paths (current + common cache locations)
    const scanPaths = [
      this.basePath,
      '/Users/nb/.claude/projects/-/CHITTYOS',
      '/Users/nb/Library/Caches',
      '/tmp'
    ];

    for (const scanBase of scanPaths) {
      // Scan .wrangler directories
      const wranglerPath = path.join(scanBase, '.wrangler');
      if (await this.exists(wranglerPath)) {
        const info = await this.analyzeDirectory(wranglerPath);
        if (info.size > 1024 * 1024) { // > 1MB
          discoveries.push({
            type: 'cache',
            path: wranglerPath,
            size: this.formatSize(info.size),
            sizeBytes: info.size,
            fileCount: info.fileCount,
            priority: 8,
            safe: true,
            reason: 'Wrangler build cache - safe to move'
          });
        }
      }

      // Scan node_modules/.cache
      const cachePath = path.join(scanBase, 'node_modules/.cache');
      if (await this.exists(cachePath)) {
        const info = await this.analyzeDirectory(cachePath);
        if (info.size > 1024 * 1024) {
          discoveries.push({
            type: 'cache',
            path: cachePath,
            size: this.formatSize(info.size),
            sizeBytes: info.size,
            fileCount: info.fileCount,
            priority: 7,
            safe: true,
            reason: 'Node modules cache - safe to move'
          });
        }
      }
    }

    // Scan for large log files in common locations
    const logPaths = [
      '/Users/nb/Library/Logs',
      '/tmp',
      this.basePath
    ];

    for (const logBase of logPaths) {
      if (await this.exists(logBase)) {
        const logs = await this.findFiles(logBase, '.log', 10 * 1024 * 1024);
        for (const log of logs) {
          discoveries.push({
            type: 'large_log',
            path: log.path,
            size: this.formatSize(log.size),
            sizeBytes: log.size,
            priority: log.size > 100 * 1024 * 1024 ? 9 : 6,
            safe: true,
            reason: 'Large log file - can be moved to ChittyHD'
          });
        }
      }
    }

    // Remove duplicates
    const seen = new Set();
    const unique = discoveries.filter(d => {
      if (seen.has(d.path)) return false;
      seen.add(d.path);
      return true;
    });

    return unique.sort((a, b) => b.priority - a.priority);
  }

  async cleanup(filePath, action) {
    try {
      const stats = await fs.stat(filePath);
      const sizeBefore = stats.isDirectory()
        ? (await this.analyzeDirectory(filePath)).size
        : stats.size;

      if (action === 'delete') {
        await fs.rm(filePath, { recursive: true, force: true });
        return {
          success: true,
          action: 'deleted',
          path: filePath,
          bytesFreed: sizeBefore
        };
      } else if (action === 'archive' || action === 'move') {
        // Move to ChittyHD - Data!
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const basename = path.basename(filePath);
        const archivePath = path.join(this.chittyhd, timestamp + '-' + basename);

        // Ensure ChittyHD archive dir exists
        await fs.mkdir(this.chittyhd, { recursive: true });

        // Move the file
        await fs.rename(filePath, archivePath);

        return {
          success: true,
          action: 'moved to ChittyHD',
          path: filePath,
          archivePath,
          bytesFreed: sizeBefore,
          destination: 'ChittyHD - Data'
        };
      }
    } catch (error) {
      return { success: false, error: error.message, path: filePath };
    }
  }

  async exists(p) {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  async analyzeDirectory(dir) {
    let size = 0;
    let fileCount = 0;

    try {
      const files = await fs.readdir(dir, { withFileTypes: true });
      for (const file of files) {
        const filePath = path.join(dir, file.name);
        try {
          if (file.isDirectory()) {
            const sub = await this.analyzeDirectory(filePath);
            size += sub.size;
            fileCount += sub.fileCount;
          } else {
            const stats = await fs.stat(filePath);
            size += stats.size;
            fileCount++;
          }
        } catch {}
      }
    } catch {}

    return { size, fileCount };
  }

  async findFiles(dir, ext, minSize, maxDepth = 3, currentDepth = 0) {
    const found = [];
    if (currentDepth > maxDepth) return found;

    try {
      const files = await fs.readdir(dir, { withFileTypes: true });
      for (const file of files) {
        const filePath = path.join(dir, file.name);
        try {
          if (file.isFile() && file.name.endsWith(ext)) {
            const stats = await fs.stat(filePath);
            if (stats.size >= minSize) {
              found.push({ path: filePath, size: stats.size });
            }
          } else if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules') {
            const sub = await this.findFiles(filePath, ext, minSize, maxDepth, currentDepth + 1);
            found.push(...sub);
          }
        } catch {}
      }
    } catch {}

    return found;
  }

  formatSize(bytes) {
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

const service = new CleanupService();

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/scan' && req.method === 'GET') {
    const discoveries = await service.scan();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ discoveries }));
    return;
  }

  if (url.pathname === '/cleanup' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      const { path: filePath, action } = JSON.parse(body);
      const result = await service.cleanup(filePath, action);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`✅ ChittySweep Cleanup Service running on http://localhost:${PORT}`);
  console.log(`📁 Scanning: ${service.basePath}`);
});
