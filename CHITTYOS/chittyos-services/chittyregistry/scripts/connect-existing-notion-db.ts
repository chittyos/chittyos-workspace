#!/usr/bin/env node
/**
 * Connect ChittyRegistry to Existing Notion Database
 *
 * This script connects the ChittyRegistry to an existing Notion database
 * (ChittyCanon: 429f54c480c04d64ab96cf9bdbc717cb) and sets up bidirectional sync.
 */

import { Client } from '@notionhq/client';
import { DatabaseObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// Existing ChittyCanon database ID from the shared link
const CHITTYCANON_DB_ID = '429f54c480c04d64ab96cf9bdbc717cb';

interface DatabaseAnalysis {
  id: string;
  title: string;
  properties: Record<string, any>;
  url: string;
  type: 'registry' | 'schema' | 'gov' | 'chronicle' | 'canon' | 'unknown';
}

/**
 * Analyze existing Notion database structure
 */
async function analyzeDatabase(databaseId: string): Promise<DatabaseAnalysis> {
  try {
    console.log(`📊 Analyzing database: ${databaseId}`);

    const database = await notion.databases.retrieve({ database_id: databaseId });

    // Extract title
    const titleProperty = (database as DatabaseObjectResponse).title[0];
    const title = titleProperty?.plain_text || 'Untitled Database';

    // Extract properties
    const properties = database.properties;

    // Determine database type based on properties
    let type: DatabaseAnalysis['type'] = 'unknown';
    const propNames = Object.keys(properties).map(k => k.toLowerCase());

    if (propNames.includes('canon') || title.toLowerCase().includes('canon')) {
      type = 'canon';
    } else if (propNames.includes('tool') || propNames.includes('service')) {
      type = 'registry';
    } else if (propNames.includes('entity') || propNames.includes('schema')) {
      type = 'schema';
    } else if (propNames.includes('policy') || propNames.includes('governance')) {
      type = 'gov';
    } else if (propNames.includes('event') || propNames.includes('timestamp')) {
      type = 'chronicle';
    }

    console.log(`✅ Database "${title}" analyzed (type: ${type})`);
    console.log(`   Properties: ${Object.keys(properties).length}`);
    console.log(`   Property names: ${Object.keys(properties).join(', ')}`);

    return {
      id: databaseId,
      title,
      properties,
      url: (database as DatabaseObjectResponse).url,
      type
    };
  } catch (error: any) {
    console.error(`❌ Failed to analyze database: ${error.message}`);
    throw error;
  }
}

/**
 * Query existing entries in database
 */
async function queryDatabaseEntries(databaseId: string, limit: number = 10) {
  try {
    console.log(`\n📋 Querying entries (limit: ${limit})`);

    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: limit
    });

    console.log(`   Found ${response.results.length} entries`);

    // Display sample entries
    for (const page of response.results.slice(0, 3)) {
      if ('properties' in page) {
        const titleProp = Object.values(page.properties).find(
          (prop: any) => prop.type === 'title'
        ) as any;

        const title = titleProp?.title?.[0]?.plain_text || 'Untitled';
        console.log(`   - ${title} (${page.id})`);
      }
    }

    return response.results;
  } catch (error: any) {
    console.error(`❌ Failed to query entries: ${error.message}`);
    throw error;
  }
}

/**
 * Update .env file with database ID
 */
function updateEnvFile(dbType: string, dbId: string) {
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');

  // Check if .env exists, if not copy from .env.example
  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
      console.log('✅ Created .env from .env.example');
    } else {
      console.error('❌ No .env or .env.example found');
      return;
    }
  }

  let envContent = fs.readFileSync(envPath, 'utf-8');

  // Determine which env variable to update
  const envVarMap: Record<string, string> = {
    'canon': 'CHITTYCANON_NOTION_DB_ID',
    'registry': 'CHITTYREGISTRY_NOTION_DB_ID',
    'schema': 'CHITTYSCHEMA_NOTION_DB_ID',
    'gov': 'CHITTYGOV_NOTION_DB_ID',
    'chronicle': 'CHITTYCHRONICLE_NOTION_DB_ID'
  };

  const envVar = envVarMap[dbType];
  if (!envVar) {
    console.warn(`⚠️  Unknown database type: ${dbType}`);
    return;
  }

  // Update or add the environment variable
  const regex = new RegExp(`^${envVar}=.*$`, 'm');
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `${envVar}=${dbId}`);
    console.log(`✅ Updated ${envVar} in .env`);
  } else {
    envContent += `\n${envVar}=${dbId}\n`;
    console.log(`✅ Added ${envVar} to .env`);
  }

  fs.writeFileSync(envPath, envContent);
}

