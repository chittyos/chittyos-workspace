#!/usr/bin/env node
/**
 * Setup R2 buckets for ChittySweep
 */

import { execSync } from 'child_process';

const buckets = [
  { name: 'chittysweep-logs', description: 'ChittySweep audit logs and reports' }
];

console.log('🪣 Setting up R2 buckets for ChittySweep...\n');

for (const bucket of buckets) {
  try {
    console.log(`Creating R2 bucket: ${bucket.name}`);
    console.log(`Description: ${bucket.description}`);

    const cmd = `wrangler r2 bucket create ${bucket.name}`;
    const output = execSync(cmd, { encoding: 'utf-8' });

    console.log(output);
    console.log(`✅ Bucket created: ${bucket.name}\n`);

  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log(`⚠️  Bucket ${bucket.name} already exists\n`);
    } else {
      console.error(`❌ Failed to create ${bucket.name}:`, error.message);
    }
  }
}

console.log('\n✨ R2 setup complete!');
