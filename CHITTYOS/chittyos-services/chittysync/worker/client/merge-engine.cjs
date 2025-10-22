/**
 * ChittyOS Todo Sync - Client-Side Merge Engine
 * Version: 2.0.0
 *
 * Standalone JavaScript merge engine that can run in any environment:
 * - Claude Code (Node.js)
 * - ChatGPT (Browser/Custom Actions)
 * - Claude Desktop (Electron)
 *
 * Implements the same three-way merge algorithm as the server.
 */

/**
 * Vector Clock Manager (Client-Side)
 */
class VectorClockManager {
  static init(platform) {
    return { [platform]: 0 };
  }

  static increment(clock, platform) {
    return {
      ...clock,
      [platform]: (clock[platform] || 0) + 1,
    };
  }

  static merge(clock1, clock2) {
    const platforms = new Set([...Object.keys(clock1), ...Object.keys(clock2)]);
    const merged = {};
    for (const platform of platforms) {
      merged[platform] = Math.max(clock1[platform] || 0, clock2[platform] || 0);
    }
    return merged;
  }

  static compare(clock1, clock2) {
    const platforms = new Set([...Object.keys(clock1), ...Object.keys(clock2)]);
    let hasLess = false;
    let hasGreater = false;

    for (const platform of platforms) {
      const v1 = clock1[platform] || 0;
      const v2 = clock2[platform] || 0;
      if (v1 < v2) hasLess = true;
      if (v1 > v2) hasGreater = true;
    }

    if (!hasLess && !hasGreater) return "EQUAL";
    if (hasLess && !hasGreater) return "BEFORE";
    if (hasGreater && !hasLess) return "AFTER";
    return "CONCURRENT";
  }
}

/**
 * Client-Side Three-Way Merge Engine
 */
class ClientMergeEngine {
  /**
   * Perform three-way merge
   * @param {object|null} local - Local todo version
   * @param {object|null} remote - Remote todo version
   * @param {object|null} base - Common ancestor version
   * @param {string} strategy - Resolution strategy (default: 'timestamp')
   * @returns {object} Merge result
   */
  static threeWayMerge(local, remote, base, strategy = "timestamp") {
    // Case 1: Both deleted or never existed
    if (!local && !remote) {
      return { merged: null, conflict: false, strategy: "three_way" };
    }

    // Case 2: Only in local
    if (local && !remote) {
      if (base) {
        // Remote deleted, local modified - conflict
        return this.handleDeleteConflict(local, base, "local_modified");
      }
      return { merged: local, conflict: false, strategy: "three_way" };
    }

    // Case 3: Only in remote
    if (remote && !local) {
      if (base) {
        // Local deleted, remote modified - conflict
        return this.handleDeleteConflict(remote, base, "remote_modified");
      }
      return { merged: remote, conflict: false, strategy: "three_way" };
    }

    // Case 4: Both exist
    return this.mergeBothExist(local, remote, base, strategy);
  }

  static mergeBothExist(local, remote, base, strategy) {
    // No base - concurrent creation
    if (!base) {
      if (local.content === remote.content) {
        return {
          merged: {
            ...local,
            updated_at: Math.max(local.updated_at, remote.updated_at),
            metadata: { ...local.metadata, ...remote.metadata },
          },
          conflict: false,
          strategy: "three_way",
        };
      }
      return this.resolveConflict(local, remote, null, strategy);
    }

    const localUnchanged = this.equals(local, base);
    const remoteUnchanged = this.equals(remote, base);

    // Neither changed
    if (localUnchanged && remoteUnchanged) {
      return { merged: local, conflict: false, strategy: "three_way" };
    }

    // Only local changed
    if (!localUnchanged && remoteUnchanged) {
      return { merged: local, conflict: false, strategy: "three_way" };
    }

    // Only remote changed
    if (localUnchanged && !remoteUnchanged) {
      return { merged: remote, conflict: false, strategy: "three_way" };
    }

    // Both changed identically
    if (this.equals(local, remote)) {
      return { merged: local, conflict: false, strategy: "three_way" };
    }

    // Both changed differently - use vector clocks
    if (local.vectorClock && remote.vectorClock) {
      const order = VectorClockManager.compare(
        local.vectorClock,
        remote.vectorClock,
      );

      switch (order) {
        case "BEFORE":
          return { merged: remote, conflict: false, strategy: "three_way" };
        case "AFTER":
          return { merged: local, conflict: false, strategy: "three_way" };
        case "EQUAL":
          return { merged: local, conflict: false, strategy: "three_way" };
        case "CONCURRENT":
          return this.resolveConflict(local, remote, base, strategy);
      }
    }

    // No vector clocks - resolve conflict
    return this.resolveConflict(local, remote, base, strategy);
  }

