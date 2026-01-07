/**
 * Web Crypto API abstraction
 * Works in Node.js 18+, Cloudflare Workers, and browsers
 */

export async function getSubtle(): Promise<SubtleCrypto> {
  if (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.subtle) {
    return (globalThis as any).crypto.subtle as SubtleCrypto;
  }
  try {
    // Node.js fallback
    const { webcrypto } = await import('node:crypto');
    return webcrypto.subtle as SubtleCrypto;
  } catch {
    throw new Error('Web Crypto subtle API not available');
  }
}

export function utf8Encode(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

export function utf8Decode(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return new TextDecoder().decode(view);
}
