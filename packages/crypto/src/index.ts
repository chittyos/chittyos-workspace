/**
 * @pkg/crypto - ChittyOS Cryptographic Primitives
 *
 * Provides:
 * - Ed25519 digital signatures (Web Crypto based)
 * - RFC 8785 JSON Canonicalization Scheme (JCS)
 * - Base64/Base64URL encoding utilities
 *
 * Compatible with Node.js 18+, Cloudflare Workers, and browsers.
 *
 * @example
 * ```typescript
 * import { Ed25519, JCS, Base64 } from '@pkg/crypto';
 *
 * // Canonicalize and hash JSON
 * const result = await JCS.canonicalizeAndHash({
 *   type: 'json',
 *   content: '{"b":2,"a":1}'
 * });
 * // result.canonical = '{"a":1,"b":2}'
 * // result.hash = 'sha256:...'
 *
 * // Sign the canonical content
 * const { publicKey, privateKey } = await Ed25519.generateKeyPair();
 * const signature = await Ed25519.signBase64Url(privateKey, result.canonical);
 *
 * // Verify
 * const valid = await Ed25519.verify(publicKey, signature, result.canonical);
 * ```
 */

// Ed25519 Digital Signatures
export * as Ed25519 from './ed25519';

// RFC 8785 JSON Canonicalization Scheme
export * as JCS from './jcs';

// Base64 encoding utilities
export * as Base64 from './base64';

// Re-export commonly used types
export type { Jwk } from './ed25519';
export type {
  ContentType,
  CanonicalizeInput,
  CanonicalizeResult,
} from './jcs';
