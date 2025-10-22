// Main exports for the secrets manager library
export { SecretsManager } from './core/SecretsManager';
export { ConfigManager } from './config/ConfigManager';
export { PluginManager } from './core/PluginManager';
export { CycleManager } from './core/CycleManager';
export { OnePasswordProvider } from './providers/OnePasswordProvider';
export { Logger } from './utils/Logger';

// Plugin exports
export { EnvInjector } from './injectors/EnvInjector';
export { DockerInjector } from './injectors/DockerInjector';
export { KubernetesInjector } from './injectors/KubernetesInjector';
export { Base64Transformer } from './transformers/Base64Transformer';
export { JsonTransformer } from './transformers/JsonTransformer';
export { TemplateTransformer } from './transformers/TemplateTransformer';

// Type exports
export * from './types';

// Default export for convenience
export { SecretsManager as default } from './core/SecretsManager';