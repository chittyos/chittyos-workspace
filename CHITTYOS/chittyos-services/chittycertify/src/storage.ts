// Certificate storage operations using Cloudflare KV

import { Certificate, Env } from "./types";

/**
 * Store certificate in KV with expiration
 */
export async function storeCertificate(
  env: Env,
  certificate: Certificate,
): Promise<void> {
  try {
    const key = `cert:${certificate.id}`;

    // Calculate expiration timestamp
    const expiresAt = new Date(certificate.expires_at);
    const now = new Date();
    const ttlSeconds = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);

    // Store in KV with expiration (max 1 year = 31536000 seconds)
    const finalTTL = Math.min(ttlSeconds, 31536000);

    await env.CERTIFICATES.put(key, JSON.stringify(certificate), {
      expirationTtl: finalTTL > 0 ? finalTTL : 31536000, // Default 1 year if calculation fails
    });

    // Also create index by ChittyID for lookups
    const chittyIdKey = `chittyid:${certificate.chittyid}`;
    const existingCerts =
      ((await env.CERTIFICATES.get(chittyIdKey, "json")) as string[]) || [];

    if (!existingCerts.includes(certificate.id)) {
      existingCerts.push(certificate.id);
      await env.CERTIFICATES.put(chittyIdKey, JSON.stringify(existingCerts), {
        expirationTtl: finalTTL > 0 ? finalTTL : 31536000,
      });
    }

    console.log(`Stored certificate ${certificate.id} with TTL ${finalTTL}s`);
  } catch (error) {
    console.error("Error storing certificate:", error);
    throw new Error("Failed to store certificate");
  }
}

/**
 * Retrieve certificate from KV
 */
export async function getCertificate(
  env: Env,
  certificateId: string,
): Promise<Certificate | null> {
  try {
    const key = `cert:${certificateId}`;
    const certData = await env.CERTIFICATES.get(key, "json");

    if (!certData) {
      return null;
    }

    const certificate = certData as Certificate;

    // Check if certificate is expired
    const expiresAt = new Date(certificate.expires_at);
    const now = new Date();

    if (now > expiresAt) {
      certificate.status = "expired";
    }

    return certificate;
  } catch (error) {
    console.error("Error retrieving certificate:", error);
    return null;
  }
}

/**
 * Get all certificates for a ChittyID
 */
export async function getCertificatesByChittyId(
  env: Env,
  chittyid: string,
): Promise<Certificate[]> {
  try {
    const chittyIdKey = `chittyid:${chittyid}`;
    const certIds =
      ((await env.CERTIFICATES.get(chittyIdKey, "json")) as string[]) || [];

    const certificates: Certificate[] = [];

    for (const certId of certIds) {
      const cert = await getCertificate(env, certId);
      if (cert) {
        certificates.push(cert);
      }
    }

    return certificates;
  } catch (error) {
    console.error("Error retrieving certificates by ChittyID:", error);
    return [];
  }
}

/**
 * Revoke a certificate
 */
export async function revokeCertificate(
  env: Env,
  certificateId: string,
): Promise<boolean> {
  try {
    const certificate = await getCertificate(env, certificateId);

    if (!certificate) {
      return false;
    }

    certificate.status = "revoked";

    const key = `cert:${certificateId}`;
    await env.CERTIFICATES.put(key, JSON.stringify(certificate));

    console.log(`Revoked certificate ${certificateId}`);
    return true;
  } catch (error) {
    console.error("Error revoking certificate:", error);
    return false;
  }
}
