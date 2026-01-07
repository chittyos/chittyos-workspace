/**
 * Ed25519 Digital Signatures
 * Uses Web Crypto API (Node.js 18+, Cloudflare Workers, browsers)
 *
 * Provides:
 * - Key generation
 * - JWK import/export
 * - Message signing and verification
 * - Base64URL signature encoding for JOSE compatibility
 */

import { getSubtle, utf8Encode } from './webcrypto';
import { fromBase64Url, toBase64Url } from './base64';

export type Jwk = JsonWebKey;

/**
 * Generate a new Ed25519 key pair
 */
export async function generateKeyPair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}> {
  const subtle = await getSubtle();
  return subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ]) as Promise<CryptoKeyPair>;
}

/**
 * Import an Ed25519 public key from JWK format
 */
export async function importPublicJwk(jwk: Jwk): Promise<CryptoKey> {
  const subtle = await getSubtle();
  if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519' || !jwk.x) {
    throw new Error('Invalid Ed25519 public JWK');
  }
  return subtle.importKey('jwk', jwk, { name: 'Ed25519' }, true, ['verify']);
}

/**
 * Import an Ed25519 private key from JWK format
 */
export async function importPrivateJwk(jwk: Jwk): Promise<CryptoKey> {
  const subtle = await getSubtle();
  if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519' || !jwk.d || !jwk.x) {
    throw new Error('Invalid Ed25519 private JWK');
  }
  return subtle.importKey('jwk', jwk, { name: 'Ed25519' }, true, ['sign']);
}

/**
 * Export a CryptoKey to JWK format
 */
export async function exportJwk(key: CryptoKey): Promise<Jwk> {
  const subtle = await getSubtle();
  return (await subtle.exportKey('jwk', key)) as Jwk;
}

/**
 * Sign data with an Ed25519 private key
 * Returns raw signature bytes
 */
export async function sign(
  privateKey: CryptoKey,
  data: Uint8Array | string
): Promise<Uint8Array> {
  const subtle = await getSubtle();
  const bytes = typeof data === 'string' ? utf8Encode(data) : data;
  const sig = await subtle.sign({ name: 'Ed25519' }, privateKey, bytes);
  return new Uint8Array(sig);
}

/**
 * Sign data and return Base64URL-encoded signature
 * Suitable for JOSE/JWT detached signatures
 */
export async function signBase64Url(
  privateKey: CryptoKey,
  data: Uint8Array | string
): Promise<string> {
  const sig = await sign(privateKey, data);
  return toBase64Url(sig);
}

/**
 * Verify an Ed25519 signature
 * Accepts signature as Uint8Array or Base64URL string
 */
export async function verify(
  publicKey: CryptoKey,
  signature: Uint8Array | string,
  data: Uint8Array | string
): Promise<boolean> {
  const subtle = await getSubtle();
  const sigBytes =
    typeof signature === 'string' ? fromBase64Url(signature) : signature;
  const dataBytes = typeof data === 'string' ? utf8Encode(data) : data;
  return subtle.verify({ name: 'Ed25519' }, publicKey, sigBytes, dataBytes);
}

// Legacy exports for backwards compatibility with chittyagent
export {
  generateKeyPair as generateEd25519,
  sign as signEd25519,
  signBase64Url as signEd25519B64Url,
  verify as verifyEd25519,
  exportJwk as exportPublicJwk,
};
