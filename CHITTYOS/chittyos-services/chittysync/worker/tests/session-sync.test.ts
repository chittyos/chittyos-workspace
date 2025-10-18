/**
 * ChittySync Session Sync Tests
 * Version: 2.2.0
 *
 * Tests for Tier 1 Session Sync functionality
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type {
  Session,
  RegisterSessionRequest,
  SessionSyncRequest,
  SessionSyncResponse,
  Todo,
  ProjectState,
} from "../src/types";

// Test configuration
const TEST_BASE_URL = process.env.TEST_BASE_URL || "http://localhost:8787";
const TEST_TOKEN = process.env.CHITTY_ID_TOKEN || "test-token";

// Helper function to make API requests
async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${TEST_BASE_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TEST_TOKEN}`,
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Request failed: ${response.status} ${response.statusText}\n${text}`,
    );
  }

  return response.json();
}

describe("Session Sync (Tier 1)", () => {
  const testProjectId = `test-project-${Date.now()}`;
  const testSessionIds: string[] = [];

  // Cleanup after tests
  afterEach(async () => {
    // End all test sessions
    for (const sessionId of testSessionIds) {
      try {
        await request(`/api/sessions/${sessionId}/end`, {
          method: "POST",
        });
      } catch (error) {
        console.warn(`Failed to cleanup session ${sessionId}:`, error);
      }
    }
    testSessionIds.length = 0;
  });

  describe("Session Registration", () => {
    it("should register a new session", async () => {
      const sessionId = `session-test-${Date.now()}`;
      testSessionIds.push(sessionId);

      const registerRequest: RegisterSessionRequest = {
        session_id: sessionId,
        project_id: testProjectId,
        project_path: "/test/path/project",
        git_branch: "main",
        platform: "claude-code",
      };

      const response = await request<{ success: boolean; data: Session }>(
        "/api/sessions/register",
        {
          method: "POST",
          body: JSON.stringify(registerRequest),
        },
      );

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.session_id).toBe(sessionId);
      expect(response.data.project_id).toBe(testProjectId);
      expect(response.data.status).toBe("active");
      expect(response.data.id).toMatch(/^CHITTY-/);
    });

    it("should update existing session on re-register", async () => {
      const sessionId = `session-test-${Date.now()}`;
      testSessionIds.push(sessionId);

      const registerRequest: RegisterSessionRequest = {
        session_id: sessionId,
        project_id: testProjectId,
        project_path: "/test/path/project",
        git_branch: "main",
        platform: "claude-code",
      };

      // Register first time
      const response1 = await request<{ success: boolean; data: Session }>(
        "/api/sessions/register",
        {
          method: "POST",
          body: JSON.stringify(registerRequest),
        },
      );

      const chittyId = response1.data.id;

      // Register again with different git_commit
      const response2 = await request<{ success: boolean; data: Session }>(
        "/api/sessions/register",
        {
          method: "POST",
          body: JSON.stringify({
            ...registerRequest,
            git_commit: "abc123",
          }),
        },
      );

      expect(response2.success).toBe(true);
      expect(response2.data.id).toBe(chittyId); // Same ChittyID
      expect(response2.data.git_commit).toBe("abc123");
      expect(response2.data.status).toBe("active");
    });

    it("should get session by ID", async () => {
      const sessionId = `session-test-${Date.now()}`;
      testSessionIds.push(sessionId);

      await request("/api/sessions/register", {
        method: "POST",
        body: JSON.stringify({
          session_id: sessionId,
          project_id: testProjectId,
          project_path: "/test/path",
          platform: "claude-code",
        }),
      });

      const response = await request<{ success: boolean; data: Session }>(
        `/api/sessions/${sessionId}`,
      );

      expect(response.success).toBe(true);
      expect(response.data.session_id).toBe(sessionId);
    });

    it("should end a session", async () => {
      const sessionId = `session-test-${Date.now()}`;
      testSessionIds.push(sessionId);

      await request("/api/sessions/register", {
        method: "POST",
        body: JSON.stringify({
          session_id: sessionId,
          project_id: testProjectId,
          project_path: "/test/path",
          platform: "claude-code",
        }),
      });

      const endResponse = await request<{ success: boolean }>(
        `/api/sessions/${sessionId}/end`,
        { method: "POST" },
      );

      expect(endResponse.success).toBe(true);

      // Verify session is inactive
      const getResponse = await request<{ success: boolean; data: Session }>(
        `/api/sessions/${sessionId}`,
      );

      expect(getResponse.data.status).toBe("inactive");
      expect(getResponse.data.ended_at).toBeDefined();
    });
  });

  describe("Multi-Session Sync", () => {
    it("should sync todos between two sessions in same project", async () => {
      const session1Id = `session-1-${Date.now()}`;
      const session2Id = `session-2-${Date.now()}`;
      testSessionIds.push(session1Id, session2Id);

      // Register both sessions
      await request("/api/sessions/register", {
        method: "POST",
        body: JSON.stringify({
          session_id: session1Id,
          project_id: testProjectId,
          project_path: "/test/path",
          platform: "claude-code",
        }),
      });

      await request("/api/sessions/register", {
        method: "POST",
        body: JSON.stringify({
          session_id: session2Id,
          project_id: testProjectId,
          project_path: "/test/path",
          platform: "claude-code",
        }),
      });

      // Create a todo in session 1
      const todoResponse = await request<{ success: boolean; data: Todo }>(
        "/api/todos",
        {
          method: "POST",
          body: JSON.stringify({
            content: "Test todo from session 1",
            status: "pending",
            platform: "claude-code",
            session_id: session1Id,
          }),
        },
      );

      const todo = todoResponse.data;

      // Sync session 1
      const sync1Response = await request<{
        success: boolean;
        data: SessionSyncResponse;
      }>(`/api/sessions/${session1Id}/sync`, {
        method: "POST",
        body: JSON.stringify({
          project_id: testProjectId,
          todos: [todo],
        }),
      });

      expect(sync1Response.success).toBe(true);
      expect(sync1Response.data.sessions_synced).toBe(2); // Both sessions
      expect(sync1Response.data.project_state).toBe("synchronized");
      expect(sync1Response.data.canonical_state.length).toBeGreaterThan(0);

      // Verify session 2 can see the todo
      const sync2Response = await request<{
        success: boolean;
        data: SessionSyncResponse;
      }>(`/api/sessions/${session2Id}/sync`, {
        method: "POST",
        body: JSON.stringify({
          project_id: testProjectId,
        }),
      });

      expect(sync2Response.success).toBe(true);
      expect(sync2Response.data.canonical_state).toContainEqual(
        expect.objectContaining({
          id: todo.id,
          content: todo.content,
        }),
      );
    });

    it("should merge concurrent edits from multiple sessions", async () => {
      const session1Id = `session-1-${Date.now()}`;
      const session2Id = `session-2-${Date.now()}`;
      testSessionIds.push(session1Id, session2Id);

      // Register both sessions
      await Promise.all([
        request("/api/sessions/register", {
          method: "POST",
          body: JSON.stringify({
            session_id: session1Id,
            project_id: testProjectId,
            project_path: "/test/path",
            platform: "claude-code",
          }),
        }),
        request("/api/sessions/register", {
          method: "POST",
          body: JSON.stringify({
            session_id: session2Id,
            project_id: testProjectId,
            project_path: "/test/path",
            platform: "claude-code",
          }),
        }),
      ]);

      // Create same todo in both sessions (concurrent creation)
      const todo1 = await request<{ success: boolean; data: Todo }>(
        "/api/todos",
        {
          method: "POST",
          body: JSON.stringify({
            content: "Shared todo",
            status: "pending",
            platform: "claude-code",
            session_id: session1Id,
          }),
        },
      );

      const todo2 = await request<{ success: boolean; data: Todo }>(
        "/api/todos",
        {
          method: "POST",
          body: JSON.stringify({
            content: "Shared todo",
            status: "in_progress",
            platform: "claude-code",
            session_id: session2Id,
          }),
        },
      );

      // Sync both sessions
      const syncResponse = await request<{
        success: boolean;
        data: SessionSyncResponse;
      }>(`/api/sessions/${session1Id}/sync`, {
        method: "POST",
        body: JSON.stringify({
          project_id: testProjectId,
          todos: [todo1.data, todo2.data],
          strategy: "status_priority", // in_progress should win over pending
        }),
      });

      expect(syncResponse.success).toBe(true);
      expect(syncResponse.data.project_state).toMatch(
        /synchronized|conflicts/,
      );

      // Canonical state should have the merged result
      const canonicalResponse = await request<{
        success: boolean;
        data: ProjectState;
      }>(`/api/projects/${testProjectId}/canonical`);

      expect(canonicalResponse.success).toBe(true);
      expect(canonicalResponse.data.canonical_todos.length).toBeGreaterThan(0);
    });

    it("should list all sessions for a project", async () => {
      const session1Id = `session-1-${Date.now()}`;
      const session2Id = `session-2-${Date.now()}`;
      const session3Id = `session-3-${Date.now()}`;
      testSessionIds.push(session1Id, session2Id, session3Id);

      // Register three sessions
      await Promise.all([
        request("/api/sessions/register", {
          method: "POST",
          body: JSON.stringify({
            session_id: session1Id,
            project_id: testProjectId,
            project_path: "/test/path",
            platform: "claude-code",
          }),
        }),
        request("/api/sessions/register", {
          method: "POST",
          body: JSON.stringify({
            session_id: session2Id,
            project_id: testProjectId,
            project_path: "/test/path",
            platform: "chatgpt",
          }),
        }),
        request("/api/sessions/register", {
          method: "POST",
          body: JSON.stringify({
            session_id: session3Id,
            project_id: testProjectId,
            project_path: "/test/path",
            platform: "desktop",
          }),
        }),
      ]);

      const response = await request<{
        success: boolean;
        data: {
          project_id: string;
          sessions: Session[];
          total: number;
        };
      }>(`/api/projects/${testProjectId}/sessions`);

      expect(response.success).toBe(true);
      expect(response.data.total).toBe(3);
      expect(response.data.sessions).toHaveLength(3);
      expect(response.data.sessions.map((s) => s.session_id)).toEqual(
        expect.arrayContaining([session1Id, session2Id, session3Id]),
      );
    });
  });

  describe("Project Canonical State", () => {
    it("should maintain singular project state across sessions", async () => {
      const session1Id = `session-1-${Date.now()}`;
      const session2Id = `session-2-${Date.now()}`;
      testSessionIds.push(session1Id, session2Id);

      // Register sessions
      await Promise.all([
        request("/api/sessions/register", {
          method: "POST",
          body: JSON.stringify({
            session_id: session1Id,
            project_id: testProjectId,
            project_path: "/test/path",
            platform: "claude-code",
          }),
        }),
        request("/api/sessions/register", {
          method: "POST",
          body: JSON.stringify({
            session_id: session2Id,
            project_id: testProjectId,
            project_path: "/test/path",
            platform: "claude-code",
          }),
        }),
      ]);

      // Create unique todos in each session
      const todo1 = await request<{ success: boolean; data: Todo }>(
        "/api/todos",
        {
          method: "POST",
          body: JSON.stringify({
            content: "Todo from session 1",
            status: "pending",
            session_id: session1Id,
            platform: "claude-code",
          }),
        },
      );

      const todo2 = await request<{ success: boolean; data: Todo }>(
        "/api/todos",
        {
          method: "POST",
          body: JSON.stringify({
            content: "Todo from session 2",
            status: "in_progress",
            session_id: session2Id,
            platform: "claude-code",
          }),
        },
      );

      // Sync both sessions
      await request(`/api/sessions/${session1Id}/sync`, {
        method: "POST",
        body: JSON.stringify({
          project_id: testProjectId,
          todos: [todo1.data],
        }),
      });

      await request(`/api/sessions/${session2Id}/sync`, {
        method: "POST",
        body: JSON.stringify({
          project_id: testProjectId,
          todos: [todo2.data],
        }),
      });

      // Get canonical state
      const canonicalResponse = await request<{
        success: boolean;
        data: ProjectState;
      }>(`/api/projects/${testProjectId}/canonical`);

      expect(canonicalResponse.success).toBe(true);
      expect(canonicalResponse.data.project_id).toBe(testProjectId);
      expect(canonicalResponse.data.canonical_todos).toHaveLength(2);
      expect(canonicalResponse.data.canonical_todos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: todo1.data.id }),
          expect.objectContaining({ id: todo2.data.id }),
        ]),
      );
      expect(canonicalResponse.data.contributing_sessions).toHaveLength(2);
    });

    it("should get project canonical state for non-existent project", async () => {
      const nonExistentProjectId = `non-existent-${Date.now()}`;

      try {
        await request(`/api/projects/${nonExistentProjectId}/canonical`);
        expect.fail("Should have thrown 404 error");
      } catch (error: any) {
        expect(error.message).toContain("404");
      }
    });
  });

  describe("Error Handling", () => {
    it("should return 400 for missing required fields on register", async () => {
      try {
        await request("/api/sessions/register", {
          method: "POST",
          body: JSON.stringify({
            session_id: "test",
            // Missing project_id and project_path
          }),
        });
        expect.fail("Should have thrown 400 error");
      } catch (error: any) {
        expect(error.message).toContain("400");
      }
    });

    it("should return 404 for non-existent session", async () => {
      try {
        await request("/api/sessions/non-existent-session");
        expect.fail("Should have thrown 404 error");
      } catch (error: any) {
        expect(error.message).toContain("404");
      }
    });

    it("should return 400 for sync without project_id", async () => {
      const sessionId = `session-test-${Date.now()}`;
      testSessionIds.push(sessionId);

      await request("/api/sessions/register", {
        method: "POST",
        body: JSON.stringify({
          session_id: sessionId,
          project_id: testProjectId,
          project_path: "/test/path",
          platform: "claude-code",
        }),
      });

      try {
        await request(`/api/sessions/${sessionId}/sync`, {
          method: "POST",
          body: JSON.stringify({}), // Missing project_id
        });
        expect.fail("Should have thrown 400 error");
      } catch (error: any) {
        expect(error.message).toContain("400");
      }
    });
  });
});
