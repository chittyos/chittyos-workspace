/**
 * ChittyScore Scoring Algorithms
 * Implements multi-factor scoring based on specification
 */

import type {
  ScoreRequest,
  ScoreBreakdown,
  ScoreDetails,
  ScoreFactors,
  TimeRange,
} from "./types";

/**
 * Calculate verification score (0-30 points)
 * Based on document verification, identity confirmation, and cross-references
 */
export function calculateVerificationScore(verification_report: any): {
  score: number;
  factors: any;
} {
  const factors = {
    documents_verified: verification_report?.documents_verified || false,
    identity_confirmed: verification_report?.identity_confirmed || false,
    cross_references_pass: verification_report?.cross_references_valid || false,
  };

  let score = 0;
  if (factors.documents_verified) score += 10;
  if (factors.identity_confirmed) score += 10;
  if (factors.cross_references_pass) score += 10;

  return { score, factors };
}

/**
 * Calculate network score (0-30 points)
 * Based on trust network data from ChittyTrust
 */
export function calculateNetworkScore(trust_network: any): {
  score: number;
  factors: any;
} {
  const factors = {
    degree: trust_network?.network_metrics?.degree || 0,
    trust_score: trust_network?.network_trust_contribution || 0,
    cluster_size: trust_network?.trust_clusters?.[0]?.entities || 0,
  };

  // Use trust contribution directly if provided (already 0-30)
  let score = Math.min(30, Math.max(0, factors.trust_score));

  // If no trust contribution provided, calculate from metrics
  if (score === 0 && factors.degree > 0) {
    const degreeScore = Math.min(10, factors.degree / 2);
    const clusterScore = Math.min(10, factors.cluster_size / 5);
    score = degreeScore + clusterScore;
  }

  return { score, factors };
}

/**
 * Calculate history score (0-20 points)
 * Based on entity age, transaction count, and compliance record
 */
export function calculateHistoryScore(
  entity_data: any,
  time_range: TimeRange,
): { score: number; factors: any } {
  const entity_age_days = entity_data?.entity_age_days || 0;
  const transaction_count = entity_data?.transaction_count || 0;
  const compliance_clean = entity_data?.compliance_record_clean !== false;

  const factors = {
    entity_age_days,
    transaction_count,
    compliance_clean,
  };

  // Age score (0-5 points): 1 year = 5 points
  const ageScore = Math.min(5, (entity_age_days / 365) * 5);

  // Transaction score (0-10 points): 10+ transactions = 10 points
  const transactionScore = Math.min(10, (transaction_count / 10) * 10);

  // Compliance score (0-5 points): clean record = 5 points
  const complianceScore = compliance_clean ? 5 : 0;

  const score = ageScore + transactionScore + complianceScore;

  return { score, factors };
}

/**
 * Calculate external score (0-15 points)
 * Based on external signals like D&B score, domain reputation, government validation
 */
export function calculateExternalScore(external_signals: any): {
  score: number;
  factors: any;
} {
  const factors = {
    duns_score: external_signals?.duns_score || 0,
    domain_reputation: external_signals?.domain_reputation || 0,
    government_validated: external_signals?.government_validated || false,
  };

  // DUNS score (0-5 points): normalized from 0-100
  const dunsScore = Math.min(5, (factors.duns_score / 100) * 5);

  // Domain reputation (0-5 points): normalized from 0-100
  const domainScore = Math.min(5, (factors.domain_reputation / 100) * 5);

  // Government validation (0-5 points): binary
  const govScore = factors.government_validated ? 5 : 0;

  const score = dunsScore + domainScore + govScore;

  return { score, factors };
}

/**
 * Calculate risk score (negative points)
 * Based on duplicate attempts, blacklist matches, fraud signals
 */
export function calculateRiskScore(
  entity_data: any,
  verification_report: any,
): number {
  let risk = 0;

  // Duplicate attempts (-1 each)
  const duplicateAttempts = entity_data?.duplicate_attempts || 0;
  risk += duplicateAttempts * -1;

  // Blacklist match (-3 points)
  if (verification_report?.blacklist_match) {
    risk -= 3;
  }

  // Fraud signals (-1 each)
  const fraudSignals = verification_report?.fraud_signals || 0;
  risk += fraudSignals * -1;

  return risk;
}

/**
 * Calculate specific score types
 */
export function calculateScoreType(
  type: string,
  breakdown: ScoreBreakdown,
  factors: ScoreFactors,
): number {
  switch (type) {
    case "creditworthiness":
      // Heavy weight on verification and external signals
      return Math.round(
        (breakdown.verification / 30) * 40 +
          (breakdown.external / 15) * 30 +
          (breakdown.history / 20) * 20 +
          (breakdown.network / 30) * 10 +
          (breakdown.risk / -10) * 0, // Risk doesn't count toward creditworthiness
      );

    case "reliability":
      // Heavy weight on history and network
      return Math.round(
        (breakdown.history / 20) * 40 +
          (breakdown.network / 30) * 35 +
          (breakdown.verification / 30) * 20 +
          (breakdown.external / 15) * 5,
      );

    case "compliance":
      // Heavy weight on verification and risk
      return Math.round(
        (breakdown.verification / 30) * 50 +
          Math.max(0, (breakdown.risk + 10) / 10) * 30 + // Convert risk to positive scale
          (breakdown.external / 15) * 20,
      );

    case "activity":
      // Heavy weight on history (transactions) and network
      return Math.round(
        (breakdown.history / 20) * 60 +
          (breakdown.network / 30) * 30 +
          (breakdown.verification / 30) * 10,
      );

    case "composite":
      // Balanced weight across all factors
      const total =
        breakdown.verification +
        breakdown.network +
        breakdown.history +
        breakdown.external;
      const max = 30 + 30 + 20 + 15; // 95
      return Math.round((total / max) * 100);

    default:
      return 0;
  }
}

/**
 * Main scoring function
 * Calculates all scores based on provided data
 */
export function calculateScores(request: ScoreRequest): {
  overall_score: number;
  breakdown: ScoreBreakdown;
  score_details: ScoreDetails;
  factors: ScoreFactors;
} {
  // Calculate breakdown
  const verificationResult = calculateVerificationScore(
    request.verification_report,
  );
  const networkResult = calculateNetworkScore(request.trust_network);
  const historyResult = calculateHistoryScore(
    request.entity_data,
    request.time_range,
  );
  const externalResult = calculateExternalScore(request.external_signals);
  const riskScore = calculateRiskScore(
    request.entity_data,
    request.verification_report,
  );

  const breakdown: ScoreBreakdown = {
    verification: verificationResult.score,
    network: networkResult.score,
    history: historyResult.score,
    external: externalResult.score,
    risk: riskScore,
  };

  const factors: ScoreFactors = {
    verification: verificationResult.factors,
    network: networkResult.factors,
    history: historyResult.factors,
    external: externalResult.factors,
  };

  // Calculate overall score (0-100)
  const rawTotal =
    breakdown.verification +
    breakdown.network +
    breakdown.history +
    breakdown.external +
    breakdown.risk;
  const maxTotal = 30 + 30 + 20 + 15; // 95 (risk can be negative)
  const overall_score = Math.round(
    Math.max(0, Math.min(100, (rawTotal / maxTotal) * 100)),
  );

  // Calculate requested score types
  const score_details: ScoreDetails = {};
  for (const scoreType of request.score_types) {
    score_details[scoreType] = calculateScoreType(
      scoreType,
      breakdown,
      factors,
    );
  }

  return {
    overall_score,
    breakdown,
    score_details,
    factors,
  };
}
