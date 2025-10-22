/**
 * ChittyVerify Service Types
 * Entity verification and validation types
 */

export type EntityType =
  | "LLC"
  | "PERSON"
  | "ORGANIZATION"
  | "CORPORATION"
  | "PARTNERSHIP";

export type VerificationLevel = "BASIC" | "STANDARD" | "ENHANCED";

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface EntityData {
  legal_name: string;
  jurisdiction?: string;
  tax_id?: string;
  address?: Address;
  registration_number?: string;
  formation_date?: string;
  registered_agent?: string;
}

export interface Document {
  type: string;
  url: string;
  hash: string;
}

export interface VerifyRequest {
  entity_type: EntityType;
  entity_data: EntityData;
  verification_level: VerificationLevel;
  documents?: Document[];
}

export interface VerificationDetails {
  identity_verified: boolean;
  documents_authentic: boolean;
  cross_references_valid: boolean;
  tax_id_valid?: boolean;
  address_valid?: boolean;
  jurisdiction_valid?: boolean;
}

export interface VerifyResponse {
  status: "PASS" | "FAIL" | "REVIEW";
  verification_level: VerificationLevel;
  verified_fields: string[];
  confidence_score: number; // 0-1
  verification_details: VerificationDetails;
  warnings: string[];
  timestamp: string;
}

export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  service: string;
  version: string;
  timestamp: string;
}
