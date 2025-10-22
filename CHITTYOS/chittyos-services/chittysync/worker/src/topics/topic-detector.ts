/**
 * Topic Detection Engine
 * Auto-detects topics from todo content using keyword matching and ML classification
 *
 * Version: 1.0.0
 * Part of: Three-Tier Sync Architecture (Tier 3)
 */

import type { Todo } from "../types";

/**
 * Topic keyword registry
 * Maps topic IDs to their associated keywords
 */
export const TOPIC_KEYWORDS: Record<string, string[]> = {
  // Authentication & Security
  auth: ['auth', 'authentication', 'oauth', 'jwt', 'token', 'login', 'session', 'credential'],
  security: ['security', 'encryption', 'hash', 'signature', 'verify', 'secure', 'ssl', 'tls'],
  oauth: ['oauth', 'oauth2', 'authorize', 'grant', 'refresh token', 'access token'],

  // Identity
  id: ['chittyid', 'identity', 'mint', 'identifier', 'uuid', 'id generation'],

  // AI & Models
  ai: ['ai', 'llm', 'claude', 'gpt', 'openai', 'model', 'prompt', 'inference', 'embedding'],
  ml: ['ml', 'machine learning', 'classification', 'training', 'model', 'prediction'],

  // Media
  music: ['music', 'audio', 'playlist', 'track', 'spotify', 'soundcloud', 'streaming music'],
  video: ['video', 'stream', 'playback', 'encoding', 'transcode', 'youtube', 'vimeo'],
  image: ['image', 'photo', 'picture', 'thumbnail', 'resize', 'upload'],

  // Infrastructure
  routing: ['route', 'router', 'gateway', 'endpoint', 'path', 'middleware'],
  database: ['database', 'db', 'sql', 'query', 'schema', 'migration', 'd1', 'postgres'],
  cache: ['cache', 'caching', 'redis', 'kv', 'memcache', 'ttl'],
  storage: ['storage', 'file', 'blob', 'r2', 's3', 'bucket', 'upload'],

  // API & Integration
  api: ['api', 'rest', 'graphql', 'endpoint', 'request', 'response', 'webhook'],
  integration: ['integration', 'connector', 'sync', 'bridge', 'adapter', 'third-party'],
  webhook: ['webhook', 'callback', 'event', 'notification', 'trigger'],

  // Development
  testing: ['test', 'spec', 'mock', 'fixture', 'assert', 'unit test', 'e2e'],
  deployment: ['deploy', 'production', 'staging', 'release', 'build', 'ci/cd', 'pipeline'],
  debugging: ['debug', 'debugger', 'breakpoint', 'trace', 'log', 'error', 'troubleshoot'],

  // Frontend
  ui: ['ui', 'frontend', 'component', 'interface', 'design', 'ux', 'layout'],
  react: ['react', 'jsx', 'component', 'hook', 'state', 'props'],

  // Backend
  backend: ['backend', 'server', 'worker', 'cloudflare', 'edge'],
  worker: ['worker', 'cloudflare worker', 'edge worker', 'service worker'],

  // Performance
  performance: ['performance', 'optimize', 'latency', 'speed', 'fast', 'slow', 'bottleneck'],
  monitoring: ['monitoring', 'metrics', 'analytics', 'observability', 'telemetry', 'sentry'],

  // Data
  sync: ['sync', 'synchronize', 'replication', 'conflict', 'merge', 'convergence'],
  schema: ['schema', 'type', 'validation', 'structure', 'format'],
  migration: ['migration', 'upgrade', 'version', 'changelog', 'breaking change'],

  // Legal & Compliance
  legal: ['legal', 'compliance', 'gdpr', 'privacy', 'terms', 'policy'],
  evidence: ['evidence', 'audit', 'trail', 'log', 'proof', 'verification'],

  // ChittyOS Specific
  chittyos: ['chittyos', 'chitty', 'platform', 'ecosystem', 'framework'],
  registry: ['registry', 'service registry', 'discovery', 'health check'],
  gateway: ['gateway', 'router', 'proxy', 'load balancer'],

  // Development Process
  refactor: ['refactor', 'cleanup', 'improve', 'optimize code', 'restructure'],
  bugfix: ['bug', 'fix', 'issue', 'error', 'broken', 'crash'],
  feature: ['feature', 'new', 'add', 'implement', 'create'],
  docs: ['docs', 'documentation', 'readme', 'guide', 'tutorial', 'comment'],
};

