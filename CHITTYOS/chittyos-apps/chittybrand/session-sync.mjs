#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BrandSessionSync {
  constructor(config = {}) {
    this.baseDir = config.baseDir || path.join(process.cwd(), '.sync');
    this.sessionsDir = path.join(this.baseDir, 'sessions');
    this.brandDataDir = path.join(this.baseDir, 'brand-data');
    this.heartbeatInterval = config.heartbeatInterval || 5000;
    this.sessionTimeout = config.sessionTimeout || 30000;
    this.sessionId = null;
    this.sessionData = null;
    this.heartbeatTimer = null;
  }

  async initialize() {
    await fs.mkdir(this.sessionsDir, { recursive: true });
    await fs.mkdir(this.brandDataDir, { recursive: true });
    await this.cleanupStaleSessions();
  }

  async syncBrandSession(brandInfo = {}) {
    console.log('🔄 Starting brand session sync...');

    // Register session
    this.sessionId = this.generateSessionId();
    this.sessionData = {
      id: this.sessionId,
      name: brandInfo.name || `brand-session-${this.sessionId.slice(0, 8)}`,
      type: 'brand-sync',
      startTime: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'active',
      brandInfo: brandInfo,
      syncedResources: [],
      locks: []
    };

    const sessionFile = path.join(this.sessionsDir, `${this.sessionId}.json`);
    await fs.writeFile(sessionFile, JSON.stringify(this.sessionData, null, 2));

    // Sync brand resources
    await this.syncBrandResources();

    // Start heartbeat
    this.startHeartbeat();

    // Setup cleanup handlers
    process.on('exit', () => this.cleanup());
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());

    return this.sessionData;
  }

  async syncBrandResources() {
    const resources = [
      { type: 'schema', path: '/Users/nb/.claude/projects/-/chittyid/chitty-identity.schema.json' },
      { type: 'chain-data', path: '/Users/nb/.claude/projects/-/chittychain/' },
      { type: 'brand-data', path: '/Users/nb/.claude/projects/-/brand/' },
      { type: 'chat-sessions', path: '/Users/nb/.claude/projects/-/chittychat/' }
    ];

    for (const resource of resources) {
      try {
        const stat = await fs.stat(resource.path).catch(() => null);
        if (stat) {
          this.sessionData.syncedResources.push({
            ...resource,
            synced: true,
            timestamp: Date.now(),
            size: stat.size || 0
          });
          console.log(`✅ Synced: ${resource.type}`);
        }
      } catch (error) {
        console.error(`❌ Failed to sync ${resource.type}:`, error.message);
      }
    }

    // Save sync state
    const syncStateFile = path.join(this.brandDataDir, `sync-state-${Date.now()}.json`);
    await fs.writeFile(syncStateFile, JSON.stringify({
      sessionId: this.sessionId,
      timestamp: Date.now(),
      resources: this.sessionData.syncedResources
    }, null, 2));
  }

  async getActiveSessions() {
    const sessions = [];
    const files = await fs.readdir(this.sessionsDir).catch(() => []);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const sessionFile = path.join(this.sessionsDir, file);
        const data = JSON.parse(await fs.readFile(sessionFile, 'utf8'));

        const isActive =
          data.status === 'active' &&
          (Date.now() - data.lastHeartbeat) < this.sessionTimeout;

        if (isActive) {
          sessions.push(data);
        }
      } catch (error) {
        console.error(`Error reading session ${file}:`, error.message);
      }
    }

    return sessions;
  }

  async updateSession(updates) {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const sessionFile = path.join(this.sessionsDir, `${this.sessionId}.json`);

    try {
      const data = JSON.parse(await fs.readFile(sessionFile, 'utf8'));
      Object.assign(data, updates);
      data.lastUpdate = Date.now();
      await fs.writeFile(sessionFile, JSON.stringify(data, null, 2));
      this.sessionData = data;
      return data;
    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(async () => {
      if (this.sessionId) {
        try {
          await this.updateSession({ lastHeartbeat: Date.now() });
        } catch (error) {
          console.error('Heartbeat error:', error);
        }
      }
    }, this.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  async cleanupStaleSessions() {
    const files = await fs.readdir(this.sessionsDir).catch(() => []);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const sessionFile = path.join(this.sessionsDir, file);
        const data = JSON.parse(await fs.readFile(sessionFile, 'utf8'));

        const isStale =
          data.status === 'terminated' ||
          (Date.now() - data.lastHeartbeat) > this.sessionTimeout * 2;

        if (isStale) {
          await fs.unlink(sessionFile);
          console.log(`🧹 Cleaned up stale session: ${file}`);
        }
      } catch (error) {
        console.error(`Error cleaning up session ${file}:`, error.message);
      }
    }
  }

  async cleanup() {
    if (!this.sessionId) return;

    this.stopHeartbeat();

    try {
      const sessionFile = path.join(this.sessionsDir, `${this.sessionId}.json`);
      const data = JSON.parse(await fs.readFile(sessionFile, 'utf8'));
      data.status = 'terminated';
      data.endTime = Date.now();
      await fs.writeFile(sessionFile, JSON.stringify(data, null, 2));

      // Archive session after delay
      setTimeout(async () => {
        try {
          await fs.unlink(sessionFile);
        } catch (e) {}
      }, 60000);
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  async listSessions() {
    const sessions = await this.getActiveSessions();
    console.log('\n📊 Active Brand Sessions:');
    console.log('=' .repeat(60));

    if (sessions.length === 0) {
      console.log('No active sessions');
    } else {
      sessions.forEach(s => {
        const runtime = Math.round((Date.now() - s.startTime) / 1000);
        console.log(`\n🔸 ${s.name}`);
        console.log(`   ID: ${s.id.slice(0, 8)}`);
        console.log(`   Type: ${s.type}`);
        console.log(`   Started: ${new Date(s.startTime).toLocaleString()}`);
        console.log(`   Runtime: ${runtime}s`);
        console.log(`   Resources: ${s.syncedResources?.length || 0} synced`);
      });
    }
    console.log('\n' + '=' .repeat(60));
  }

  async getSyncState() {
    const files = await fs.readdir(this.brandDataDir).catch(() => []);
    const states = [];

    for (const file of files) {
      if (file.startsWith('sync-state-')) {
        try {
          const content = await fs.readFile(path.join(this.brandDataDir, file), 'utf8');
          states.push(JSON.parse(content));
        } catch (error) {
          console.error(`Error reading sync state ${file}:`, error.message);
        }
      }
    }

    return states.sort((a, b) => b.timestamp - a.timestamp);
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const sync = new BrandSessionSync();
  const command = process.argv[2];

  (async () => {
    await sync.initialize();

    switch (command) {
      case 'sync':
        const brandInfo = {
          name: process.argv[3] || 'default-brand',
          environment: process.env.NODE_ENV || 'development'
        };
        const session = await sync.syncBrandSession(brandInfo);
        console.log('\n✨ Brand session synced:', session.id.slice(0, 8));

        // Keep running for monitoring
        setInterval(() => {}, 1000);
        break;

      case 'list':
        await sync.listSessions();
        break;

      case 'state':
        const states = await sync.getSyncState();
        console.log('\n📋 Sync States:');
        states.slice(0, 5).forEach(state => {
          console.log(`\n  • Session: ${state.sessionId.slice(0, 8)}`);
          console.log(`    Time: ${new Date(state.timestamp).toLocaleString()}`);
          console.log(`    Resources: ${state.resources.length}`);
        });
        break;

      case 'cleanup':
        await sync.cleanupStaleSessions();
        console.log('✅ Cleanup completed');
        break;

      default:
        console.log('Usage: node session-sync.mjs [sync|list|state|cleanup] [name]');
        console.log('\nCommands:');
        console.log('  sync [name]  - Start a new brand sync session');
        console.log('  list         - List active sessions');
        console.log('  state        - Show sync state history');
        console.log('  cleanup      - Clean up stale sessions');
    }
  })().catch(console.error);
}

export default BrandSessionSync;