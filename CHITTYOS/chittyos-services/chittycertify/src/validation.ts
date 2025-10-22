// Certificate validation logic

import { IssueCertificateRequest, CertificateType } from "./types";

/**
 * Validate certificate issuance request
 */
export function validateIssuanceRequest(request: IssueCertificateRequest): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate ChittyID format
  if (!request.chittyid || !isValidChittyId(request.chittyid)) {
    errors.push("Invalid ChittyID format. Expected CHITTY-{ENTITY}-{HASH}");
  }

  // Validate trust score
  if (
    typeof request.trust_score !== "number" ||
    request.trust_score < 0 ||
    request.trust_score > 100
  ) {
    errors.push("Trust score must be a number between 0 and 100");
  }

  // Validate entity data
  if (!request.entity_data || !request.entity_data.legal_name) {
    errors.push("Entity data must include legal_name");
  }

  // Validate verification report
  if (!request.verification_report || !request.verification_report.status) {
    errors.push("Verification report must include status");
  }

  // Validate certificate type if provided
  if (
    request.certificate_type &&
    !isValidCertificateType(request.certificate_type)
  ) {
    errors.push("Certificate type must be BASIC, ENHANCED, or PREMIUM");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate ChittyID format
 * Official format: 01-C-{DOMAIN}-{HASH}-{CHECK}-{YYMM}-{ENV}-{RAND}
 */
export function isValidChittyId(chittyid: string): boolean {
  // Official ChittyID format from id.chitty.cc
  const officialPattern =
    /^01-[A-Z]-[A-Z]{3,7}-[0-9A-Z]{4}-[0-9]-[0-9]{4}-[A-Z]-[0-9A-Z]{2}$/;
  // Legacy format for backward compatibility
  const legacyPattern = /^CHITTY-[A-Z]+-[A-Z0-9]+$/;

  return officialPattern.test(chittyid) || legacyPattern.test(chittyid);
}

/**
 * Validate certificate type
 */
export function isValidCertificateType(type: string): type is CertificateType {
  return ["BASIC", "ENHANCED", "PREMIUM"].includes(type);
}

/**
 * Calculate validity period in milliseconds
 */
export function parseValidityPeriod(period?: string): number {
  if (!period) {
    // Default to 1 year
    return 365 * 24 * 60 * 60 * 1000;
  }

  const normalized = period.toLowerCase().trim();

  if (normalized.includes("year")) {
    const years = parseInt(normalized);
    return years * 365 * 24 * 60 * 60 * 1000;
  }

  if (normalized.includes("month")) {
    const months = parseInt(normalized);
    return months * 30 * 24 * 60 * 60 * 1000;
  }

  if (normalized.includes("day")) {
    const days = parseInt(normalized);
    return days * 24 * 60 * 60 * 1000;
  }

  // Default to 1 year if parsing fails
  return 365 * 24 * 60 * 60 * 1000;
}

/**
 * Determine certificate type based on trust score if not provided
 */
export function determineCertificateType(
  trustScore: number,
  requestedType?: CertificateType,
): CertificateType {
  if (requestedType) {
    return requestedType;
  }

  // Auto-determine based on trust score
  if (trustScore >= 80) {
    return "PREMIUM";
  } else if (trustScore >= 50) {
    return "ENHANCED";
  } else {
    return "BASIC";
  }
}
