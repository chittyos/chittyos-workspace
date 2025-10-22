/**
 * ChittyVerify Validation Logic
 * Entity verification and validation functions
 */

import type {
  EntityType,
  EntityData,
  VerificationLevel,
  Document,
  VerificationDetails,
} from "./types";

/**
 * US State jurisdictions mapping
 */
const US_STATES = new Set([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
]);

/**
 * Validate legal entity name format
 */
export function validateLegalName(
  name: string,
  entityType: EntityType,
): boolean {
  if (!name || name.length < 3) return false;

  const trimmed = name.trim();

  // LLC must contain "LLC" or "L.L.C."
  if (entityType === "LLC") {
    return /LLC|L\.L\.C\./i.test(trimmed);
  }

  // Corporation must contain Corp, Inc, Co., etc.
  if (entityType === "CORPORATION") {
    return /Corp|Inc|Co\.|Corporation|Incorporated/i.test(trimmed);
  }

  return trimmed.length >= 3;
}

/**
 * Validate US jurisdiction (state code)
 */
export function validateJurisdiction(jurisdiction?: string): boolean {
  if (!jurisdiction) return false;
  return US_STATES.has(jurisdiction.toUpperCase());
}

/**
 * Validate US Tax ID (EIN format: XX-XXXXXXX)
 */
export function validateTaxId(taxId?: string): boolean {
  if (!taxId) return false;

  // EIN format: 12-3456789
  const einPattern = /^\d{2}-\d{7}$/;

  // Also accept SSN format for persons: XXX-XX-XXXX
  const ssnPattern = /^\d{3}-\d{2}-\d{4}$/;

  return einPattern.test(taxId) || ssnPattern.test(taxId);
}

/**
 * Validate US address format
 */
export function validateAddress(address?: any): boolean {
  if (!address) return false;

  // Basic validation: must have street and state
  const hasStreet = address.street && address.street.length > 0;
  const hasState = address.state && US_STATES.has(address.state.toUpperCase());

  return hasStreet && hasState;
}

/**
 * Validate document hash format (SHA-256)
 */
export function validateDocumentHash(hash: string): boolean {
  // SHA-256 is 64 hex characters
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Perform BASIC verification
 * - Legal name format check
 * - Jurisdiction validation
 */
export function performBasicVerification(
  entityType: EntityType,
  entityData: EntityData,
): VerificationDetails {
  const nameValid = validateLegalName(entityData.legal_name, entityType);
  const jurisdictionValid = entityData.jurisdiction
    ? validateJurisdiction(entityData.jurisdiction)
    : false;

  return {
    identity_verified: nameValid,
    documents_authentic: false,
    cross_references_valid: jurisdictionValid,
    jurisdiction_valid: jurisdictionValid,
  };
}

/**
 * Perform STANDARD verification
 * - All BASIC checks
 * - Tax ID validation
 * - Address validation
 */
export function performStandardVerification(
  entityType: EntityType,
  entityData: EntityData,
): VerificationDetails {
  const basic = performBasicVerification(entityType, entityData);

  const taxIdValid = entityData.tax_id
    ? validateTaxId(entityData.tax_id)
    : false;

  const addressValid = entityData.address
    ? validateAddress(entityData.address)
    : false;

  return {
    ...basic,
    identity_verified: basic.identity_verified && taxIdValid,
    tax_id_valid: taxIdValid,
    address_valid: addressValid,
    cross_references_valid: basic.cross_references_valid && addressValid,
  };
}

/**
 * Perform ENHANCED verification
 * - All STANDARD checks
 * - Document verification
 * - Cross-reference validation
 */
export function performEnhancedVerification(
  entityType: EntityType,
  entityData: EntityData,
  documents?: Document[],
): VerificationDetails {
  const standard = performStandardVerification(entityType, entityData);

  // Document verification
  let documentsAuthentic = false;
  if (documents && documents.length > 0) {
    documentsAuthentic = documents.every((doc) => {
      return doc.hash && validateDocumentHash(doc.hash);
    });
  }

  // Enhanced cross-references
  const hasRegistrationNumber = !!entityData.registration_number;
  const hasFormationDate = !!entityData.formation_date;
  const hasRegisteredAgent = !!entityData.registered_agent;

  const crossReferencesValid =
    standard.cross_references_valid &&
    (hasRegistrationNumber || hasFormationDate || hasRegisteredAgent);

  return {
    ...standard,
    documents_authentic: documentsAuthentic,
    cross_references_valid: crossReferencesValid,
  };
}

/**
 * Calculate confidence score based on verification details
 */
export function calculateConfidenceScore(
  details: VerificationDetails,
  level: VerificationLevel,
): number {
  let score = 0;
  let maxScore = 0;

  // Identity verified (30 points)
  maxScore += 30;
  if (details.identity_verified) score += 30;

  // Documents authentic (25 points)
  maxScore += 25;
  if (details.documents_authentic) score += 25;

  // Cross references (20 points)
  maxScore += 20;
  if (details.cross_references_valid) score += 20;

  // Tax ID valid (15 points)
  if (level !== "BASIC") {
    maxScore += 15;
    if (details.tax_id_valid) score += 15;
  }

  // Address valid (10 points)
  if (level !== "BASIC") {
    maxScore += 10;
    if (details.address_valid) score += 10;
  }

  return maxScore > 0 ? score / maxScore : 0;
}

/**
 * Get verified fields list
 */
export function getVerifiedFields(details: VerificationDetails): string[] {
  const fields: string[] = [];

  if (details.identity_verified) fields.push("legal_name");
  if (details.jurisdiction_valid) fields.push("jurisdiction");
  if (details.tax_id_valid) fields.push("tax_id");
  if (details.address_valid) fields.push("address");
  if (details.documents_authentic) fields.push("documents");

  return fields;
}

/**
 * Generate warnings based on verification results
 */
export function generateWarnings(
  entityData: EntityData,
  details: VerificationDetails,
  level: VerificationLevel,
): string[] {
  const warnings: string[] = [];

  if (!details.identity_verified) {
    warnings.push("Legal name format does not match entity type");
  }

  if (!details.jurisdiction_valid) {
    warnings.push("Jurisdiction is missing or invalid");
  }

  if (level !== "BASIC") {
    if (!details.tax_id_valid) {
      warnings.push("Tax ID is missing or invalid format");
    }

    if (!details.address_valid) {
      warnings.push("Address is missing or incomplete");
    }
  }

  if (level === "ENHANCED") {
    if (!details.documents_authentic) {
      warnings.push("Documents missing or hash validation failed");
    }

    if (!entityData.registration_number && !entityData.formation_date) {
      warnings.push(
        "Registration number or formation date recommended for enhanced verification",
      );
    }
  }

  return warnings;
}
