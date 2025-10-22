// Type definitions for ChittyCertify service

export interface Env {
  CERTIFICATES: KVNamespace;
  ENVIRONMENT: string;
  CHITTYID_SERVICE: string;
  CHITTYID_SERVICE_URL: string;
  CHITTY_ID_TOKEN: string;
  REGISTRY_SERVICE_URL: string;
  CHITTYOS_ACCOUNT_ID: string;
  CHITTYOS_DOMAIN: string;
}

export type CertificateType = "BASIC" | "ENHANCED" | "PREMIUM";

export interface IssueCertificateRequest {
  chittyid: string;
  entity_data: {
    legal_name: string;
    entity_type?: string;
    jurisdiction?: string;
    tax_id?: string;
    [key: string]: any;
  };
  trust_score: number;
  verification_report: {
    status: string;
    verification_level: string;
    verified_fields: string[];
    confidence_score?: number;
    [key: string]: any;
  };
  certificate_type?: CertificateType;
  validity_period?: string; // e.g., '1 year', '6 months'
}

export interface Certificate {
  id: string;
  chittyid: string;
  certificate_type: CertificateType;
  issued_at: string;
  expires_at: string;
  trust_score: number;
  entity_data: {
    legal_name: string;
    entity_type?: string;
    [key: string]: any;
  };
  verification_details: {
    verification_level: string;
    verified_fields: string[];
    confidence_score?: number;
  };
  signature: string;
  certificate_url: string;
  qr_code_data: string;
  status: "valid" | "revoked" | "expired";
}

export interface VerifyCertificateRequest {
  certificate_id: string;
  signature?: string;
}

export interface VerifyCertificateResponse {
  valid: boolean;
  certificate?: Certificate;
  reason?: string;
}

export interface ErrorResponse {
  error: string;
  details?: string;
  timestamp: string;
}
