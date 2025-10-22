#!/usr/bin/env node

/**
 * Fix Field Mapping
 * Adjusts the field mappings to work with the existing database schema
 */

import { writeFileSync, readFileSync } from 'fs';

// Read the current config
const configPath = './notion-sync-config.js';
const configContent = readFileSync(configPath, 'utf8');

// Create the corrected field mapping
const correctedMapping = `  // Field mapping: Source → Notion property (mapped to existing schema)
  fieldMap: {
    factId: 'Fact',              // title property (must be unique for title)
    parentArtifactId: 'ExtractedFrom',
    factText: 'SupportingEvidence',  // Changed from 'Fact' to avoid conflict with title
    factType: 'FactType',
    locationRef: 'ExtractedFrom',    // Changed to use ExtractedFrom for location
    classification: 'VerificationStatus',
    weight: 'Confidence',
    credibility: 'ExtractedFrom',    // Changed to use ExtractedFrom
    chainStatus: 'VerificationStatus',
    verifiedAt: 'ExtractedDate',
    verificationMethod: 'ExtractedFrom',
    externalId: 'ExtractedFrom',     // Changed to avoid conflict with title
    syncedAt: 'ExtractedDate',
    sourceSystem: 'ExtractedFrom',
    trustScore: 'TrustScore',
  },`;

// Replace the field mapping section
const updatedConfig = configContent.replace(
  /\/\/ Field mapping:[\s\S]*?trustScore: 'TrustScore',\s*},/,
  correctedMapping
);

// Write the updated config
writeFileSync(configPath, updatedConfig);

console.log('✅ Field mapping updated to resolve conflicts');
console.log('\n📋 Changes made:');
console.log('  • factText → SupportingEvidence (was conflicting with title field)');
console.log('  • locationRef → ExtractedFrom');
console.log('  • credibility → ExtractedFrom');
console.log('  • verificationMethod → ExtractedFrom');
console.log('  • externalId → ExtractedFrom');
console.log('\nThis avoids the conflict where multiple fields were trying to use "Fact" as both title and rich_text.');