  static resolveConflict(local, remote, base, strategy) {
    const conflictType = this.detectConflictType(local, remote);

    switch (strategy) {
      case "timestamp":
        return this.resolveByTimestamp(local, remote, conflictType);
      case "status_priority":
        return this.resolveByStatusPriority(local, remote, conflictType);
      case "keep_local":
        return {
          merged: local,
          conflict: true,
          conflictType,
          strategy: "keep_local",
        };
      case "keep_remote":
        return {
          merged: remote,
          conflict: true,
          conflictType,
          strategy: "keep_remote",
        };
      case "keep_both":
        return this.resolveKeepBoth(local, remote, conflictType);
      case "manual":
        return this.requireManualResolution(local, remote, base, conflictType);
      default:
        return this.resolveByTimestamp(local, remote, conflictType);
    }
  }

  static detectConflictType(local, remote) {
    if (local.content !== remote.content) return "content_diff";
    if (local.status !== remote.status) return "status_diff";
    return "concurrent_edit";
  }

  static resolveByTimestamp(local, remote, conflictType) {
    const merged = local.updated_at > remote.updated_at ? local : remote;
    return { merged, conflict: true, conflictType, strategy: "timestamp" };
  }

  static resolveByStatusPriority(local, remote, conflictType) {
    const priority = { completed: 3, in_progress: 2, pending: 1 };
    const localPriority = priority[local.status];
    const remotePriority = priority[remote.status];

    if (localPriority > remotePriority) {
      return {
        merged: local,
        conflict: true,
        conflictType,
        strategy: "status_priority",
      };
    } else if (remotePriority > localPriority) {
      return {
        merged: remote,
        conflict: true,
        conflictType,
        strategy: "status_priority",
      };
    } else {
      return this.resolveByTimestamp(local, remote, conflictType);
    }
  }

  static resolveKeepBoth(local, remote, conflictType) {
    return {
      merged: [
        { ...local, content: `[LOCAL] ${local.content}` },
        { ...remote, content: `[REMOTE] ${remote.content}` },
      ],
      conflict: true,
      conflictType,
      strategy: "keep_both",
    };
  }

  static requireManualResolution(local, remote, base, conflictType) {
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

    return {
      merged: {
        ...local,
        content: markedContent,
        status: "pending",
        metadata: {
          ...local.metadata,
          conflictType,
          requiresResolution: true,
        },
      },
      conflict: true,
      conflictType,
      strategy: "manual",
    };
  }

  static handleDeleteConflict(modified, base, deletedSide) {
    return {
      merged: modified,
      conflict: true,
      conflictType: "delete_conflict",
      strategy: "three_way",
    };
  }

  static equals(todo1, todo2) {
    return (
      todo1.content === todo2.content &&
      todo1.status === todo2.status &&
      todo1.active_form === todo2.active_form
    );
  }
}

/**
 * Export for Node.js environments
 */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { ClientMergeEngine, VectorClockManager };
}

/**
 * Export for browser environments
 */
if (typeof window !== "undefined") {
  window.ClientMergeEngine = ClientMergeEngine;
  window.VectorClockManager = VectorClockManager;
}
