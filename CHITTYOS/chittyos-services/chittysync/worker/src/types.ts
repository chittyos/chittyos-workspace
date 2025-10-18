/**
 * ChittyOS Todo Sync Hub - TypeScript Type Definitions
 * Version: 1.0.0
 */

// Environment bindings for Cloudflare Workers
export interface Env {
  DB: D1Database;
  SERVICE_NAME: string;
  SERVICE_VERSION: string;
  CHITTYOS_ENVIRONMENT: string;
  CHITTYID_SERVICE_URL: string;
  GATEWAY_SERVICE_URL: string;
  CHITTY_ID_TOKEN?: string; // For server-side ChittyID minting
}

// Todo status types
export type TodoStatus = "pending" | "in_progress" | "completed";

// Platform types
export type TodoPlatform = "claude-code" | "chatgpt" | "desktop" | "custom";

// Sync action types
export type SyncAction = "create" | "update" | "delete" | "sync";

// Todo object structure
export interface Todo {
  id: string; // ChittyID
  content: string;
  status: TodoStatus;
  active_form?: string;
  platform: TodoPlatform;
  session_id?: string;
  agent_id?: string;
  created_at: number; // Unix timestamp
  updated_at: number; // Unix timestamp
  deleted_at?: number; // Unix timestamp (soft delete)
  metadata?: Record<string, unknown>;
}

// Create todo request
export interface CreateTodoRequest {
  content: string;
  status: TodoStatus;
  active_form?: string;
  platform?: TodoPlatform;
  session_id?: string;
  agent_id?: string;
  metadata?: Record<string, unknown>;
}

// Update todo request
export interface UpdateTodoRequest {
  content?: string;
  status?: TodoStatus;
  active_form?: string;
  metadata?: Record<string, unknown>;
}

// Sync log entry
export interface SyncLogEntry {
  id: string;
  todo_id: string;
  action: SyncAction;
  platform: TodoPlatform;
  timestamp: number;
  conflict_detected: boolean;
  conflict_resolution?: string;
  metadata?: Record<string, unknown>;
}

// Bulk sync request
export interface BulkSyncRequest {
  todos: CreateTodoRequest[];
  platform?: TodoPlatform;
}

// Bulk sync response
export interface BulkSyncResponse {
  synced: number;
  conflicts: number;
  errors: string[];
  todos: Todo[];
}

// API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

// Health check response
export interface HealthCheckResponse {
  status: "healthy" | "degraded" | "unhealthy";
  service: string;
  version: string;
  environment: string;
  timestamp: number;
  database: {
    connected: boolean;
    latency_ms?: number;
  };
  chittyid: {
    reachable: boolean;
    latency_ms?: number;
  };
}

// ChittyID mint request
export interface ChittyIdMintRequest {
  domain: string;
  subtype: string;
  metadata?: Record<string, unknown>;
}

// ChittyID mint response
export interface ChittyIdMintResponse {
  id: string;
  domain: string;
  subtype: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// Database query result types
export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: {
    duration: number;
    rows_read: number;
    rows_written: number;
  };
}

// Error response
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

// ============================================================================
// Phase 2.1: Merge Support Types
// ============================================================================

// Branch metadata for Git-like branching
export interface Branch {
  id: string;
  name: string;
  platform: TodoPlatform;
  session_id?: string;
  head_commit_id?: string;
  created_at: number;
  updated_at: number;
  metadata?: Record<string, unknown>;
}

// Commit record for event sourcing
export interface Commit {
  id: string; // ChittyID
  branch_id: string;
  parent_commit_id?: string;
  merge_parent_commit_id?: string;
  todo_snapshot: string; // JSON snapshot
  message?: string;
  author: string;
  timestamp: number;
  vector_clock?: string; // Serialized vector clock
  metadata?: Record<string, unknown>;
}

// Conflict types
export type ConflictType =
  | "content_diff"
  | "status_diff"
  | "delete_conflict"
  | "concurrent_edit";

// Merge strategies
export type MergeStrategyType =
  | "three_way"
  | "timestamp"
  | "status_priority"
  | "keep_local"
  | "keep_remote"
  | "keep_both"
  | "manual";

// Conflict record
export interface Conflict {
  id: string;
  todo_id: string;
  base_version?: string; // JSON
  local_version: string; // JSON
  remote_version: string; // JSON
  conflict_type: ConflictType;
  detected_at: number;
  resolved_at?: number;
  resolution_strategy?: MergeStrategyType;
  resolved_by?: string;
  metadata?: Record<string, unknown>;
}

