/**
 * RFC 8785 JSON Canonicalization Scheme (JCS)
 *
 * Provides deterministic serialization for:
 * - JSON (RFC 8785 compliant)
 * - YAML (converted to JSON, then canonicalized)
 * - Text (normalized line endings, trimmed whitespace)
 *
 * Used for creating canonical representations suitable for
 * cryptographic signing and hash verification.
 */

import { canonicalize } from 'json-canonicalize';
import YAML from 'yaml';
import { getSubtle, utf8Encode } from './webcrypto';
import { toHex } from './base64';

export type ContentType = 'json' | 'yaml' | 'text';

export interface CanonicalizeInput {
  type: ContentType;
  content: string;
  options?: Record<string, unknown>;
}

export interface CanonicalizeResult {
  /** The canonicalized content as a UTF-8 string */
  canonical: string;
  /** SHA-256 hash in format "sha256:<hex>" */
  hash: string;
  /** The content type that was processed */
  type: ContentType;
}

/**
 * Canonicalize a JSON string per RFC 8785
 * - Keys sorted lexicographically
 * - No whitespace
 * - Unicode normalized
 */
export function canonicalizeJson(input: string): string {
  const value = JSON.parse(input);
  return canonicalize(value);
}

/**
 * Canonicalize a JavaScript value to JSON per RFC 8785
 */
export function canonicalizeValue(value: unknown): string {
  return canonicalize(value);
}

/**
 * Canonicalize YAML by converting to JSON first
 */
export function canonicalizeYaml(input: string): string {
  const value = YAML.parse(input);
  return canonicalize(value);
}

/**
 * Canonicalize plain text
 * - Normalize line endings to LF
 * - Strip trailing whitespace per line
 * - Remove trailing newline
 */
export function canonicalizeText(input: string): string {
  const lf = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = lf
    .split('\n')
    .map((line) => line.replace(/[\t ]+$/g, ''))
    .join('\n');
  return lines.replace(/\n$/g, '');
}

/**
 * Compute SHA-256 hash and return as hex string
 */
export async function sha256(data: string | Uint8Array): Promise<string> {
  const subtle = await getSubtle();
  const bytes = typeof data === 'string' ? utf8Encode(data) : data;
  const digest = await subtle.digest('SHA-256', bytes);
  return toHex(new Uint8Array(digest));
}

/**
 * Canonicalize content and compute its hash
 * Main entry point for the JCS module
 */
export async function canonicalizeAndHash(
  input: CanonicalizeInput
): Promise<CanonicalizeResult> {
  let canonical: string;

  switch (input.type) {
    case 'json':
      canonical = canonicalizeJson(input.content);
      break;
    case 'yaml':
      canonical = canonicalizeYaml(input.content);
      break;
    case 'text':
      canonical = canonicalizeText(input.content);
      break;
    default:
      throw new Error(`Unsupported content type: ${input.type}`);
  }

  const hashHex = await sha256(canonical);

  return {
    canonical,
    hash: `sha256:${hashHex}`,
    type: input.type,
  };
}

// Legacy exports for backwards compatibility with chittyagent
export {
  canonicalizeJson as canonicalize_json_string,
  canonicalizeYaml as canonicalize_yaml_string,
  canonicalizeText as canonicalize_text,
  sha256 as sha256_hex,
  canonicalizeAndHash as canonicalize_request,
};

// Re-export CanonicalizeResult with legacy name
export type { CanonicalizeResult as CanonicalizeOutput };