/**
 * Generate sync configuration
 */
function generateSyncConfig(analysis: DatabaseAnalysis) {
  const configPath = path.join(process.cwd(), 'notion-sync-config.json');

  const config = {
    databases: {
      [analysis.type]: {
        id: analysis.id,
        title: analysis.title,
        url: analysis.url,
        properties: Object.keys(analysis.properties),
        syncEnabled: true,
        syncInterval: analysis.type === 'chronicle' ? 30000 : 300000,
        lastSync: new Date().toISOString()
      }
    },
    webhooks: {
      enabled: false,
      secret: process.env.NOTION_WEBHOOK_SECRET || 'chitty-notion-secret-key',
      endpoints: {
        [analysis.type]: `/api/notion/webhooks/${analysis.type}`
      }
    }
  };

  // Merge with existing config if it exists
  let existingConfig = {};
  if (fs.existsSync(configPath)) {
    existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  const mergedConfig = {
    ...existingConfig,
    databases: {
      ...(existingConfig as any).databases,
      ...config.databases
    },
    webhooks: {
      ...(existingConfig as any).webhooks,
      ...config.webhooks
    }
  };

  fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2));
  console.log(`✅ Sync configuration saved to notion-sync-config.json`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 ChittyRegistry → Notion Database Connection\n');
  console.log('━'.repeat(60));

  // Validate environment
  if (!process.env.NOTION_TOKEN) {
    console.error('❌ NOTION_TOKEN not found in environment');
    console.error('   Set it in .env: NOTION_TOKEN=secret_xxxxx');
    process.exit(1);
  }

  try {
    // Analyze the ChittyCanon database
    console.log('\n📊 Step 1: Analyze Existing Database');
    console.log('━'.repeat(60));
    const analysis = await analyzeDatabase(CHITTYCANON_DB_ID);

    // Query sample entries
    console.log('\n📋 Step 2: Query Existing Entries');
    console.log('━'.repeat(60));
    const entries = await queryDatabaseEntries(CHITTYCANON_DB_ID, 10);

    // Update environment configuration
    console.log('\n⚙️  Step 3: Update Configuration');
    console.log('━'.repeat(60));
    updateEnvFile(analysis.type, analysis.id);

    // Generate sync configuration
    generateSyncConfig(analysis);

    // Summary
    console.log('\n✅ Connection Complete!');
    console.log('━'.repeat(60));
    console.log(`Database: ${analysis.title}`);
    console.log(`Type: ${analysis.type}`);
    console.log(`ID: ${analysis.id}`);
    console.log(`Properties: ${Object.keys(analysis.properties).length}`);
    console.log(`Entries: ${entries.length}+`);
    console.log(`URL: ${analysis.url}`);

    console.log('\n📝 Next Steps:');
    console.log('   1. Review notion-sync-config.json');
    console.log('   2. Start sync daemon: npm run sync:notion:start');
    console.log('   3. Configure webhooks (optional): see NOTION-SYNC.md');
    console.log('   4. Test sync: npm run test:notion:sync');

  } catch (error: any) {
    console.error('\n❌ Connection failed:', error.message);
    if (error.code === 'object_not_found') {
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Ensure the database ID is correct');
      console.error('   2. Share the database with your Notion integration');
      console.error('   3. Check integration has proper permissions');
    }
    process.exit(1);
  }
}

// Execute
if (require.main === module) {
  main();
}

export { analyzeDatabase, queryDatabaseEntries, updateEnvFile, generateSyncConfig };
