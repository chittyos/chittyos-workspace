/**
 * ChittyJanitor Types
 */

export interface JanitorState {
  version: string;
  birth: string;
  intelligence_level: number;
  total_runs: number;
  total_saved_bytes: number;
  last_run: string | null;
  patterns: {
    temporal: Record<string, any>;
    targets: Record<string, any>;
  };
}

export interface CleanupResult {
  level: 'conservative' | 'aggressive' | 'smart';
  saved_bytes: number;
  duration_ms: number;
  targets_cleaned: string[];
  timestamp: string;
}

export interface CleanupPrediction {
  next_cleanup_recommended: string;
  expected_savings_mb: number;
  priority: number;
  recommended_level: 'conservative' | 'aggressive' | 'smart';
  confidence: number;
  reasoning: string;
}

export interface DashboardData {
  overview: any;
  predictions: any;
  insights: Insight[];
  recommendations: string[];
  timeline: any[];
}

export interface Insight {
  type: 'pattern' | 'savings' | 'efficiency' | 'recommendation';
  title: string;
  description: string;
  priority: number;
  actionable: boolean;
}
