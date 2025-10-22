/**
 * ChittyOS Todo Sync - Three-Way Merge Engine
 * Version: 2.0.0
 *
 * Implements Git-style three-way merge algorithm for conflict detection
 * and resolution. Uses vector clocks for causality-based merging.
 */

import type { Todo, TodoStatus } from "./types";
import { VectorClockManager, VectorClock, CausalOrder } from "./vector-clock";

/**
 * Conflict types that can occur during merge
 */
export enum ConflictType {
  CONTENT_DIFF = "content_diff", // Different content
  STATUS_DIFF = "status_diff", // Different status
  DELETE_CONFLICT = "delete_conflict", // One deleted, one modified
  CONCURRENT_EDIT = "concurrent_edit", // Both edited concurrently
}

/**
 * Merge strategies for conflict resolution
 */
export enum MergeStrategy {
  THREE_WAY = "three_way", // Standard Git-style three-way merge
  TIMESTAMP = "timestamp", // Latest timestamp wins
  STATUS_PRIORITY = "status_priority", // completed > in_progress > pending
  KEEP_LOCAL = "keep_local", // Always keep local version
  KEEP_REMOTE = "keep_remote", // Always keep remote version
  KEEP_BOTH = "keep_both", // Create separate todos
  MANUAL = "manual", // Requires manual resolution
}

/**
 * Todo with vector clock for merge operations
 */
export interface TodoWithClock extends Todo {
  vectorClock?: VectorClock;
}

/**
 * Conflict record for unresolved merges
 */
export interface ConflictRecord {
  id: string; // Conflict ID
  todoId: string; // Todo being merged
  conflictType: ConflictType;
  baseVersion: TodoWithClock | null;
  localVersion: TodoWithClock;
  remoteVersion: TodoWithClock;
  detectedAt: number;
  resolved: boolean;
  resolvedAt?: number;
  resolutionStrategy?: MergeStrategy;
  resolvedBy?: string;
}

/**
 * Result of a merge operation
 */
export interface MergeResult {
  merged: TodoWithClock | TodoWithClock[]; // Resulting todo(s)
  conflict: boolean; // True if conflict detected
  conflictType?: ConflictType;
  strategy: MergeStrategy;
  autoResolved: boolean;
  conflictRecord?: ConflictRecord;
}

/**
 * Three-Way Merge Engine
 */
export class MergeEngine {
  /**
   * Perform three-way merge on a single todo
   *
   * @param local - Local version of the todo
   * @param remote - Remote version of the todo
   * @param base - Common ancestor version (last known sync point)
   * @param defaultStrategy - Default strategy for conflict resolution
   * @returns MergeResult with merged todo or conflict information
   */
  static threeWayMerge(
    local: TodoWithClock | null,
    remote: TodoWithClock | null,
    base: TodoWithClock | null,
    defaultStrategy: MergeStrategy = MergeStrategy.TIMESTAMP,
  ): MergeResult {
    // Case 1: Both deleted or never existed
    if (!local && !remote) {
      return {
        merged: base || ({} as TodoWithClock),
        conflict: false,
        strategy: MergeStrategy.THREE_WAY,
        autoResolved: true,
      };
    }

    // Case 2: Only in local (created locally or remote deleted)
    if (local && !remote) {
      if (base) {
        // Remote deleted, local modified - CONFLICT
        return this.handleDeleteConflict(local, base, "local_modified");
      } else {
        // Created locally only
        return {
          merged: local,
          conflict: false,
          strategy: MergeStrategy.THREE_WAY,
          autoResolved: true,
        };
      }
    }

    // Case 3: Only in remote (created remotely or local deleted)
    if (remote && !local) {
      if (base) {
        // Local deleted, remote modified - CONFLICT
        return this.handleDeleteConflict(remote, base, "remote_modified");
      } else {
        // Created remotely only
        return {
          merged: remote,
          conflict: false,
          strategy: MergeStrategy.THREE_WAY,
          autoResolved: true,
        };
      }
    }

    // Case 4: Both exist - perform three-way merge
    if (local && remote) {
      return this.mergeBothExist(local, remote, base, defaultStrategy);
    }

    // Should not reach here
    throw new Error("Invalid merge state");
  }

