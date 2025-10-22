/**
 * ChittySync File Watcher Interface
 * For monitoring .chitty/ directories for changes
 * Version: 2.1.0
 *
 * NOTE: Cloudflare Workers cannot watch files directly.
 * This interface is for client-side implementations (Node.js, CLI tools, etc.)
 */

import type { Todo } from "../types";

/**
 * File watcher events
 */
export type FileWatchEvent = "created" | "modified" | "deleted";

/**
 * File watch callback
 */
export type FileWatchCallback = (
  event: FileWatchEvent,
  filePath: string,
  todos?: Todo[],
) => void | Promise<void>;

/**
 * File Watcher Interface
 * Implement this in client-side environments (Node.js, etc.)
 */
export interface FileWatcher {
  /**
   * Watch a directory for changes to .chitty/todos.json
   */
  watch(projectPath: string, callback: FileWatchCallback): Promise<void>;

  /**
   * Stop watching a directory
   */
  unwatch(projectPath: string): Promise<void>;

  /**
   * Stop all watches
   */
  stopAll(): Promise<void>;
}

/**
 * Node.js File Watcher Implementation (for reference)
 * This would be used in client-side sync tools
 */
export class NodeFileWatcher implements FileWatcher {
  private watchers: Map<string, any> = new Map();

  async watch(
    projectPath: string,
    callback: FileWatchCallback,
  ): Promise<void> {
    // In a real Node.js implementation, this would use fs.watch or chokidar
    throw new Error(
      "NodeFileWatcher not available in Workers environment. Use in Node.js client.",
    );
  }

  async unwatch(projectPath: string): Promise<void> {
    const watcher = this.watchers.get(projectPath);
    if (watcher) {
      // watcher.close();
      this.watchers.delete(projectPath);
    }
  }

  async stopAll(): Promise<void> {
    for (const [path, watcher] of this.watchers.entries()) {
      // watcher.close();
    }
    this.watchers.clear();
  }
}

/**
 * Polling File Watcher (fallback for environments without fs.watch)
 * Checks files periodically instead of using OS-level events
 */
export class PollingFileWatcher implements FileWatcher {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private lastModified: Map<string, number> = new Map();
  private pollInterval: number = 1000; // 1 second

  constructor(pollInterval: number = 1000) {
    this.pollInterval = pollInterval;
  }

  async watch(
    projectPath: string,
    callback: FileWatchCallback,
  ): Promise<void> {
    // Stop existing watcher if any
    await this.unwatch(projectPath);

    // Start polling
    const interval = setInterval(async () => {
      await this.checkForChanges(projectPath, callback);
    }, this.pollInterval);

    this.intervals.set(projectPath, interval);
  }

  async unwatch(projectPath: string): Promise<void> {
    const interval = this.intervals.get(projectPath);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(projectPath);
      this.lastModified.delete(projectPath);
    }
  }

  async stopAll(): Promise<void> {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
    this.lastModified.clear();
  }

  private async checkForChanges(
    projectPath: string,
    callback: FileWatchCallback,
  ): Promise<void> {
    // In a real implementation, this would:
    // 1. Check if {projectPath}/.chitty/todos.json exists
    // 2. Get its modification time
    // 3. Compare with lastModified
    // 4. If changed, read file and call callback
    throw new Error(
      "PollingFileWatcher not available in Workers environment. Use in Node.js client.",
    );
  }
}

/**
 * HTTP Polling Watcher (for browser/Workers environments)
 * Polls the ChittySync Hub API for changes instead of watching files
 */
export class HttpPollingWatcher {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private lastSync: Map<string, number> = new Map();
  private pollInterval: number = 5000; // 5 seconds
  private hubUrl: string;
  private authToken: string;

  constructor(hubUrl: string, authToken: string, pollInterval: number = 5000) {
    this.hubUrl = hubUrl;
    this.authToken = authToken;
    this.pollInterval = pollInterval;
  }

  /**
   * Watch a project by polling the hub API
   */
  async watch(
    projectId: string,
    callback: (todos: Todo[]) => void | Promise<void>,
  ): Promise<void> {
    // Stop existing watcher if any
    await this.unwatch(projectId);

    // Start polling
    const interval = setInterval(async () => {
      await this.pollProject(projectId, callback);
    }, this.pollInterval);

    this.intervals.set(projectId, interval);
  }

  async unwatch(projectId: string): Promise<void> {
    const interval = this.intervals.get(projectId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(projectId);
      this.lastSync.delete(projectId);
    }
  }

  async stopAll(): Promise<void> {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
    this.lastSync.clear();
  }

  private async pollProject(
    projectId: string,
    callback: (todos: Todo[]) => void | Promise<void>,
  ): Promise<void> {
    try {
      const lastSync = this.lastSync.get(projectId) || 0;

      // Fetch canonical state
      const response = await fetch(
        `${this.hubUrl}/api/projects/${projectId}/canonical-state`,
        {
          headers: {
            Authorization: `Bearer ${this.authToken}`,
          },
        },
      );

      if (!response.ok) {
        console.error(`Failed to poll project ${projectId}:`, response.status);
        return;
      }

      const data = await response.json();
      const todos = data.data?.canonical_todos || [];

      // Check if anything changed
      const currentHash = this.hashTodos(todos);
      const lastHash = this.lastSync.get(`${projectId}_hash`);

      if (currentHash !== lastHash) {
        this.lastSync.set(`${projectId}_hash`, currentHash);
        this.lastSync.set(projectId, Date.now());
        await callback(todos);
      }
    } catch (error) {
      console.error(`Error polling project ${projectId}:`, error);
    }
  }

  private hashTodos(todos: Todo[]): string {
    // Simple hash based on content + status
    return todos
      .map((t) => `${t.id}:${t.status}:${t.updated_at}`)
      .join("|");
  }
}

/**
 * Example usage in Node.js client:
 *
 * ```typescript
 * const watcher = new HttpPollingWatcher(
 *   'https://gateway.chitty.cc',
 *   'your-auth-token',
 *   5000 // poll every 5 seconds
 * );
 *
 * await watcher.watch('chittyrouter', async (todos) => {
 *   console.log('Project todos updated:', todos.length);
 *   // Sync to local .chitty/todos.json
 *   await fs.writeFile(
 *     '.chitty/todos.json',
 *     JSON.stringify(todos, null, 2)
 *   );
 * });
 * ```
 */
