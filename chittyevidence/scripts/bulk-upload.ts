#!/usr/bin/env npx tsx
// ============================================
// BULK UPLOAD SCRIPT
// Uploads preprocessed files to Chitty Evidence Platform
// ============================================

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

// Configuration
const CONFIG = {
  apiUrl: process.env.API_URL || 'http://localhost:8787',
  manifestPath: process.env.MANIFEST_PATH || './preprocessed/MANIFEST.csv',
  uploadedBy: process.env.UPLOADED_BY || 'bulk-import',
  clientId: process.env.CLIENT_ID || undefined,
  concurrency: parseInt(process.env.CONCURRENCY || '5'),
  delayMs: parseInt(process.env.DELAY_MS || '100'),
  dryRun: process.env.DRY_RUN === 'true',
};

interface ManifestRow {
  file_path: string;
  sha256: string;
  size_bytes: string;
  mime_type: string;
  original_name: string;
}

interface UploadResult {
  hash: string;
  status: 'success' | 'duplicate' | 'error';
  documentId?: string;
  message?: string;
}

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
};

function log(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadFile(row: ManifestRow): Promise<UploadResult> {
  try {
    const fileBuffer = fs.readFileSync(row.file_path);
    const blob = new Blob([fileBuffer], { type: row.mime_type });

    const formData = new FormData();
    formData.append('file', blob, row.original_name);
    formData.append('hash', row.sha256);
    formData.append('uploadedBy', CONFIG.uploadedBy);
    if (CONFIG.clientId) {
      formData.append('clientId', CONFIG.clientId);
    }

    const response = await fetch(`${CONFIG.apiUrl}/documents`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (result.status === 'duplicate') {
      return {
        hash: row.sha256,
        status: 'duplicate',
        documentId: result.existingDocumentId,
        message: 'Document already exists',
      };
    }

    if (result.status === 'processing') {
      return {
        hash: row.sha256,
        status: 'success',
        documentId: result.documentId,
        message: 'Upload successful, processing started',
      };
    }

    return {
      hash: row.sha256,
      status: 'error',
      message: result.error || 'Unknown error',
    };
  } catch (error) {
    return {
      hash: row.sha256,
      status: 'error',
      message: String(error),
    };
  }
}

async function uploadBatch(rows: ManifestRow[]): Promise<UploadResult[]> {
  const results: UploadResult[] = [];

  for (const row of rows) {
    if (CONFIG.dryRun) {
      results.push({
        hash: row.sha256,
        status: 'success',
        message: '[DRY RUN] Would upload',
      });
    } else {
      const result = await uploadFile(row);
      results.push(result);
    }
    await sleep(CONFIG.delayMs);
  }

  return results;
}

async function main() {
  console.log();
  log('blue', '========================================');
  log('blue', '   Chitty Evidence Bulk Uploader');
  log('blue', '========================================');
  console.log();

  // Check manifest exists
  if (!fs.existsSync(CONFIG.manifestPath)) {
    log('red', `Error: Manifest not found at ${CONFIG.manifestPath}`);
    log('yellow', 'Run preprocessing first: npm run preprocess <input_dir>');
    process.exit(1);
  }

  // Parse manifest
  const manifestContent = fs.readFileSync(CONFIG.manifestPath, 'utf-8');
  const rows = parse(manifestContent, {
    columns: true,
    skip_empty_lines: true,
  }) as ManifestRow[];

  log('dim', `API URL: ${CONFIG.apiUrl}`);
  log('dim', `Manifest: ${CONFIG.manifestPath}`);
  log('dim', `Files to upload: ${rows.length}`);
  log('dim', `Concurrency: ${CONFIG.concurrency}`);
  if (CONFIG.dryRun) {
    log('yellow', '*** DRY RUN MODE - No actual uploads ***');
  }
  console.log();

  // Statistics
  const stats = {
    total: rows.length,
    success: 0,
    duplicate: 0,
    error: 0,
  };

  const errors: { hash: string; message: string }[] = [];
  const startTime = Date.now();

  // Process in batches
  const batches: ManifestRow[][] = [];
  for (let i = 0; i < rows.length; i += CONFIG.concurrency) {
    batches.push(rows.slice(i, i + CONFIG.concurrency));
  }

  let processed = 0;
  for (const batch of batches) {
    const results = await uploadBatch(batch);

    for (const result of results) {
      processed++;
      switch (result.status) {
        case 'success':
          stats.success++;
          process.stdout.write(colors.green + '.' + colors.reset);
          break;
        case 'duplicate':
          stats.duplicate++;
          process.stdout.write(colors.yellow + 'd' + colors.reset);
          break;
        case 'error':
          stats.error++;
          process.stdout.write(colors.red + 'x' + colors.reset);
          errors.push({ hash: result.hash, message: result.message || 'Unknown' });
          break;
      }

      // Newline every 50 files
      if (processed % 50 === 0) {
        console.log(` ${processed}/${stats.total}`);
      }
    }
  }

  const duration = (Date.now() - startTime) / 1000;

  console.log();
  console.log();
  log('blue', '========================================');
  log('blue', '   Upload Complete');
  log('blue', '========================================');
  console.log();
  log('dim', `Duration: ${duration.toFixed(1)}s`);
  log('dim', `Rate: ${(stats.total / duration).toFixed(1)} files/sec`);
  console.log();
  log('green', `Success:    ${stats.success}`);
  log('yellow', `Duplicates: ${stats.duplicate}`);
  log('red', `Errors:     ${stats.error}`);
  console.log();

  // Write error log if any
  if (errors.length > 0) {
    const errorLogPath = path.join(path.dirname(CONFIG.manifestPath), 'ERRORS.txt');
    const errorLog = errors.map((e) => `${e.hash}: ${e.message}`).join('\n');
    fs.writeFileSync(errorLogPath, errorLog);
    log('yellow', `Error details written to: ${errorLogPath}`);
  }

  // Write results summary
  const summaryPath = path.join(path.dirname(CONFIG.manifestPath), 'UPLOAD_SUMMARY.json');
  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        config: CONFIG,
        stats,
        duration,
        errors,
      },
      null,
      2
    )
  );
  log('dim', `Summary written to: ${summaryPath}`);

  console.log();
  if (stats.error > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  log('red', `Fatal error: ${error}`);
  process.exit(1);
});
