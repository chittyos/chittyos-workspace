/**
 * ChittyScore Type Definitions
 * Based on specification in AI_AGENT_SERVICE_SPECS.md
 */

export type ScoreType =
  | "creditworthiness"
  | "reliability"
  | "compliance"
  | "activity"
  | "composite";
export type TimeRange = "30d" | "90d" | "1y" | "all";

export interface ScoreRequest {
  score_types: ScoreType[];
  verification_report: any;
  trust_network?: any;
  entity_data: any;
  time_range: TimeRange;
  external_signals?: {
    duns_score?: number;
    domain_reputation?: number;
    business_age_years?: number;
  };
}

export interface ScoreBreakdown {
  verification: number; // 0-30
  network: number; // 0-30
  history: number; // 0-20
  external: number; // 0-15
  risk: number; // negative points
}

export interface ScoreDetails {
  creditworthiness?: number; // 0-100
  reliability?: number; // 0-100
  compliance?: number; // 0-100
  activity?: number; // 0-100
  composite?: number; // 0-100
}

export interface ScoreFactors {
  verification: {
    documents_verified: boolean;
    identity_confirmed: boolean;
    cross_references_pass: boolean;
  };
  network: {
    degree: number;
    trust_score: number;
    cluster_size: number;
  };
  history: {
    entity_age_days: number;
    transaction_count: number;
    compliance_clean: boolean;
  };
  external: {
    duns_score: number;
    domain_reputation: number;
    government_validated: boolean;
  };
}

export interface ScoreResponse {
  overall_score: number;
  breakdown: ScoreBreakdown;
  score_details: ScoreDetails;
  factors: ScoreFactors;
  timestamp: string;
  time_range: TimeRange;
}

export interface Env {
  ENVIRONMENT: string;
  SERVICE_NAME: string;
  VERSION: string;
}
