/**
 * ChittyCertify - Certificate Authority Service
 * Authoritative service for ChittyOS certification at certify.chitty.cc
 */

import {
  Env,
  IssueCertificateRequest,
  VerifyCertificateRequest,
  Certificate,
  ErrorResponse,
} from "./types";
import {
  validateIssuanceRequest,
  parseValidityPeriod,
  determineCertificateType,
} from "./validation";
import { signCertificate, verifyCertificateSignature } from "./signing";
import { storeCertificate, getCertificate, revokeCertificate } from "./storage";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check
      if (path === "/health") {
        return jsonResponse(
          {
            status: "healthy",
            service: "ChittyCertify",
            version: "1.0.0",
            timestamp: new Date().toISOString(),
          },
          200,
          corsHeaders,
        );
      }

      // Issue certificate
      if (path === "/api/v1/issue" && request.method === "POST") {
        return await handleIssueCertificate(request, env, corsHeaders);
      }

      // Verify certificate
      if (path === "/api/v1/verify" && request.method === "POST") {
        return await handleVerifyCertificate(request, env, corsHeaders);
      }

      // Get certificate by ID
      if (path.startsWith("/api/v1/certificate/") && request.method === "GET") {
        const certificateId = path.split("/").pop();
        return await handleGetCertificate(certificateId!, env, corsHeaders);
      }

      // Revoke certificate
      if (path === "/api/v1/revoke" && request.method === "POST") {
        return await handleRevokeCertificate(request, env, corsHeaders);
      }

      // Service info
      if (path === "/" || path === "/api/v1") {
        return jsonResponse(
          {
            service: "ChittyCertify",
            description: "Certificate Authority for ChittyOS ecosystem",
            version: "1.0.0",
            endpoints: {
              "/health": "Health check",
              "/api/v1/issue": "Issue certificate (POST)",
              "/api/v1/verify": "Verify certificate (POST)",
              "/api/v1/certificate/:id": "Get certificate (GET)",
              "/api/v1/revoke": "Revoke certificate (POST)",
            },
            timestamp: new Date().toISOString(),
          },
          200,
          corsHeaders,
        );
      }

      return errorResponse("Not found", 404, corsHeaders);
    } catch (error) {
      console.error("ChittyCertify error:", error);
      return errorResponse(
        error instanceof Error ? error.message : "Internal server error",
        500,
        corsHeaders,
      );
    }
  },
};

/**
 * Handle certificate issuance
 */
async function handleIssueCertificate(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const body = (await request.json()) as IssueCertificateRequest;

  // Validate request
  const validation = validateIssuanceRequest(body);
  if (!validation.valid) {
    return errorResponse(
      "Validation failed",
      400,
      corsHeaders,
      validation.errors.join(", "),
    );
  }

  // Generate certificate ID from ChittyID service
  const chittyIdResponse = await mintChittyID(env, "CERTIFICATE");
  if (!chittyIdResponse.success) {
    return errorResponse(
      "Failed to generate certificate ID",
      500,
      corsHeaders,
      chittyIdResponse.error,
    );
  }
  const certificateId = chittyIdResponse.chittyId;

  // Calculate expiration
  const issuedAt = new Date();
  const validityMs = parseValidityPeriod(body.validity_period);
  const expiresAt = new Date(issuedAt.getTime() + validityMs);

  // Determine certificate type
  const certificateType = determineCertificateType(
    body.trust_score,
    body.certificate_type,
  );

  // Create certificate
  const certificate: Certificate = {
    id: certificateId,
    chittyid: body.chittyid,
    certificate_type: certificateType,
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    trust_score: body.trust_score,
    entity_data: body.entity_data,
    verification_details: {
      verification_level: body.verification_report.verification_level,
      verified_fields: body.verification_report.verified_fields,
      confidence_score: body.verification_report.confidence_score,
    },
    signature: "", // Will be set by signing
    certificate_url: `https://certify.chitty.cc/api/v1/certificate/${certificateId}`,
    qr_code_data: `https://certify.chitty.cc/verify?id=${certificateId}`,
    status: "valid",
  };

  // Sign certificate
  const signature = await signCertificate(certificate, env);
  certificate.signature = signature;

  // Store certificate
  await storeCertificate(env, certificate);

  return jsonResponse(certificate, 201, corsHeaders);
}

