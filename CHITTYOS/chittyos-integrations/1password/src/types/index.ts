export interface SecretsConfig {
  provider: '1password' | 'custom';
  environments: EnvironmentConfig[];
  cycling: CyclingConfig;
  plugins: PluginConfig[];
  vault?: string;
  connectServer?: string;
  accessToken?: string;
}

export interface EnvironmentConfig {
  name: string;
  description?: string;
  secrets: SecretMapping[];
  plugins?: string[];
  inheritFrom?: string;
}

export interface SecretMapping {
  key: string;
  source: string;
  transform?: TransformRule[];
  required?: boolean;
  cycleInterval?: string;
}

export interface CyclingConfig {
  enabled: boolean;
  defaultInterval: string; // e.g., "30d", "1w", "6h"
  rules: CyclingRule[];
  notifications?: NotificationConfig;
}

export interface CyclingRule {
  pattern: string;
  interval: string;
  strategy: 'rotate' | 'regenerate' | 'custom';
  customHandler?: string;
}

export interface PluginConfig {
  name: string;
  type: 'injector' | 'transformer' | 'validator' | 'cycler';
  path: string;
  config?: Record<string, any>;
}

export interface TransformRule {
  type: 'base64' | 'encrypt' | 'format' | 'custom';
  params?: Record<string, any>;
}

export interface NotificationConfig {
  webhook?: string;
  email?: string[];
  slack?: string;
}

export interface SecretItem {
  id: string;
  key: string;
  value: string;
  metadata: {
    lastCycled?: Date;
    nextCycle?: Date;
    source: string;
    environment: string;
  };
}

export interface Plugin {
  name: string;
  type: PluginConfig['type'];
  execute(context: PluginContext): Promise<any>;
}

export interface PluginContext {
  secret?: SecretItem;
  environment: string;
  config: Record<string, any>;
  logger: Logger;
}

export interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}