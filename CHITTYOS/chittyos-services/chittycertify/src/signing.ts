// Digital signature operations using Web Crypto API

import { Certificate } from "./types";

/**
 * Generate a digital signature for certificate payload
 * Uses HMAC-SHA256 for signing (suitable for symmetric key signing)
 */
export async function signCertificate(
  payload: Omit<Certificate, "signature">,
  secretKey: string = "CHITTYOS_CERT_SIGNING_KEY_V1",
): Promise<string> {
  try {
    // Create deterministic string representation of payload
    const dataToSign = JSON.stringify({
      id: payload.id,
      chittyid: payload.chittyid,
      certificate_type: payload.certificate_type,
      issued_at: payload.issued_at,
      expires_at: payload.expires_at,
      trust_score: payload.trust_score,
      entity_data: payload.entity_data,
      verification_details: payload.verification_details,
    });

    // Encode the key and data
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const data = encoder.encode(dataToSign);

    // Import key for HMAC
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    // Sign the data
    const signature = await crypto.subtle.sign("HMAC", key, data);

    // Convert to hex string
    return arrayBufferToHex(signature);
  } catch (error) {
    console.error("Error signing certificate:", error);
    throw new Error("Failed to sign certificate");
  }
}

/**
 * Verify a certificate signature
 */
export async function verifyCertificateSignature(
  certificate: Certificate,
  secretKey: string = "CHITTYOS_CERT_SIGNING_KEY_V1",
): Promise<boolean> {
  try {
    // Create payload without signature
    const payload: Omit<Certificate, "signature"> = {
      id: certificate.id,
      chittyid: certificate.chittyid,
      certificate_type: certificate.certificate_type,
      issued_at: certificate.issued_at,
      expires_at: certificate.expires_at,
      trust_score: certificate.trust_score,
      entity_data: certificate.entity_data,
      verification_details: certificate.verification_details,
      certificate_url: certificate.certificate_url,
      qr_code_data: certificate.qr_code_data,
      status: certificate.status,
    };

    // Generate expected signature
    const expectedSignature = await signCertificate(payload, secretKey);

    // Compare signatures
    return expectedSignature === certificate.signature;
  } catch (error) {
    console.error("Error verifying signature:", error);
    return false;
  }
}

/**
 * Generate a QR code data string for certificate
 * Returns a data URL that can be embedded or used to generate QR code
 */
export function generateQRCodeData(
  certificateId: string,
  baseUrl: string,
): string {
  const verifyUrl = `${baseUrl}/v1/verify/${certificateId}`;
  // Return the URL that should be encoded in QR code
  // Client can use this to generate actual QR code image
  return verifyUrl;
}

/**
 * Convert ArrayBuffer to hex string
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  const hexCodes = [...byteArray].map((value) => {
    const hexCode = value.toString(16);
    return hexCode.padStart(2, "0");
  });
  return hexCodes.join("");
}

/**
 * Generate certificate ID
 */
export function generateCertificateId(): string {
  const timestamp = Date.now();
  const randomHex = `pending-id-${Date.now()}`.substring(0, 8);
  return `CERT-${timestamp}-${randomHex}`;
}