  /**
   * Merge when both local and remote versions exist
   */
  private static mergeBothExist(
    local: TodoWithClock,
    remote: TodoWithClock,
    base: TodoWithClock | null,
    defaultStrategy: MergeStrategy,
  ): MergeResult {
    // If no base, treat as concurrent creation
    if (!base) {
      return this.mergeConcurrentCreation(local, remote, defaultStrategy);
    }

    // Check if either side is unchanged from base
    const localUnchanged = this.equals(local, base);
    const remoteUnchanged = this.equals(remote, base);

    // Case 1: Neither changed - no merge needed
    if (localUnchanged && remoteUnchanged) {
      return {
        merged: local,
        conflict: false,
        strategy: MergeStrategy.THREE_WAY,
        autoResolved: true,
      };
    }

    // Case 2: Only local changed
    if (!localUnchanged && remoteUnchanged) {
      return {
        merged: local,
        conflict: false,
        strategy: MergeStrategy.THREE_WAY,
        autoResolved: true,
      };
    }

    // Case 3: Only remote changed
    if (localUnchanged && !remoteUnchanged) {
      return {
        merged: remote,
        conflict: false,
        strategy: MergeStrategy.THREE_WAY,
        autoResolved: true,
      };
    }

    // Case 4: Both changed - check if changes are identical
    if (this.equals(local, remote)) {
      return {
        merged: local,
        conflict: false,
        strategy: MergeStrategy.THREE_WAY,
        autoResolved: true,
      };
    }

    // Case 5: Both changed differently - use vector clocks for causality
    if (local.vectorClock && remote.vectorClock) {
      const order = VectorClockManager.compare(
        local.vectorClock,
        remote.vectorClock,
      );

      switch (order) {
        case CausalOrder.BEFORE:
          // Local happened before remote → take remote
          return {
            merged: remote,
            conflict: false,
            strategy: MergeStrategy.THREE_WAY,
            autoResolved: true,
          };

        case CausalOrder.AFTER:
          // Local happened after remote → take local
          return {
            merged: local,
            conflict: false,
            strategy: MergeStrategy.THREE_WAY,
            autoResolved: true,
          };

        case CausalOrder.EQUAL:
          // Same version - shouldn't happen if they're different
          return {
            merged: local,
            conflict: false,
            strategy: MergeStrategy.THREE_WAY,
            autoResolved: true,
          };

        case CausalOrder.CONCURRENT:
          // Concurrent edits - true conflict
          return this.resolveConflict(local, remote, base, defaultStrategy);
      }
    }

    // No vector clocks - fall back to conflict resolution
    return this.resolveConflict(local, remote, base, defaultStrategy);
  }

  /**
   * Handle concurrent creation (both created same todo independently)
   */
  private static mergeConcurrentCreation(
    local: TodoWithClock,
    remote: TodoWithClock,
    strategy: MergeStrategy,
  ): MergeResult {
    // If content is identical, merge metadata
    if (local.content === remote.content) {
      const merged: TodoWithClock = {
        ...local,
        // Merge metadata
        metadata: {
          ...local.metadata,
          ...remote.metadata,
        },
        // Use latest update timestamp
        updated_at: Math.max(local.updated_at, remote.updated_at),
        // Merge vector clocks if present
        vectorClock:
          local.vectorClock && remote.vectorClock
            ? VectorClockManager.merge(local.vectorClock, remote.vectorClock)
            : local.vectorClock || remote.vectorClock,
      };

      return {
        merged,
        conflict: false,
        strategy: MergeStrategy.THREE_WAY,
        autoResolved: true,
      };
    }

    // Different content - resolve conflict
    return this.resolveConflict(local, remote, null, strategy);
  }

  /**
   * Resolve conflict between local and remote versions
   */
  private static resolveConflict(
    local: TodoWithClock,
    remote: TodoWithClock,
    base: TodoWithClock | null,
    strategy: MergeStrategy,
  ): MergeResult {
    const conflictType = this.detectConflictType(local, remote, base);

    // Apply resolution strategy
    switch (strategy) {
      case MergeStrategy.TIMESTAMP:
        return this.resolveByTimestamp(local, remote, base, conflictType);

      case MergeStrategy.STATUS_PRIORITY:
        return this.resolveByStatusPriority(local, remote, base, conflictType);

      case MergeStrategy.KEEP_LOCAL:
        return {
          merged: local,
          conflict: true,
          conflictType,
          strategy: MergeStrategy.KEEP_LOCAL,
          autoResolved: true,
        };

      case MergeStrategy.KEEP_REMOTE:
        return {
          merged: remote,
          conflict: true,
          conflictType,
          strategy: MergeStrategy.KEEP_REMOTE,
          autoResolved: true,
        };

      case MergeStrategy.KEEP_BOTH:
        return this.resolveKeepBoth(local, remote, conflictType);

      case MergeStrategy.MANUAL:
        return this.requireManualResolution(local, remote, base, conflictType);

      default:
        // Default to timestamp
        return this.resolveByTimestamp(local, remote, base, conflictType);
    }
  }

  /**
   * Detect the type of conflict
   */
  private static detectConflictType(
    local: TodoWithClock,
    remote: TodoWithClock,
    base: TodoWithClock | null,
  ): ConflictType {
    // Check for content differences
    if (local.content !== remote.content) {
      return ConflictType.CONTENT_DIFF;
    }

    // Check for status differences
    if (local.status !== remote.status) {
      return ConflictType.STATUS_DIFF;
    }

    // Generic concurrent edit
    return ConflictType.CONCURRENT_EDIT;
  }

