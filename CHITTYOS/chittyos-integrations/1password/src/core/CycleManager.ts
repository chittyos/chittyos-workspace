import { CyclingConfig, CyclingRule, SecretItem } from '../types';
import { Logger } from '../utils/Logger';

export class CycleManager {
  private config: CyclingConfig;
  private logger: Logger;
  private cycleTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: CyclingConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('Secret cycling is disabled');
      return;
    }

    this.logger.info('Initializing cycle manager...');

    // Start periodic cycle checks
    this.startCycleScheduler();

    this.logger.info('Cycle manager initialized');
  }

  async cycleEnvironmentSecrets(environment: string, secretsManager: any): Promise<void> {
    this.logger.info(`Starting secret cycling for environment: ${environment}`);

    const envConfig = secretsManager.config.environments.find((e: any) => e.name === environment);
    if (!envConfig) {
      this.logger.error(`Environment ${environment} not found`);
      return;
    }

    for (const secretMapping of envConfig.secrets) {
      if (secretMapping.cycleInterval || this.shouldCycleSecret(secretMapping.key)) {
        await this.cycleSecret(secretMapping, environment, secretsManager);
      }
    }
  }

  private async cycleSecret(secretMapping: any, environment: string, secretsManager: any): Promise<void> {
    const { key, source } = secretMapping;

    try {
      this.logger.info(`Cycling secret: ${key} in environment: ${environment}`);

      // Find applicable cycling rule
      const rule = this.findCyclingRule(key);
      const strategy = rule?.strategy || 'regenerate';

      let newValue: string;

      switch (strategy) {
        case 'regenerate':
          newValue = await this.regenerateSecret(source, secretsManager);
          break;
        case 'rotate':
          newValue = await this.rotateSecret(source, secretsManager);
          break;
        case 'custom':
          newValue = await this.executeCustomCycling(rule!, source, secretsManager);
          break;
        default:
          throw new Error(`Unknown cycling strategy: ${strategy}`);
      }

      // Update the secret
      await secretsManager.setSecret(key, newValue, environment);

      // Send notifications if configured
      await this.sendCyclingNotification(key, environment, 'success');

      this.logger.info(`Successfully cycled secret: ${key}`);

    } catch (error) {
      this.logger.error(`Failed to cycle secret ${key}:`, error);
      await this.sendCyclingNotification(key, environment, 'failed', error);
    }
  }

  private async regenerateSecret(source: string, secretsManager: any): Promise<string> {
    // Generate a new password using 1Password's generator
    return await secretsManager.provider.generatePassword({
      length: 32,
      characterSets: ['LETTERS', 'DIGITS', 'SYMBOLS']
    });
  }

  private async rotateSecret(source: string, secretsManager: any): Promise<string> {
    // For rotation, we might implement more complex logic
    // For now, just regenerate (can be extended for API key rotation, etc.)
    return await this.regenerateSecret(source, secretsManager);
  }

  private async executeCustomCycling(rule: CyclingRule, source: string, secretsManager: any): Promise<string> {
    // Load and execute custom cycling handler
    if (!rule.customHandler) {
      throw new Error('Custom cycling rule requires customHandler');
    }

    try {
      const handler = await import(rule.customHandler);
      return await handler.cycle(source, secretsManager);
    } catch (error) {
      this.logger.error(`Failed to execute custom cycling handler: ${rule.customHandler}`, error);
      throw error;
    }
  }

  private findCyclingRule(secretKey: string): CyclingRule | null {
    return this.config.rules.find(rule => {
      const regex = new RegExp(rule.pattern);
      return regex.test(secretKey);
    }) || null;
  }

  private shouldCycleSecret(secretKey: string): boolean {
    const rule = this.findCyclingRule(secretKey);
    if (!rule) return false;

    // For now, implement simple time-based cycling
    // In a real implementation, you'd track last cycle times
    return true;
  }

  private startCycleScheduler(): void {
    // Check for secrets to cycle every hour
    const checkInterval = 60 * 60 * 1000; // 1 hour

    const timer = setInterval(async () => {
      this.logger.debug('Running scheduled cycle check...');
      // Implementation would check for secrets due for cycling
      // and trigger cycling process
    }, checkInterval);

    this.cycleTimers.set('scheduler', timer);
  }

  private async sendCyclingNotification(
    secretKey: string,
    environment: string,
    status: 'success' | 'failed',
    error?: any
  ): Promise<void> {
    if (!this.config.notifications) return;

    const message = status === 'success'
      ? `Secret ${secretKey} in ${environment} was successfully cycled`
      : `Failed to cycle secret ${secretKey} in ${environment}: ${error?.message || 'Unknown error'}`;

    try {
      // Webhook notification
      if (this.config.notifications.webhook) {
        await this.sendWebhookNotification(this.config.notifications.webhook, {
          secretKey,
          environment,
          status,
          message,
          timestamp: new Date().toISOString()
        });
      }

      // Slack notification
      if (this.config.notifications.slack) {
        await this.sendSlackNotification(this.config.notifications.slack, message);
      }

      // Email notification would be implemented here
      // if (this.config.notifications.email) { ... }

    } catch (notificationError) {
      this.logger.error('Failed to send cycling notification:', notificationError);
    }
  }

  private async sendWebhookNotification(webhookUrl: string, payload: any): Promise<void> {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook notification failed: ${response.statusText}`);
    }
  }

  private async sendSlackNotification(slackUrl: string, message: string): Promise<void> {
    const payload = {
      text: message,
      channel: '#secrets-management',
      username: 'Secrets Manager',
      icon_emoji: ':key:'
    };

    const response = await fetch(slackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.statusText}`);
    }
  }

  parseInterval(interval: string): number {
    // Parse intervals like "30d", "1w", "6h", "30m"
    const match = interval.match(/^(\d+)([dwmh])$/);
    if (!match) {
      throw new Error(`Invalid interval format: ${interval}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'm': return value * 60 * 1000; // minutes
      case 'h': return value * 60 * 60 * 1000; // hours
      case 'd': return value * 24 * 60 * 60 * 1000; // days
      case 'w': return value * 7 * 24 * 60 * 60 * 1000; // weeks
      default: throw new Error(`Unknown time unit: ${unit}`);
    }
  }

  shutdown(): void {
    // Clean up timers
    for (const [name, timer] of this.cycleTimers) {
      clearInterval(timer);
      this.logger.debug(`Cleared timer: ${name}`);
    }
    this.cycleTimers.clear();
  }
}