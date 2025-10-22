/**
 * ChittyOS Todo Sync - Vector Clock Implementation
 * Version: 2.0.0
 *
 * Vector clocks enable causality tracking in distributed systems.
 * Each platform maintains a logical clock counter that increments
 * with each operation, allowing us to determine whether two events
 * happened before, after, or concurrently with each other.
 */

/**
 * Vector clock structure: maps platform identifier to logical clock value
 * Example: { "claude-code": 5, "chatgpt": 3, "desktop": 2 }
 */
export interface VectorClock {
  [platform: string]: number;
}

/**
 * Causal ordering between two vector clocks
 */
export enum CausalOrder {
  BEFORE = "before", // Clock1 happened before Clock2
  AFTER = "after", // Clock1 happened after Clock2
  EQUAL = "equal", // Clocks are identical
  CONCURRENT = "concurrent", // Events happened concurrently
}

/**
 * Vector Clock Manager for causality tracking
 */
export class VectorClockManager {
  /**
   * Initialize a new vector clock for a platform
   */
  static init(platform: string): VectorClock {
    return { [platform]: 0 };
  }

  /**
   * Increment the logical clock for a specific platform
   */
  static increment(clock: VectorClock, platform: string): VectorClock {
    return {
      ...clock,
      [platform]: (clock[platform] || 0) + 1,
    };
  }

  /**
   * Merge two vector clocks (take maximum value for each platform)
   * This is used when receiving updates from other platforms
   */
  static merge(clock1: VectorClock, clock2: VectorClock): VectorClock {
    const platforms = new Set([...Object.keys(clock1), ...Object.keys(clock2)]);

    const merged: VectorClock = {};
    for (const platform of platforms) {
      merged[platform] = Math.max(clock1[platform] || 0, clock2[platform] || 0);
    }

    return merged;
  }

  /**
   * Compare two vector clocks to determine causal ordering
   *
   * Returns:
   * - BEFORE: clock1 happened before clock2 (all values ≤, at least one <)
   * - AFTER: clock1 happened after clock2 (all values ≥, at least one >)
   * - EQUAL: clocks are identical (all values equal)
   * - CONCURRENT: events happened concurrently (incomparable)
   */
  static compare(clock1: VectorClock, clock2: VectorClock): CausalOrder {
    const platforms = new Set([...Object.keys(clock1), ...Object.keys(clock2)]);

    let hasLess = false;
    let hasGreater = false;

    for (const platform of platforms) {
      const v1 = clock1[platform] || 0;
      const v2 = clock2[platform] || 0;

      if (v1 < v2) hasLess = true;
      if (v1 > v2) hasGreater = true;
    }

    // All equal
    if (!hasLess && !hasGreater) return CausalOrder.EQUAL;

    // clock1 < clock2 (clock1 happened before)
    if (hasLess && !hasGreater) return CausalOrder.BEFORE;

    // clock1 > clock2 (clock1 happened after)
    if (hasGreater && !hasLess) return CausalOrder.AFTER;

    // Incomparable - concurrent events
    return CausalOrder.CONCURRENT;
  }

  /**
   * Serialize vector clock to JSON string for database storage
   */
  static serialize(clock: VectorClock): string {
    return JSON.stringify(clock);
  }

  /**
   * Deserialize vector clock from JSON string
   */
  static deserialize(serialized: string): VectorClock {
    try {
      const clock = JSON.parse(serialized);
      if (typeof clock !== "object" || clock === null) {
        throw new Error("Invalid vector clock format");
      }
      return clock as VectorClock;
    } catch (error) {
      throw new Error(
        `Failed to deserialize vector clock: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get the maximum timestamp value across all platforms
   * Useful for determining the "logical time" of a clock
   */
  static maxValue(clock: VectorClock): number {
    const values = Object.values(clock);
    return values.length > 0 ? Math.max(...values) : 0;
  }

  /**
   * Check if clock1 dominates clock2 (all values ≥)
   */
  static dominates(clock1: VectorClock, clock2: VectorClock): boolean {
    const platforms = new Set([...Object.keys(clock1), ...Object.keys(clock2)]);

    for (const platform of platforms) {
      const v1 = clock1[platform] || 0;
      const v2 = clock2[platform] || 0;
      if (v1 < v2) return false;
    }

    return true;
  }

  /**
   * Create a human-readable string representation of a vector clock
   */
  static toString(clock: VectorClock): string {
    const entries = Object.entries(clock)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([platform, value]) => `${platform}:${value}`);
    return `{${entries.join(", ")}}`;
  }

  /**
   * Validate that a vector clock is well-formed
   */
  static validate(clock: VectorClock): boolean {
    if (typeof clock !== "object" || clock === null) {
      return false;
    }

    for (const [platform, value] of Object.entries(clock)) {
      if (typeof platform !== "string" || platform.length === 0) {
        return false;
      }
      if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Update vector clock after receiving an event from another platform
   * Merges the remote clock and increments the local platform counter
   */
  static update(
    localClock: VectorClock,
    remoteClock: VectorClock,
    localPlatform: string,
  ): VectorClock {
    // Merge clocks (take max of each platform)
    const merged = this.merge(localClock, remoteClock);

    // Increment local platform counter
    return this.increment(merged, localPlatform);
  }
}

/**
 * Example usage:
 *
 * // Platform A creates a todo
 * let clockA = VectorClockManager.init('claude-code');
 * clockA = VectorClockManager.increment(clockA, 'claude-code');
 * // clockA = { "claude-code": 1 }
 *
 * // Platform B creates a different todo
 * let clockB = VectorClockManager.init('chatgpt');
 * clockB = VectorClockManager.increment(clockB, 'chatgpt');
 * // clockB = { "chatgpt": 1 }
 *
 * // Compare causality
 * const order = VectorClockManager.compare(clockA, clockB);
 * // order = CausalOrder.CONCURRENT (independent events)
 *
 * // Platform A receives B's update
 * clockA = VectorClockManager.update(clockA, clockB, 'claude-code');
 * // clockA = { "claude-code": 2, "chatgpt": 1 }
 *
 * // Now A's clock dominates B's clock
 * const order2 = VectorClockManager.compare(clockA, clockB);
 * // order2 = CausalOrder.AFTER
 */
