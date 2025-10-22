/**
 * Retry Mechanism with Exponential Backoff
 * Handles rate limits, transient errors, and circuit breaking
 */

import { NOTION_CONFIG } from './notion-sync-config.js';

/**
 * Retry wrapper with exponential backoff and jitter
 */
export async function withRetry(operation, options = {}) {
  const {
    maxRetries = NOTION_CONFIG.api.maxRetries,
    baseDelay = NOTION_CONFIG.api.retryDelay,
    maxBackoff = NOTION_CONFIG.rateLimit.maxBackoff,
    backoffMultiplier = NOTION_CONFIG.rateLimit.backoffMultiplier,
    jitterRange = NOTION_CONFIG.rateLimit.jitterRange,
    retryCondition = defaultRetryCondition,
    onRetry = null
  } = options;

  let lastError = null;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const result = await operation();
      return result;

    } catch (error) {
      lastError = error;
      attempt++;

      // Check if we should retry
      if (attempt > maxRetries || !retryCondition(error, attempt)) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const baseBackoff = Math.min(
        baseDelay * Math.pow(backoffMultiplier, attempt - 1),
        maxBackoff
      );

      const jitter = baseBackoff * jitterRange * Math.random();
      const delay = baseBackoff + jitter;

      if (onRetry) {
        onRetry(error, attempt, delay);
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Default retry condition - determines if an error should trigger a retry
 */
function defaultRetryCondition(error, attempt) {
  // Always retry on network errors
  if (isNetworkError(error)) {
    return true;
  }

  // Retry on 5xx server errors
  if (error.status >= 500 && error.status < 600) {
    return true;
  }

  // Retry on 429 (rate limit) with special handling
  if (error.status === 429) {
    return true;
  }

  // Retry on specific Notion API errors
  if (error.code === 'internal_server_error') {
    return true;
  }

  if (error.code === 'rate_limited') {
    return true;
  }

  // Don't retry on client errors (4xx except 429)
  if (error.status >= 400 && error.status < 500 && error.status !== 429) {
    return false;
  }

  // Retry on timeout errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    return true;
  }

  return false;
}

/**
 * Check if error is a network-related error
 */
function isNetworkError(error) {
  const networkCodes = [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'EAI_AGAIN'
  ];

  return networkCodes.includes(error.code) ||
         error.message?.includes('network') ||
         error.message?.includes('timeout');
}

/**
 * Rate-limited operation wrapper
 */
export class RateLimiter {
  constructor(requestsPerSecond = NOTION_CONFIG.rateLimit.requestsPerSecond) {
    this.requestsPerSecond = requestsPerSecond;
    this.tokens = requestsPerSecond;
    this.lastRefill = Date.now();
    this.queue = [];
    this.processing = false;
  }

  async execute(operation) {
    return new Promise((resolve, reject) => {
      this.queue.push({ operation, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      await this.refillTokens();

      if (this.tokens < 1) {
        // Wait until we have tokens
        const waitTime = (1 - this.tokens) * (1000 / this.requestsPerSecond);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      const { operation, resolve, reject } = this.queue.shift();
      this.tokens -= 1;

      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  }

  async refillTokens() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = (timePassed / 1000) * this.requestsPerSecond;

    this.tokens = Math.min(this.requestsPerSecond, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

/**
 * Circuit breaker to prevent cascading failures
 */
export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds

    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.lastFailureTime = null;
    this.lastAttemptTime = null;
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;

    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * Notion-specific retry wrapper
 */
export async function notionRetry(notionOperation, options = {}) {
  const rateLimiter = new RateLimiter();
  const circuitBreaker = new CircuitBreaker(options.circuitBreaker);

  const operation = async () => {
    return await circuitBreaker.execute(async () => {
      return await rateLimiter.execute(notionOperation);
    });
  };

  return await withRetry(operation, {
    ...options,
    onRetry: (error, attempt, delay) => {
      console.warn(`Notion API retry ${attempt}: ${error.message} (waiting ${delay}ms)`);

      // Log rate limit information
      if (error.status === 429) {
        const retryAfter = error.headers?.['retry-after'];
        if (retryAfter) {
          console.warn(`Rate limited. Retry after: ${retryAfter} seconds`);
        }
      }

      if (options.onRetry) {
        options.onRetry(error, attempt, delay);
      }
    },
    retryCondition: (error, attempt) => {
      // Enhanced retry condition for Notion API
      if (error.status === 429) {
        // Always retry rate limits but with longer backoff
        return attempt <= 3;
      }

      if (error.status === 502 || error.status === 503 || error.status === 504) {
        return attempt <= 2;
      }

      return defaultRetryCondition(error, attempt);
    }
  });
}

/**
 * Batch operation with automatic retry and rate limiting
 */
export async function batchWithRetry(items, batchOperation, options = {}) {
  const {
    batchSize = 10,
    batchDelay = 200,
    maxConcurrency = 3,
    retryOptions = {}
  } = options;

  const results = [];
  const errors = [];

  // Process in chunks
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    // Process batch with limited concurrency
    const batchPromises = batch.map(async (item) => {
      try {
        const result = await notionRetry(
          () => batchOperation(item),
          retryOptions
        );
        return { item, result, success: true };

      } catch (error) {
        return { item, error, success: false };
      }
    });

    // Wait for batch completion
    const batchResults = await Promise.all(batchPromises);

    // Separate successes and failures
    for (const result of batchResults) {
      if (result.success) {
        results.push(result);
      } else {
        errors.push(result);
      }
    }

    // Delay between batches
    if (i + batchSize < items.length && batchDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
  }

  return {
    successful: results,
    failed: errors,
    successRate: results.length / items.length,
    totalProcessed: items.length
  };
}