/**
 * Handle certificate verification
 */
async function handleVerifyCertificate(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const body = (await request.json()) as VerifyCertificateRequest;

  if (!body.certificate_id) {
    return errorResponse("certificate_id is required", 400, corsHeaders);
  }

  const certificate = await getCertificate(env, body.certificate_id);

  if (!certificate) {
    return jsonResponse(
      {
        valid: false,
        reason: "Certificate not found",
      },
      200,
      corsHeaders,
    );
  }

  // Check expiration
  if (new Date() > new Date(certificate.expires_at)) {
    return jsonResponse(
      {
        valid: false,
        certificate,
        reason: "Certificate expired",
      },
      200,
      corsHeaders,
    );
  }

  // Check revocation
  if (certificate.status === "revoked") {
    return jsonResponse(
      {
        valid: false,
        certificate,
        reason: "Certificate revoked",
      },
      200,
      corsHeaders,
    );
  }

  // Verify signature if provided
  if (body.signature) {
    const signatureValid = await verifyCertificateSignature(
      certificate,
      body.signature,
      env,
    );
    if (!signatureValid) {
      return jsonResponse(
        {
          valid: false,
          certificate,
          reason: "Invalid signature",
        },
        200,
        corsHeaders,
      );
    }
  }

  return jsonResponse(
    {
      valid: true,
      certificate,
    },
    200,
    corsHeaders,
  );
}

/**
 * Handle get certificate by ID
 */
async function handleGetCertificate(
  certificateId: string,
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const certificate = await getCertificate(env, certificateId);

  if (!certificate) {
    return errorResponse("Certificate not found", 404, corsHeaders);
  }

  return jsonResponse(certificate, 200, corsHeaders);
}

/**
 * Handle certificate revocation
 */
async function handleRevokeCertificate(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const body = (await request.json()) as {
    certificate_id: string;
    reason?: string;
  };

  if (!body.certificate_id) {
    return errorResponse("certificate_id is required", 400, corsHeaders);
  }

  const success = await revokeCertificate(env, body.certificate_id);

  if (!success) {
    return errorResponse("Certificate not found", 404, corsHeaders);
  }

  return jsonResponse(
    {
      success: true,
      certificate_id: body.certificate_id,
      revoked_at: new Date().toISOString(),
      reason: body.reason || "No reason provided",
    },
    200,
    corsHeaders,
  );
}

/**
 * Mint ChittyID from authoritative service
 */
async function mintChittyID(
  env: Env,
  entityType: string,
): Promise<{ success: boolean; chittyId?: string; error?: string }> {
  try {
    const chittyIdService = env.CHITTYID_SERVICE || "https://id.chitty.cc";
    const response = await fetch(`${chittyIdService}/mint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.CHITTY_ID_TOKEN}`,
      },
      body: JSON.stringify({
        entityType,
        metadata: {
          service: "ChittyCertify",
          timestamp: new Date().toISOString(),
        },
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `ChittyID service returned ${response.status}`,
      };
    }

    const data = (await response.json()) as any;
    return {
      success: true,
      chittyId: data.chittyId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Helper: JSON response
 */
function jsonResponse(
  data: any,
  status: number = 200,
  additionalHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...additionalHeaders,
    },
  });
}

/**
 * Helper: Error response
 */
function errorResponse(
  error: string,
  status: number = 500,
  additionalHeaders: Record<string, string> = {},
  details?: string,
): Response {
  const errorData: ErrorResponse = {
    error,
    details,
    timestamp: new Date().toISOString(),
  };

  return jsonResponse(errorData, status, additionalHeaders);
}