/**
 * Topic metadata
 */
export interface TopicMetadata {
  topic_id: string;
  name: string;
  description: string;
  keywords: string[];
  parent_topic?: string;
}

/**
 * Topic registry with descriptions
 */
export const TOPIC_REGISTRY: Record<string, TopicMetadata> = {
  auth: {
    topic_id: 'auth',
    name: 'Authentication',
    description: 'Authentication flows, OAuth, JWT, session management',
    keywords: TOPIC_KEYWORDS.auth,
  },
  security: {
    topic_id: 'security',
    name: 'Security',
    description: 'Security measures, encryption, signing, verification',
    keywords: TOPIC_KEYWORDS.security,
  },
  oauth: {
    topic_id: 'oauth',
    name: 'OAuth',
    description: 'OAuth 2.0 flows and token management',
    keywords: TOPIC_KEYWORDS.oauth,
    parent_topic: 'auth',
  },
  id: {
    topic_id: 'id',
    name: 'Identity',
    description: 'ChittyID minting, identity management, identifier generation',
    keywords: TOPIC_KEYWORDS.id,
  },
  ai: {
    topic_id: 'ai',
    name: 'Artificial Intelligence',
    description: 'AI models, LLM integration, Claude, GPT, embeddings',
    keywords: TOPIC_KEYWORDS.ai,
  },
  ml: {
    topic_id: 'ml',
    name: 'Machine Learning',
    description: 'ML classification, training, prediction',
    keywords: TOPIC_KEYWORDS.ml,
    parent_topic: 'ai',
  },
  music: {
    topic_id: 'music',
    name: 'Music',
    description: 'Music streaming, playlists, audio processing',
    keywords: TOPIC_KEYWORDS.music,
  },
  video: {
    topic_id: 'video',
    name: 'Video',
    description: 'Video streaming, encoding, playback',
    keywords: TOPIC_KEYWORDS.video,
  },
  image: {
    topic_id: 'image',
    name: 'Images',
    description: 'Image processing, uploads, thumbnails',
    keywords: TOPIC_KEYWORDS.image,
  },
  routing: {
    topic_id: 'routing',
    name: 'Routing',
    description: 'Request routing, gateway logic, middleware',
    keywords: TOPIC_KEYWORDS.routing,
  },
  database: {
    topic_id: 'database',
    name: 'Database',
    description: 'Database operations, queries, schema management',
    keywords: TOPIC_KEYWORDS.database,
  },
  cache: {
    topic_id: 'cache',
    name: 'Caching',
    description: 'Cache strategies, KV storage, TTL management',
    keywords: TOPIC_KEYWORDS.cache,
    parent_topic: 'performance',
  },
  storage: {
    topic_id: 'storage',
    name: 'Storage',
    description: 'File storage, blob storage, R2, S3',
    keywords: TOPIC_KEYWORDS.storage,
  },
  api: {
    topic_id: 'api',
    name: 'API',
    description: 'REST APIs, GraphQL, endpoints, webhooks',
    keywords: TOPIC_KEYWORDS.api,
  },
  integration: {
    topic_id: 'integration',
    name: 'Integration',
    description: 'Third-party integrations, connectors, adapters',
    keywords: TOPIC_KEYWORDS.integration,
  },
  webhook: {
    topic_id: 'webhook',
    name: 'Webhooks',
    description: 'Webhook callbacks, event notifications',
    keywords: TOPIC_KEYWORDS.webhook,
    parent_topic: 'api',
  },
  testing: {
    topic_id: 'testing',
    name: 'Testing',
    description: 'Unit tests, integration tests, E2E, fixtures',
    keywords: TOPIC_KEYWORDS.testing,
  },
  deployment: {
    topic_id: 'deployment',
    name: 'Deployment',
    description: 'CI/CD, production deployments, releases',
    keywords: TOPIC_KEYWORDS.deployment,
  },
  debugging: {
    topic_id: 'debugging',
    name: 'Debugging',
    description: 'Debug tools, error tracking, troubleshooting',
    keywords: TOPIC_KEYWORDS.debugging,
  },
  ui: {
    topic_id: 'ui',
    name: 'User Interface',
    description: 'Frontend UI, components, design, UX',
    keywords: TOPIC_KEYWORDS.ui,
  },
  react: {
    topic_id: 'react',
    name: 'React',
    description: 'React components, hooks, state management',
    keywords: TOPIC_KEYWORDS.react,
    parent_topic: 'ui',
  },
  backend: {
    topic_id: 'backend',
    name: 'Backend',
    description: 'Server-side logic, workers, edge computing',
    keywords: TOPIC_KEYWORDS.backend,
  },
  worker: {
    topic_id: 'worker',
    name: 'Workers',
    description: 'Cloudflare Workers, edge workers, service workers',
    keywords: TOPIC_KEYWORDS.worker,
    parent_topic: 'backend',
  },
  performance: {
    topic_id: 'performance',
    name: 'Performance',
    description: 'Performance optimization, latency, speed',
    keywords: TOPIC_KEYWORDS.performance,
  },
  monitoring: {
    topic_id: 'monitoring',
    name: 'Monitoring',
    description: 'Metrics, analytics, observability, telemetry',
    keywords: TOPIC_KEYWORDS.monitoring,
  },
  sync: {
    topic_id: 'sync',
    name: 'Synchronization',
    description: 'Data sync, conflict resolution, replication',
    keywords: TOPIC_KEYWORDS.sync,
  },
  schema: {
    topic_id: 'schema',
    name: 'Schema',
    description: 'Data schemas, validation, type definitions',
    keywords: TOPIC_KEYWORDS.schema,
  },
  migration: {
    topic_id: 'migration',
    name: 'Migration',
    description: 'Database migrations, version upgrades',
    keywords: TOPIC_KEYWORDS.migration,
    parent_topic: 'database',
  },
  legal: {
    topic_id: 'legal',
    name: 'Legal',
    description: 'Legal compliance, GDPR, privacy, terms',
    keywords: TOPIC_KEYWORDS.legal,
  },
  evidence: {
    topic_id: 'evidence',
    name: 'Evidence',
    description: 'Audit trails, evidence collection, verification',
    keywords: TOPIC_KEYWORDS.evidence,
    parent_topic: 'legal',
  },
  chittyos: {
    topic_id: 'chittyos',
    name: 'ChittyOS',
    description: 'ChittyOS platform, ecosystem, framework',
    keywords: TOPIC_KEYWORDS.chittyos,
  },
  registry: {
    topic_id: 'registry',
    name: 'Registry',
    description: 'Service registry, discovery, health checks',
    keywords: TOPIC_KEYWORDS.registry,
    parent_topic: 'chittyos',
  },
  gateway: {
    topic_id: 'gateway',
    name: 'Gateway',
    description: 'API gateway, routing, load balancing',
    keywords: TOPIC_KEYWORDS.gateway,
    parent_topic: 'chittyos',
  },
  refactor: {
    topic_id: 'refactor',
    name: 'Refactoring',
    description: 'Code refactoring, cleanup, improvements',
    keywords: TOPIC_KEYWORDS.refactor,
  },
  bugfix: {
    topic_id: 'bugfix',
    name: 'Bug Fix',
    description: 'Bug fixes, issue resolution, error handling',
    keywords: TOPIC_KEYWORDS.bugfix,
  },
  feature: {
    topic_id: 'feature',
    name: 'Feature',
    description: 'New features, enhancements, implementations',
    keywords: TOPIC_KEYWORDS.feature,
  },
  docs: {
    topic_id: 'docs',
    name: 'Documentation',
    description: 'Documentation, READMEs, guides, tutorials',
    keywords: TOPIC_KEYWORDS.docs,
  },
};

