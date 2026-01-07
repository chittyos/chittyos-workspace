/**
 * Base64 and Base64URL encoding utilities
 * Compatible with Node.js, Cloudflare Workers, and browsers
 */

/**
 * Encode bytes to Base64URL (RFC 4648 Section 5)
 * No padding, URL-safe alphabet
 */
export function toBase64Url(bytes: Uint8Array): string {
  const base64 = Buffer.from(bytes).toString('base64');
  return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Decode Base64URL string to bytes
 */
export function fromBase64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const base64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/**
 * Encode bytes to standard Base64
 */
export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

/**
 * Decode standard Base64 string to bytes
 */
export function fromBase64(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'base64'));
}

/**
 * Encode bytes to hexadecimal string
 */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Decode hexadecimal string to bytes
 */
export function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
