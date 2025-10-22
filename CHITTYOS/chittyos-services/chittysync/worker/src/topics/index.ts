/**
 * Topic Sync Module Exports
 * Tier 3: Topic Organization within and across projects
 *
 * Version: 1.0.0
 * Part of: Three-Tier Sync Architecture
 */

export { topicDetector, TopicDetector, TOPIC_KEYWORDS, TOPIC_REGISTRY } from './topic-detector';
export type { TopicMetadata, TopicDetectionResult } from './topic-detector';

export { TopicRegistry } from './topic-registry';
export type { TopicStats, ProjectTopicInfo, TopicView, TopicDashboard } from './topic-registry';

export { CrossProjectTracker } from './cross-project-tracker';
export type {
  CrossProjectTopicView,
  TopicComparison,
  SessionTopicSummary,
} from './cross-project-tracker';

export { handleTopicRequest } from './topic-routes';
