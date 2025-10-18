#!/usr/bin/env node

/**
 * ChittyOS Todo Sync Hub - Comprehensive API Test Suite
 * Tests all 8 endpoints with various scenarios
 * Usage: node tests/api-test.js [base_url] [token]
 */

const BASE_URL = process.argv[2] || "http://localhost:8787";
const TOKEN = process.argv[3] || process.env.CHITTY_ID_TOKEN;

if (!TOKEN) {
  console.error("❌ Error: CHITTY_ID_TOKEN not set");
  console.error("Usage: node tests/api-test.js [base_url] [token]");
  console.error("Example: CHITTY_ID_TOKEN=mcp_auth_xxx node tests/api-test.js");
  process.exit(1);
}

let testsPassed = 0;
let testsFailed = 0;
let createdTodoId = null;

console.log("🧪 ChittyOS Todo Sync Hub - API Test Suite\n");
console.log(`Base URL: ${BASE_URL}`);
console.log(`Token: ${TOKEN.substring(0, 20)}...\n`);

// Helper function to make API requests
async function apiRequest(method, path, body = null, requireAuth = true) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (requireAuth) {
    options.headers["Authorization"] = `Bearer ${TOKEN}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let data = null;

    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    return { status: response.status, data, response };
  } catch (error) {
    return { status: 0, error: error.message };
  }
}

// Test runner
async function runTest(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    testsFailed++;
  }
}

// Assertion helpers
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

// Test Suite
async function runTests() {
  console.log("--- Test 1: Health Check (No Auth) ---");
  await runTest("GET /api/todos/health should return 200", async () => {
    const { status, data } = await apiRequest(
      "GET",
      "/api/todos/health",
      null,
      false,
    );
    assertEqual(status, 200, "Status code");
    assert(data.status, "Should have status field");
    assert(data.service, "Should have service field");
    assert(data.database, "Should have database field");
    assert(data.chittyid, "Should have chittyid field");
  });

  console.log("\n--- Test 2: Authentication ---");
  await runTest("GET /api/todos without auth should return 401", async () => {
    const { status, data } = await apiRequest("GET", "/api/todos", null, false);
    assertEqual(status, 401, "Status code");
    assertEqual(data.success, false, "Success should be false");
  });

  await runTest(
    "GET /api/todos with invalid token should return 401",
    async () => {
      const url = `${BASE_URL}/api/todos`;
      const response = await fetch(url, {
        headers: { Authorization: "Bearer invalid_token_123" },
      });
      assertEqual(response.status, 401, "Status code");
    },
  );

  console.log("\n--- Test 3: Create Todo ---");
  await runTest(
    "POST /api/todos should create todo with ChittyID",
    async () => {
      const { status, data } = await apiRequest("POST", "/api/todos", {
        content: "Test todo from API test suite",
        status: "pending",
        active_form: "Testing todo from API test suite",
        platform: "custom",
        metadata: { test: true },
      });
      assertEqual(status, 201, "Status code");
      assertEqual(data.success, true, "Success should be true");
      assert(data.data, "Should have data field");
      assert(data.data.id, "Todo should have ChittyID");
      assert(
        data.data.id.startsWith("CHITTY-") || data.data.id.length > 10,
        "Should be ChittyID format",
      );
      assertEqual(
        data.data.content,
        "Test todo from API test suite",
        "Content should match",
      );
      assertEqual(data.data.status, "pending", "Status should match");

      // Save ID for later tests
      createdTodoId = data.data.id;
    },
  );

  await runTest(
    "POST /api/todos without required fields should return 400",
    async () => {
      const { status, data } = await apiRequest("POST", "/api/todos", {
        content: "Missing status field",
      });
      assertEqual(status, 400, "Status code");
      assertEqual(data.success, false, "Success should be false");
    },
  );

  await runTest(
    "POST /api/todos with invalid status should return 400",
    async () => {
      const { status, data } = await apiRequest("POST", "/api/todos", {
        content: "Invalid status",
        status: "invalid_status",
      });
      assertEqual(status, 400, "Status code");
      assertEqual(data.success, false, "Success should be false");
    },
  );

  console.log("\n--- Test 4: List Todos ---");
  await runTest("GET /api/todos should return array of todos", async () => {
    const { status, data } = await apiRequest("GET", "/api/todos");
    assertEqual(status, 200, "Status code");
    assertEqual(data.success, true, "Success should be true");
    assert(Array.isArray(data.data), "Data should be array");
    assert(data.data.length > 0, "Should have at least one todo");
  });

  await runTest("GET /api/todos with platform filter", async () => {
    const { status, data } = await apiRequest(
      "GET",
      "/api/todos?platform=custom",
    );
    assertEqual(status, 200, "Status code");
    assertEqual(data.success, true, "Success should be true");
    assert(Array.isArray(data.data), "Data should be array");
  });

  await runTest("GET /api/todos with status filter", async () => {
    const { status, data } = await apiRequest(
      "GET",
      "/api/todos?status=pending",
    );
    assertEqual(status, 200, "Status code");
    assertEqual(data.success, true, "Success should be true");
    assert(Array.isArray(data.data), "Data should be array");
  });

  console.log("\n--- Test 5: Get Single Todo ---");
  if (createdTodoId) {
    await runTest("GET /api/todos/:id should return single todo", async () => {
      const { status, data } = await apiRequest(
        "GET",
        `/api/todos/${createdTodoId}`,
      );
      assertEqual(status, 200, "Status code");
      assertEqual(data.success, true, "Success should be true");
      assert(data.data, "Should have data field");
      assertEqual(data.data.id, createdTodoId, "ID should match");
    });

    await runTest(
      "GET /api/todos/:id with non-existent id should return 404",
      async () => {
        const { status, data } = await apiRequest(
          "GET",
          "/api/todos/CHITTY-NONEXISTENT",
        );
        assertEqual(status, 404, "Status code");
        assertEqual(data.success, false, "Success should be false");
      },
    );
  }

  console.log("\n--- Test 6: Update Todo ---");
  if (createdTodoId) {
    await runTest("PUT /api/todos/:id should update todo", async () => {
      const { status, data } = await apiRequest(
        "PUT",
        `/api/todos/${createdTodoId}`,
        {
          status: "in_progress",
          content: "Updated test todo",
        },
      );
      assertEqual(status, 200, "Status code");
      assertEqual(data.success, true, "Success should be true");
      assertEqual(data.data.status, "in_progress", "Status should be updated");
      assertEqual(
        data.data.content,
        "Updated test todo",
        "Content should be updated",
      );
    });

    await runTest(
      "PUT /api/todos/:id with invalid status should return 400",
      async () => {
        const { status, data } = await apiRequest(
          "PUT",
          `/api/todos/${createdTodoId}`,
          {
            status: "invalid_status",
          },
        );
        assertEqual(status, 400, "Status code");
        assertEqual(data.success, false, "Success should be false");
      },
    );

    await runTest(
      "PUT /api/todos/:id with non-existent id should return 404",
      async () => {
        const { status, data } = await apiRequest(
          "PUT",
          "/api/todos/CHITTY-NONEXISTENT",
          {
            status: "completed",
          },
        );
        assertEqual(status, 404, "Status code");
        assertEqual(data.success, false, "Success should be false");
      },
    );
  }

  console.log("\n--- Test 7: Delta Sync ---");
  await runTest(
    "GET /api/todos/since/:timestamp should return recent todos",
    async () => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const { status, data } = await apiRequest(
        "GET",
        `/api/todos/since/${oneHourAgo}`,
      );
      assertEqual(status, 200, "Status code");
      assertEqual(data.success, true, "Success should be true");
      assert(Array.isArray(data.data), "Data should be array");
    },
  );

  await runTest("GET /api/todos/since/0 should return all todos", async () => {
    const { status, data } = await apiRequest("GET", "/api/todos/since/0");
    assertEqual(status, 200, "Status code");
    assertEqual(data.success, true, "Success should be true");
    assert(Array.isArray(data.data), "Data should be array");
  });

  console.log("\n--- Test 8: Bulk Sync ---");
  await runTest("POST /api/todos/sync should sync multiple todos", async () => {
    const { status, data } = await apiRequest("POST", "/api/todos/sync", {
      todos: [
        {
          content: "Bulk sync todo 1",
          status: "pending",
          active_form: "Bulk syncing todo 1",
          platform: "claude-code",
        },
        {
          content: "Bulk sync todo 2",
          status: "in_progress",
          active_form: "Bulk syncing todo 2",
          platform: "chatgpt",
        },
      ],
    });
    assertEqual(status, 200, "Status code");
    assertEqual(data.success, true, "Success should be true");
    assert(data.data, "Should have data field");
    assert(data.data.synced >= 2, "Should sync at least 2 todos");
    assert(Array.isArray(data.data.todos), "Should return synced todos array");
  });

  await runTest(
    "POST /api/todos/sync with invalid body should return 400",
    async () => {
      const { status, data } = await apiRequest("POST", "/api/todos/sync", {
        todos: "not_an_array",
      });
      assertEqual(status, 400, "Status code");
      assertEqual(data.success, false, "Success should be false");
    },
  );

  console.log("\n--- Test 9: Delete Todo ---");
  if (createdTodoId) {
    await runTest("DELETE /api/todos/:id should soft delete todo", async () => {
      const { status, data } = await apiRequest(
        "DELETE",
        `/api/todos/${createdTodoId}`,
      );
      assertEqual(status, 204, "Status code");
    });

    await runTest(
      "GET /api/todos/:id after delete should return 404",
      async () => {
        const { status, data } = await apiRequest(
          "GET",
          `/api/todos/${createdTodoId}`,
        );
        assertEqual(status, 404, "Status code");
        assertEqual(data.success, false, "Success should be false");
      },
    );

    await runTest(
      "DELETE /api/todos/:id with non-existent id should return 404",
      async () => {
        const { status, data } = await apiRequest(
          "DELETE",
          "/api/todos/CHITTY-NONEXISTENT",
        );
        assertEqual(status, 404, "Status code");
        assertEqual(data.success, false, "Success should be false");
      },
    );
  }

  console.log("\n--- Test 10: Edge Cases ---");
  await runTest("GET /api/todos/invalid_route should return 404", async () => {
    const { status, data } = await apiRequest(
      "GET",
      "/api/todos/invalid_route",
    );
    assertEqual(status, 404, "Status code");
  });

  await runTest("POST /api/todos with very long content", async () => {
    const longContent = "A".repeat(1000);
    const { status, data } = await apiRequest("POST", "/api/todos", {
      content: longContent,
      status: "pending",
    });
    assertEqual(status, 201, "Status code");
    assertEqual(data.success, true, "Success should be true");
    assertEqual(data.data.content.length, 1000, "Content should be preserved");
  });

  console.log("\n=== Test Summary ===");
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

// Run the test suite
runTests().catch((error) => {
  console.error("Fatal error running tests:", error);
  process.exit(1);
});
