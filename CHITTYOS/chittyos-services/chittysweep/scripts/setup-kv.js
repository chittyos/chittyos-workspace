#!/usr/bin/env node
/**
 * Setup KV namespaces for ChittySweep
 */

import { execSync } from 'child_process';

const namespaces = [
  { name: 'SWEEP_STATE', binding: 'SWEEP_STATE' },
  { name: 'SWEEP_DISCOVERIES', binding: 'SWEEP_DISCOVERIES' },
  { name: 'SWEEP_METRICS', binding: 'SWEEP_METRICS' }
];

console.log('🔧 Setting up KV namespaces for ChittySweep...\n');

for (const ns of namespaces) {
  try {
    console.log(`Creating KV namespace: ${ns.name}`);

    // Create production namespace
    const prodCmd = `wrangler kv:namespace create "${ns.name}"`;
    const prodOutput = execSync(prodCmd, { encoding: 'utf-8' });
    console.log(prodOutput);

    // Extract ID from output
    const idMatch = prodOutput.match(/id = "([^"]+)"/);
    if (idMatch) {
      console.log(`✅ Production ID: ${idMatch[1]}\n`);
    }

  } catch (error) {
    console.error(`❌ Failed to create ${ns.name}:`, error.message);
  }
}

console.log('\n📝 Update wrangler.toml with the IDs shown above');
console.log('Replace "sweep_state_production", "sweep_discoveries", "sweep_metrics" with actual IDs\n');