// Vector clock entry
export interface VectorClockEntry {
  todo_id: string;
  platform: string;
  clock_value: number;
  updated_at: number;
}

// Merge request
export interface MergeRequest {
  branch_id: string;
  target_branch_id: string;
  strategy?: MergeStrategyType;
}

// Merge response
export interface MergeResponse {
  merge_commit_id?: string;
  conflicts: Conflict[];
  merged_todos: Todo[];
  auto_resolved: number;
  manual_required: number;
}

// Conflict resolution request
export interface ConflictResolutionRequest {
  strategy: MergeStrategyType;
  resolution?: Partial<Todo>; // For manual resolution
  resolved_by: string;
}

// Branch creation request
export interface CreateBranchRequest {
  name: string;
  platform: TodoPlatform;
  session_id?: string;
}

// Commit creation request
export interface CreateCommitRequest {
  branch_id: string;
  todo_snapshot: Todo;
  message?: string;
  author: string;
  vector_clock?: Record<string, number>;
}

// ============================================================================
// Tier 1: Session Sync Types
// ============================================================================

export type SessionStatus = "active" | "inactive" | "archived";

// Session metadata for tracking multiple sessions in same project
export interface Session {
  id: string; // ChittyID
  session_id: string; // Git worktree branch name (e.g., "session-abc123")
  project_id: string; // Project directory identifier
  project_path: string; // Full path to project directory
  git_branch?: string; // Git branch name
  git_commit?: string; // Latest commit hash
  platform: TodoPlatform;
  agent_id?: string;
  status: SessionStatus;
  started_at: number;
  last_active_at: number;
  ended_at?: number;
  metadata?: Record<string, unknown>;
}

// Session registration request
export interface RegisterSessionRequest {
  session_id: string;
  project_id: string;
  project_path: string;
  git_branch?: string;
  git_commit?: string;
  platform?: TodoPlatform;
  agent_id?: string;
  metadata?: Record<string, unknown>;
}

// Session sync request (sync todos between sessions in same project)
export interface SessionSyncRequest {
  session_id: string;
  project_id: string;
  todos?: Todo[]; // Optional todos to sync
  strategy?: MergeStrategyType;
}

// Session sync response
export interface SessionSyncResponse {
  sessions_synced: number;
  todos_merged: number;
  conflicts: number;
  project_state: "synchronized" | "conflicts";
  canonical_state: Todo[];
  conflicts_detected?: Conflict[];
}

// Project entity (persistent project with canonical state)
export interface Project {
  id: string; // Project identifier (e.g., "chittyrouter")
  project_path: string; // Full path to project directory
  git_root?: string; // Git repository root path
  git_branch?: string; // Default branch (e.g., "main")
  git_remote?: string; // Remote URL
  canonical_state?: string; // JSON array of merged todos
  last_consolidated?: number; // Last consolidation timestamp
  created_at: number;
  updated_at: number;
  metadata?: Record<string, unknown>;
}

// Project state (canonical merged state across all sessions)
export interface ProjectState {
  project_id: string;
  canonical_todos: Todo[];
  contributing_sessions: {
    session_id: string;
    todos_count: number;
    last_contribution: number;
  }[];
  last_consolidated: number;
  metadata?: Record<string, unknown>;
}

// Project consolidation request
export interface ProjectConsolidationRequest {
  project_id: string;
  force?: boolean; // Force consolidation even if recently consolidated
}

// Project consolidation response
export interface ProjectConsolidationResponse {
  project_id: string;
  todos_count: number;
  sessions_synced: number;
  conflicts_resolved: number;
  canonical_state: Todo[];
  timestamp: number;
}

// ============================================================================
// Claude Code Directions Integration Types
// ============================================================================

export type DirectionStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "failed";

export type DirectionType = "instruction" | "task" | "message";

export interface Direction {
  id: string; // ChittyID for the direction
  agent_id: string;
  session_id?: string;
  source: TodoPlatform | "custom";
  content: string;
  type: DirectionType;
  status: DirectionStatus;
  priority?: number;
  result?: string;
  error?: string;
  created_at: number;
  updated_at: number;
  claimed_at?: number;
  completed_at?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateDirectionRequest {
  agent_id: string;
  session_id?: string;
  content: string;
  type?: DirectionType;
  priority?: number;
  source?: TodoPlatform | "custom";
  metadata?: Record<string, unknown>;
}

export interface ClaimDirectionRequest {
  agent_id: string;
  session_id?: string;
  peek?: boolean;
}

export interface CompleteDirectionRequest {
  result?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}
