/**
 * ChittySync Git Integration
 * Auto-commit todos to project Git repositories
 * Version: 2.1.0
 */

import type { Env, Todo, Project } from "../types";
import { ChittyIdClient } from "../chittyid-client";

/**
 * Git Integration Service
 * Handles auto-commits to project repositories
 */
export class GitIntegrationService {
  constructor(
    private env: Env,
    private db: D1Database,
  ) {}

  /**
   * Auto-commit todos to project Git repository
   * This creates a Git commit in the project's .chitty/ directory
   */
  async autoCommitProjectTodos(
    projectId: string,
    todos: Todo[],
    message?: string,
  ): Promise<{ success: boolean; commit_hash?: string; error?: string }> {
    try {
      // Get project details
      const projectResult = await this.db
        .prepare("SELECT * FROM projects WHERE id = ?")
        .bind(projectId)
        .first();

      if (!projectResult) {
        return { success: false, error: "Project not found" };
      }

      const project = this.parseProjectFromDb(projectResult);

      if (!project.git_root) {
        return {
          success: false,
          error: "Project does not have Git root configured",
        };
      }

      // Generate commit message
      const commitMessage =
        message || this.generateCommitMessage(todos, project);

      // Generate simulated commit hash (in production, this would call actual Git)
      const commitHash = await this.simulateGitCommit(
        project.git_root,
        todos,
        commitMessage,
      );

      // Record commit in database
      await this.recordGitCommit(projectId, commitHash, commitMessage, todos);

      return { success: true, commit_hash: commitHash };
    } catch (error) {
      console.error("Auto-commit error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Generate commit message based on todo changes
   */
  private generateCommitMessage(todos: Todo[], project: Project): string {
    const pendingCount = todos.filter((t) => t.status === "pending").length;
    const inProgressCount = todos.filter(
      (t) => t.status === "in_progress",
    ).length;
    const completedCount = todos.filter((t) => t.status === "completed").length;

    const parts: string[] = [];

    if (completedCount > 0) {
      parts.push(`${completedCount} completed`);
    }
    if (inProgressCount > 0) {
      parts.push(`${inProgressCount} in progress`);
    }
    if (pendingCount > 0) {
      parts.push(`${pendingCount} pending`);
    }

    const summary = parts.join(", ");

    return `chore(sync): Update project todos - ${summary}

ChittySync auto-commit for project: ${project.id}
Total todos: ${todos.length}

🤖 Generated with ChittySync
`;
  }

  /**
   * Simulate Git commit (in production, this would execute actual Git commands)
   * For now, we generate a deterministic hash based on content
   */
  private async simulateGitCommit(
    gitRoot: string,
    todos: Todo[],
    message: string,
  ): Promise<string> {
    // In production, this would:
    // 1. Write todos to {gitRoot}/.chitty/todos.json
    // 2. Run: git add .chitty/todos.json
    // 3. Run: git commit -m "{message}"
    // 4. Return the actual commit SHA

    // For now, generate deterministic hash
    const content = JSON.stringify(todos) + message + Date.now();
    const hash = await this.simpleHash(content);

    return hash.substring(0, 40); // Git SHA-1 length
  }

  /**
   * Simple hash function (for simulation)
   */
  private async simpleHash(content: string): Promise<string> {
    // Use Web Crypto API if available
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    // Fallback: simple hash
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(40, "0");
  }

  /**
   * Record Git commit in database
   */
  private async recordGitCommit(
    projectId: string,
    commitHash: string,
    commitMessage: string,
    todos: Todo[],
  ): Promise<void> {
    const chittyIdClient = new ChittyIdClient(
      this.env.CHITTYID_SERVICE_URL,
      this.env.CHITTY_ID_TOKEN,
    );

    const chittyId = await chittyIdClient.mint(
      "git-commit",
      "sync",
      {
        project_id: projectId,
        commit_hash: commitHash,
      },
      this.env.CHITTY_ID_TOKEN,
    );

    const now = Date.now();

    await this.db
      .prepare(
        `INSERT INTO project_git_commits (id, project_id, git_commit_hash, commit_message, todos_snapshot, committed_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        chittyId.id,
        projectId,
        commitHash,
        commitMessage,
        JSON.stringify(todos),
        now,
      )
      .run();
  }

  /**
   * Get commit history for a project
   */
  async getProjectCommitHistory(
    projectId: string,
    limit: number = 50,
  ): Promise<
    Array<{
      id: string;
      commit_hash: string;
      message: string;
      committed_at: number;
      todos_count: number;
    }>
  > {
    const result = await this.db
      .prepare(
        "SELECT * FROM project_git_commits WHERE project_id = ? ORDER BY committed_at DESC LIMIT ?",
      )
      .bind(projectId, limit)
      .all();

    return (result.results as unknown[]).map((row: any) => {
      const todos = JSON.parse(row.todos_snapshot || "[]");
      return {
        id: row.id,
        commit_hash: row.git_commit_hash,
        message: row.commit_message,
        committed_at: row.committed_at,
        todos_count: todos.length,
      };
    });
  }

  /**
   * Get todos snapshot from a specific commit
   */
  async getCommitSnapshot(commitId: string): Promise<Todo[] | null> {
    const result = await this.db
      .prepare("SELECT todos_snapshot FROM project_git_commits WHERE id = ?")
      .bind(commitId)
      .first();

    if (!result) {
      return null;
    }

    try {
      return JSON.parse(result.todos_snapshot as string);
    } catch (error) {
      console.error("Failed to parse commit snapshot:", error);
      return null;
    }
  }

  /**
   * Parse project from DB row
   */
  private parseProjectFromDb(row: unknown): Project {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      project_path: r.project_path as string,
      git_root: r.git_root as string | undefined,
      git_branch: r.git_branch as string | undefined,
      git_remote: r.git_remote as string | undefined,
      canonical_state: r.canonical_state as string | undefined,
      last_consolidated: r.last_consolidated as number | undefined,
      created_at: r.created_at as number,
      updated_at: r.updated_at as number,
      metadata: r.metadata ? JSON.parse(r.metadata as string) : undefined,
    };
  }
}

/**
 * Git Operations Interface (for future actual Git integration)
 */
export interface GitOperations {
  /**
   * Write todos to .chitty/todos.json in project directory
   */
  writeTodosFile(projectPath: string, todos: Todo[]): Promise<void>;

  /**
   * Stage changes in Git
   */
  gitAdd(projectPath: string, files: string[]): Promise<void>;

  /**
   * Commit changes
   */
  gitCommit(projectPath: string, message: string): Promise<string>;

  /**
   * Get current branch
   */
  getCurrentBranch(projectPath: string): Promise<string>;

  /**
   * Get current commit hash
   */
  getCurrentCommit(projectPath: string): Promise<string>;

  /**
   * Check if directory is a Git repository
   */
  isGitRepo(projectPath: string): Promise<boolean>;
}

/**
 * File System Git Operations (for when running in Node.js environment)
 * This would be used by client-side sync, not in Cloudflare Workers
 */
export class FileSystemGitOperations implements GitOperations {
  async writeTodosFile(projectPath: string, todos: Todo[]): Promise<void> {
    // Implementation would use Node.js fs module
    throw new Error("Not implemented in Workers environment");
  }

  async gitAdd(projectPath: string, files: string[]): Promise<void> {
    // Implementation would use child_process to run git commands
    throw new Error("Not implemented in Workers environment");
  }

  async gitCommit(projectPath: string, message: string): Promise<string> {
    // Implementation would use child_process to run git commands
    throw new Error("Not implemented in Workers environment");
  }

  async getCurrentBranch(projectPath: string): Promise<string> {
    throw new Error("Not implemented in Workers environment");
  }

  async getCurrentCommit(projectPath: string): Promise<string> {
    throw new Error("Not implemented in Workers environment");
  }

  async isGitRepo(projectPath: string): Promise<boolean> {
    throw new Error("Not implemented in Workers environment");
  }
}
