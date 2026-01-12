// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert base64 string to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert ArrayBuffer to base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Compute SHA-256 hash of an ArrayBuffer
 */
export async function computeHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a UUID v4
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Get nested value from object using dot notation path
 */
export function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => {
    // Handle array notation like "parties[0]"
    const match = k.match(/^(\w+)\[(\d+)\]$/);
    if (match) {
      const [, key, index] = match;
      return o?.[key]?.[parseInt(index, 10)];
    }
    return o?.[k];
  }, obj);
}

/**
 * Set nested value in object using dot notation path
 */
export function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const last = keys.pop()!;

  let target = obj;
  for (const key of keys) {
    const match = key.match(/^(\w+)\[(\d+)\]$/);
    if (match) {
      const [, k, index] = match;
      target[k] = target[k] || [];
      target[k][parseInt(index, 10)] = target[k][parseInt(index, 10)] || {};
      target = target[k][parseInt(index, 10)];
    } else {
      target[key] = target[key] || {};
      target = target[key];
    }
  }

  // Handle array notation in the last key
  const lastMatch = last.match(/^(\w+)\[(\d+)\]$/);
  if (lastMatch) {
    const [, k, index] = lastMatch;
    target[k] = target[k] || [];
    target[k][parseInt(index, 10)] = value;
  } else {
    target[last] = value;
  }
}

/**
 * Normalize entity name for comparison
 */
export function normalizeEntityName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|corp|ltd|co|company|corporation|limited)\b\.?/gi, (m) =>
      m.toLowerCase().replace('.', '')
    );
}

/**
 * Infer entity type from name
 */
export function inferEntityType(name: string, role?: string): string {
  const lowerName = name.toLowerCase();

  if (lowerName.includes('llc') || lowerName.includes('limited liability')) {
    return 'llc';
  }
  if (
    lowerName.includes('inc') ||
    lowerName.includes('corp') ||
    lowerName.includes('incorporated')
  ) {
    return 'corporation';
  }
  if (lowerName.includes('trust')) {
    return 'trust';
  }
  if (lowerName.includes('partnership') || lowerName.includes('lp') || lowerName.includes('llp')) {
    return 'partnership';
  }
  if (lowerName.includes('estate')) {
    return 'estate';
  }

  return 'person';
}

/**
 * Parse ISO date string to Date object
 */
export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Format date as ISO string (date only)
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Calculate days until a date
 */
export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Simple hash function for context fingerprinting
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Safe JSON parse with default
 */
export function safeJsonParse<T>(json: string | null | undefined, defaultValue: T): T {
  if (!json) return defaultValue;
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Batch array into chunks
 */
export function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        await sleep(Math.min(delay, maxDelayMs));
        delay *= backoffMultiplier;
      }
    }
  }

  throw lastError;
}

/**
 * Create a placeholder for a knowledge gap
 */
export function createGapPlaceholder(gapId: string): string {
  return `{{GAP:${gapId}}}`;
}

/**
 * Extract gap ID from placeholder
 */
export function extractGapId(placeholder: string): string | null {
  const match = placeholder.match(/\{\{GAP:([a-f0-9-]+)\}\}/);
  return match ? match[1] : null;
}

/**
 * Check if a value contains a gap placeholder
 */
export function containsGapPlaceholder(value: string): boolean {
  return /\{\{GAP:[a-f0-9-]+\}\}/.test(value);
}

/**
 * Replace all gap placeholders in a string
 */
export function replaceGapPlaceholders(
  text: string,
  replacements: Map<string, string>
): string {
  return text.replace(/\{\{GAP:([a-f0-9-]+)\}\}/g, (match, gapId) => {
    return replacements.get(gapId) || match;
  });
}
