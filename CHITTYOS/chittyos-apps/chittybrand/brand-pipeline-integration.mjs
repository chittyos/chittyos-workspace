#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BrandPipelineIntegration extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      chittyIdPath: '/Users/nb/.claude/projects/-/chittyid',
      chittyChainPath: '/Users/nb/.claude/projects/-/chittychain',
      chittyChatPath: '/Users/nb/.claude/projects/-/chittychat',
      chittyOsDataPath: '/Users/nb/.claude/projects/-/chittyos-data',
      brandProjectPath: '/Users/nb/.claude/projects/-/chittybrand',
      pollInterval: config.pollInterval || 5000,
      ...config
    };

    this.pipelines = new Map();
    this.activeMonitors = new Map();
    this.syncState = {
      lastSync: null,
      processedEvents: [],
      pendingEvents: [],
      metrics: {
        totalEvents: 0,
        successfulSyncs: 0,
        failedSyncs: 0
      }
    };
  }

  async initialize() {
    console.log('🚀 Initializing Brand Pipeline Integration...');

    // Create pipeline directories
    const pipelineDir = path.join(this.config.brandProjectPath, '.pipelines');
    await fs.mkdir(pipelineDir, { recursive: true });
    await fs.mkdir(path.join(pipelineDir, 'events'), { recursive: true });
    await fs.mkdir(path.join(pipelineDir, 'state'), { recursive: true });

    // Load existing state
    await this.loadState();

    // Setup pipelines
    await this.setupPipelines();

    return this;
  }

  async setupPipelines() {
    const pipelines = [
      {
        id: 'chitty-id',
        name: 'ChittyID Identity Pipeline',
        source: this.config.chittyIdPath,
        patterns: ['*.schema.json', '*.identity.json'],
        processor: this.processIdentityData.bind(this)
      },
      {
        id: 'chitty-chain',
        name: 'ChittyChain Blockchain Pipeline',
        source: this.config.chittyChainPath,
        patterns: ['*.chain.json', 'blocks/*.json'],
        processor: this.processChainData.bind(this)
      },
      {
        id: 'chitty-chat',
        name: 'ChittyChat Session Pipeline',
        source: this.config.chittyChatPath,
        patterns: ['sessions/*.json', 'cross-session-sync/*.json'],
        processor: this.processChatData.bind(this)
      },
      {
        id: 'chitty-os-data',
        name: 'ChittyOS Data Pipeline',
        source: this.config.chittyOsDataPath,
        patterns: ['*.jsonl', 'workers/*.js'],
        processor: this.processOsData.bind(this)
      }
    ];

    for (const pipeline of pipelines) {
      this.pipelines.set(pipeline.id, pipeline);
      console.log(`  ✅ Registered pipeline: ${pipeline.name}`);
    }
  }

  async processIdentityData(data, source) {
    return {
      type: 'identity',
      source,
      processed: Date.now(),
      data: {
        ...data,
        brandContext: 'chitty-identity-system'
      }
    };
  }

  async processChainData(data, source) {
    return {
      type: 'blockchain',
      source,
      processed: Date.now(),
      data: {
        ...data,
        brandContext: 'chitty-blockchain-ledger'
      }
    };
  }

  async processChatData(data, source) {
    return {
      type: 'chat-session',
      source,
      processed: Date.now(),
      data: {
        ...data,
        brandContext: 'chitty-conversation-flow'
      }
    };
  }

  async processOsData(data, source) {
    return {
      type: 'os-data',
      source,
      processed: Date.now(),
      data: {
        ...data,
        brandContext: 'chitty-os-infrastructure'
      }
    };
  }

  async startMonitoring() {
    console.log('\n📡 Starting pipeline monitoring...');

    for (const [id, pipeline] of this.pipelines.entries()) {
      const monitor = setInterval(async () => {
        await this.checkPipeline(pipeline);
      }, this.config.pollInterval);

      this.activeMonitors.set(id, monitor);
      console.log(`  👁️  Monitoring: ${pipeline.name}`);
    }

    // Event handling
    this.on('event', this.handleEvent.bind(this));
    this.on('sync', this.performSync.bind(this));

    return this;
  }

  async checkPipeline(pipeline) {
    try {
      const sourceStat = await fs.stat(pipeline.source).catch(() => null);

      if (sourceStat && sourceStat.mtimeMs > (this.syncState.lastSync || 0)) {
        const event = {
          id: `${pipeline.id}-${Date.now()}`,
          pipeline: pipeline.id,
          timestamp: Date.now(),
          type: 'data-change',
          source: pipeline.source
        };

        this.emit('event', event);
      }
    } catch (error) {
      console.error(`Error checking pipeline ${pipeline.id}:`, error.message);
    }
  }

  async handleEvent(event) {
    this.syncState.pendingEvents.push(event);
    this.syncState.metrics.totalEvents++;

    // Process in batches
    if (this.syncState.pendingEvents.length >= 5) {
      this.emit('sync');
    }
  }

  async performSync() {
    if (this.syncState.pendingEvents.length === 0) return;

    console.log(`\n🔄 Syncing ${this.syncState.pendingEvents.length} events...`);
    const events = [...this.syncState.pendingEvents];
    this.syncState.pendingEvents = [];

    for (const event of events) {
      try {
        const pipeline = this.pipelines.get(event.pipeline);
        if (pipeline && pipeline.processor) {
          const processed = await pipeline.processor({}, event.source);

          // Store processed event
          const eventFile = path.join(
            this.config.brandProjectPath,
            '.pipelines',
            'events',
            `${event.id}.json`
          );

          await fs.writeFile(eventFile, JSON.stringify({
            ...event,
            processed
          }, null, 2));

          this.syncState.processedEvents.push(event.id);
          this.syncState.metrics.successfulSyncs++;
          console.log(`  ✅ Processed: ${event.id}`);
        }
      } catch (error) {
        this.syncState.metrics.failedSyncs++;
        console.error(`  ❌ Failed: ${event.id} - ${error.message}`);
      }
    }

    this.syncState.lastSync = Date.now();
    await this.saveState();
  }

  async loadState() {
    const stateFile = path.join(
      this.config.brandProjectPath,
      '.pipelines',
      'state',
      'sync-state.json'
    );

    try {
      const data = await fs.readFile(stateFile, 'utf8');
      this.syncState = JSON.parse(data);
      console.log('  📂 Loaded previous sync state');
    } catch (error) {
      console.log('  📝 No previous state, starting fresh');
    }
  }

  async saveState() {
    const stateFile = path.join(
      this.config.brandProjectPath,
      '.pipelines',
      'state',
      'sync-state.json'
    );

    await fs.writeFile(stateFile, JSON.stringify(this.syncState, null, 2));
  }

  async getMetrics() {
    return {
      ...this.syncState.metrics,
      lastSync: this.syncState.lastSync ? new Date(this.syncState.lastSync).toISOString() : null,
      pendingEvents: this.syncState.pendingEvents.length,
      processedEvents: this.syncState.processedEvents.length,
      pipelines: Array.from(this.pipelines.keys())
    };
  }

  async stopMonitoring() {
    console.log('\n🛑 Stopping pipeline monitoring...');

    for (const [id, monitor] of this.activeMonitors.entries()) {
      clearInterval(monitor);
      console.log(`  ⏹️  Stopped: ${id}`);
    }

    this.activeMonitors.clear();

    // Final sync
    if (this.syncState.pendingEvents.length > 0) {
      await this.performSync();
    }

    await this.saveState();
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  (async () => {
    const integration = new BrandPipelineIntegration();
    await integration.initialize();

    switch (command) {
      case 'start':
        await integration.startMonitoring();
        console.log('\n✨ Pipeline integration active');
        console.log('Press Ctrl+C to stop\n');

        // Status updates
        setInterval(async () => {
          const metrics = await integration.getMetrics();
          console.log(`📊 Status: ${metrics.totalEvents} events, ${metrics.successfulSyncs} synced, ${metrics.pendingEvents} pending`);
        }, 10000);

        // Keep running
        process.on('SIGINT', async () => {
          await integration.stopMonitoring();
          process.exit(0);
        });
        break;

      case 'status':
        const metrics = await integration.getMetrics();
        console.log('\n📊 Pipeline Integration Status:');
        console.log('=' .repeat(60));
        console.log(`Total Events: ${metrics.totalEvents}`);
        console.log(`Successful Syncs: ${metrics.successfulSyncs}`);
        console.log(`Failed Syncs: ${metrics.failedSyncs}`);
        console.log(`Pending Events: ${metrics.pendingEvents}`);
        console.log(`Processed Events: ${metrics.processedEvents}`);
        console.log(`Last Sync: ${metrics.lastSync || 'Never'}`);
        console.log(`Active Pipelines: ${metrics.pipelines.join(', ')}`);
        console.log('=' .repeat(60));
        break;

      case 'sync':
        await integration.startMonitoring();
        setTimeout(async () => {
          await integration.performSync();
          await integration.stopMonitoring();
          console.log('✅ Manual sync completed');
        }, 1000);
        break;

      default:
        console.log('Usage: node brand-pipeline-integration.mjs [start|status|sync]');
        console.log('\nCommands:');
        console.log('  start  - Start monitoring pipelines');
        console.log('  status - Show current status');
        console.log('  sync   - Perform manual sync');
    }
  })().catch(console.error);
}

export default BrandPipelineIntegration;