  /**
   * Resolve by timestamp (latest wins)
   */
  private static resolveByTimestamp(
    local: TodoWithClock,
    remote: TodoWithClock,
    base: TodoWithClock | null,
    conflictType: ConflictType,
  ): MergeResult {
    const merged = local.updated_at > remote.updated_at ? local : remote;

    return {
      merged,
      conflict: true,
      conflictType,
      strategy: MergeStrategy.TIMESTAMP,
      autoResolved: true,
    };
  }

  /**
   * Resolve by status priority (completed > in_progress > pending)
   */
  private static resolveByStatusPriority(
    local: TodoWithClock,
    remote: TodoWithClock,
    base: TodoWithClock | null,
    conflictType: ConflictType,
  ): MergeResult {
    const priority: Record<TodoStatus, number> = {
      completed: 3,
      in_progress: 2,
      pending: 1,
    };

    const localPriority = priority[local.status];
    const remotePriority = priority[remote.status];

    if (localPriority > remotePriority) {
      return {
        merged: local,
        conflict: true,
        conflictType,
        strategy: MergeStrategy.STATUS_PRIORITY,
        autoResolved: true,
      };
    } else if (remotePriority > localPriority) {
      return {
        merged: remote,
        conflict: true,
        conflictType,
        strategy: MergeStrategy.STATUS_PRIORITY,
        autoResolved: true,
      };
    } else {
      // Same priority - fall back to timestamp
      return this.resolveByTimestamp(local, remote, base, conflictType);
    }
  }

  /**
   * Resolve by keeping both versions as separate todos
   */
  private static resolveKeepBoth(
    local: TodoWithClock,
    remote: TodoWithClock,
    conflictType: ConflictType,
  ): MergeResult {
    // Mark both with conflict metadata
    const localWithMarker: TodoWithClock = {
      ...local,
      content: `[LOCAL] ${local.content}`,
      metadata: {
        ...local.metadata,
        conflictSource: "local",
        originalId: local.id,
      },
    };

    const remoteWithMarker: TodoWithClock = {
      ...remote,
      content: `[REMOTE] ${remote.content}`,
      metadata: {
        ...remote.metadata,
        conflictSource: "remote",
        originalId: remote.id,
      },
    };

    return {
      merged: [localWithMarker, remoteWithMarker],
      conflict: true,
      conflictType,
      strategy: MergeStrategy.KEEP_BOTH,
      autoResolved: true,
    };
  }

  /**
   * Mark as requiring manual resolution
   */
  private static requireManualResolution(
    local: TodoWithClock,
    remote: TodoWithClock,
    base: TodoWithClock | null,
    conflictType: ConflictType,
  ): MergeResult {
    // Add conflict markers to content (Git-style)
    const markedContent = `
<<<<<<< LOCAL (${local.platform})
${local.content}
Status: ${local.status}
Updated: ${new Date(local.updated_at).toISOString()}
=======
${remote.content}
Status: ${remote.status}
Updated: ${new Date(remote.updated_at).toISOString()}
>>>>>>> REMOTE (${remote.platform})
`.trim();

    const merged: TodoWithClock = {
      ...local,
      content: markedContent,
      status: "pending", // Reset to pending for manual review
      metadata: {
        ...local.metadata,
        conflictType,
        requiresResolution: true,
        localVersion: local,
        remoteVersion: remote,
        baseVersion: base,
      },
    };

    return {
      merged,
      conflict: true,
      conflictType,
      strategy: MergeStrategy.MANUAL,
      autoResolved: false,
    };
  }

  /**
   * Handle delete conflicts (one side deleted, other modified)
   */
  private static handleDeleteConflict(
    modified: TodoWithClock,
    base: TodoWithClock,
    deletedSide: "local" | "remote",
  ): MergeResult {
    // Default: Keep the modified version (delete loses)
    return {
      merged: modified,
      conflict: true,
      conflictType: ConflictType.DELETE_CONFLICT,
      strategy: MergeStrategy.THREE_WAY,
      autoResolved: true,
    };
  }

  /**
   * Compare two todos for equality (ignoring timestamps and metadata)
   */
  private static equals(todo1: TodoWithClock, todo2: TodoWithClock): boolean {
    return (
      todo1.content === todo2.content &&
      todo1.status === todo2.status &&
      todo1.active_form === todo2.active_form
    );
  }

  /**
   * Find common ancestor for two todos
   * This would typically query the commits table in a real implementation
   */
  static async findCommonAncestor(
    todo1Id: string,
    todo2Id: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    db: unknown, // D1Database
  ): Promise<TodoWithClock | null> {
    // TODO: Implement commit graph traversal
    // For Phase 2.1, we'll use simple last-sync timestamp approach
    // Full implementation in Phase 2.6 (Merge Commits)
    return null;
  }

  /**
   * Generate a conflict ID
   */
  static generateConflictId(): string {
    return `CONFLICT-${Date.now()}`;
  }
}