/**
 * Topic detection result
 */
export interface TopicDetectionResult {
  topics: string[];
  primary_topic: string;
  confidence_scores: Record<string, number>;
}

/**
 * Topic Detector class
 */
export class TopicDetector {
  /**
   * Detect topics from todo content
   * Returns array of topic IDs sorted by confidence
   */
  async detectTopics(todo: Todo, projectId?: string): Promise<TopicDetectionResult> {
    const content = todo.content.toLowerCase();
    const activeForm = todo.active_form?.toLowerCase() || '';
    const combinedText = `${content} ${activeForm}`;

    const confidenceScores: Record<string, number> = {};

    // 1. Keyword matching
    for (const [topicId, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      let score = 0;

      for (const keyword of keywords) {
        const keywordLower = keyword.toLowerCase();

        // Exact phrase match (higher weight)
        if (combinedText.includes(keywordLower)) {
          score += 2;
        }

        // Word boundary match
        const wordBoundaryRegex = new RegExp(`\\b${keywordLower}\\b`, 'gi');
        const matches = combinedText.match(wordBoundaryRegex);
        if (matches) {
          score += matches.length * 1.5;
        }
      }

      if (score > 0) {
        confidenceScores[topicId] = score;
      }
    }

    // 2. File path analysis (if available)
    if (todo.metadata?.file_path) {
      const pathTopics = this.extractTopicsFromPath(todo.metadata.file_path);
      for (const topicId of pathTopics) {
        confidenceScores[topicId] = (confidenceScores[topicId] || 0) + 3;
      }
    }

    // 3. ML-based classification (simple heuristics for now)
    const mlTopics = this.classifyWithHeuristics(combinedText);
    for (const topicId of mlTopics) {
      confidenceScores[topicId] = (confidenceScores[topicId] || 0) + 1;
    }

    // 4. Status-based hints
    if (todo.status === 'completed' && combinedText.includes('fix')) {
      confidenceScores['bugfix'] = (confidenceScores['bugfix'] || 0) + 1;
    }

    // 5. Sort topics by confidence
    const sortedTopics = Object.entries(confidenceScores)
      .sort(([, a], [, b]) => b - a)
      .map(([topicId]) => topicId);

    // Return top topics (limit to reasonable number)
    const topics = sortedTopics.slice(0, 8);
    const primary_topic = topics[0] || 'feature';

    return {
      topics,
      primary_topic,
      confidence_scores: confidenceScores,
    };
  }

  /**
   * Extract topics from file path
   */
  private extractTopicsFromPath(filePath: string): string[] {
    const pathLower = filePath.toLowerCase();
    const topics: string[] = [];

    // Check for topic keywords in path
    for (const [topicId, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      for (const keyword of keywords) {
        if (pathLower.includes(keyword.toLowerCase())) {
          topics.push(topicId);
          break;
        }
      }
    }

    // Common path patterns
    if (pathLower.includes('/test/') || pathLower.endsWith('.test.ts')) {
      topics.push('testing');
    }
    if (pathLower.includes('/migrations/')) {
      topics.push('migration');
    }
    if (pathLower.includes('/docs/') || pathLower.endsWith('.md')) {
      topics.push('docs');
    }
    if (pathLower.includes('/api/')) {
      topics.push('api');
    }

    return [...new Set(topics)];
  }

  /**
   * ML-based classification using heuristics
   * TODO: Replace with actual ML model in future
   */
  private classifyWithHeuristics(text: string): string[] {
    const topics: string[] = [];

    // Action verbs
    if (/\b(add|implement|create|build)\b/i.test(text)) {
      topics.push('feature');
    }
    if (/\b(fix|resolve|repair|correct)\b/i.test(text)) {
      topics.push('bugfix');
    }
    if (/\b(refactor|cleanup|improve|optimize)\b/i.test(text)) {
      topics.push('refactor');
    }
    if (/\b(test|spec|coverage)\b/i.test(text)) {
      topics.push('testing');
    }
    if (/\b(deploy|release|ship)\b/i.test(text)) {
      topics.push('deployment');
    }
    if (/\b(document|readme|guide)\b/i.test(text)) {
      topics.push('docs');
    }

    // Technology indicators
    if (/\b(react|jsx|component|hook)\b/i.test(text)) {
      topics.push('react');
    }
    if (/\b(worker|edge|cloudflare)\b/i.test(text)) {
      topics.push('worker');
    }
    if (/\b(database|sql|d1|postgres)\b/i.test(text)) {
      topics.push('database');
    }
    if (/\b(api|endpoint|rest|graphql)\b/i.test(text)) {
      topics.push('api');
    }

    return topics;
  }

  /**
   * Get topic metadata by ID
   */
  getTopicMetadata(topicId: string): TopicMetadata | undefined {
    return TOPIC_REGISTRY[topicId];
  }

  /**
   * Get all registered topics
   */
  getAllTopics(): TopicMetadata[] {
    return Object.values(TOPIC_REGISTRY);
  }

  /**
   * Search topics by keyword
   */
  searchTopics(query: string): TopicMetadata[] {
    const queryLower = query.toLowerCase();
    return Object.values(TOPIC_REGISTRY).filter(topic => {
      return (
        topic.name.toLowerCase().includes(queryLower) ||
        topic.description.toLowerCase().includes(queryLower) ||
        topic.keywords.some(kw => kw.toLowerCase().includes(queryLower))
      );
    });
  }
}

/**
 * Singleton instance
 */
export const topicDetector = new TopicDetector();
