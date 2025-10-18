/**
 * ChittyOS Todo Sync - Phase 2.1 Merge Tests
 * Version: 2.0.0
 *
 * Comprehensive test suite for three-way merge algorithm and vector clocks.
 */

const {
  ClientMergeEngine,
  VectorClockManager,
} = require("../client/merge-engine.cjs");

/**
 * Simple test harness
 */
class TestRunner {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(description, fn) {
    this.tests.push({ description, fn });
  }

  async run() {
    console.log(`\n========================================`);
    console.log(`Running: ${this.name}`);
    console.log(`========================================\n`);

    for (const { description, fn } of this.tests) {
      try {
        await fn();
        this.passed++;
        console.log(`✓ ${description}`);
      } catch (error) {
        this.failed++;
        console.log(`✗ ${description}`);
        console.log(`  Error: ${error.message}`);
      }
    }

    console.log(`\n----------------------------------------`);
    console.log(`Results: ${this.passed} passed, ${this.failed} failed`);
    console.log(`========================================\n`);

    return this.failed === 0;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// ============================================================================
// Vector Clock Tests
// ============================================================================

const vectorClockTests = new TestRunner("Vector Clock Tests");

vectorClockTests.test("Initialize vector clock", () => {
  const clock = VectorClockManager.init("claude-code");
  assertEqual(clock["claude-code"], 0);
});

vectorClockTests.test("Increment vector clock", () => {
  let clock = VectorClockManager.init("claude-code");
  clock = VectorClockManager.increment(clock, "claude-code");
  assertEqual(clock["claude-code"], 1);
});

vectorClockTests.test("Merge vector clocks", () => {
  const clock1 = { "claude-code": 5, chatgpt: 3 };
  const clock2 = { "claude-code": 3, chatgpt: 7, desktop: 2 };
  const merged = VectorClockManager.merge(clock1, clock2);

  assertEqual(merged["claude-code"], 5);
  assertEqual(merged["chatgpt"], 7);
  assertEqual(merged["desktop"], 2);
});

vectorClockTests.test("Compare: BEFORE", () => {
  const clock1 = { "claude-code": 1, chatgpt: 2 };
  const clock2 = { "claude-code": 2, chatgpt: 3 };
  const order = VectorClockManager.compare(clock1, clock2);
  assertEqual(order, "BEFORE");
});

vectorClockTests.test("Compare: AFTER", () => {
  const clock1 = { "claude-code": 5, chatgpt: 3 };
  const clock2 = { "claude-code": 2, chatgpt: 1 };
  const order = VectorClockManager.compare(clock1, clock2);
  assertEqual(order, "AFTER");
});

vectorClockTests.test("Compare: EQUAL", () => {
  const clock1 = { "claude-code": 5, chatgpt: 3 };
  const clock2 = { "claude-code": 5, chatgpt: 3 };
  const order = VectorClockManager.compare(clock1, clock2);
  assertEqual(order, "EQUAL");
});

vectorClockTests.test("Compare: CONCURRENT", () => {
  const clock1 = { "claude-code": 5, chatgpt: 2 };
  const clock2 = { "claude-code": 3, chatgpt: 7 };
  const order = VectorClockManager.compare(clock1, clock2);
  assertEqual(order, "CONCURRENT");
});

// ============================================================================
// Three-Way Merge Tests
// ============================================================================

const mergeTests = new TestRunner("Three-Way Merge Tests");

mergeTests.test("No conflict: Local unchanged, remote changed", () => {
  const base = {
    id: "1",
    content: "Deploy worker",
    status: "pending",
    updated_at: 1000,
  };

  const local = { ...base };

  const remote = {
    ...base,
    status: "in_progress",
    updated_at: 2000,
  };

  const result = ClientMergeEngine.threeWayMerge(local, remote, base);

  assertEqual(result.conflict, false);
  assertEqual(result.merged.status, "in_progress");
  assertEqual(result.strategy, "three_way");
});

mergeTests.test("No conflict: Local changed, remote unchanged", () => {
  const base = {
    id: "1",
    content: "Deploy worker",
    status: "pending",
    updated_at: 1000,
  };

  const local = {
    ...base,
    content: "Deploy worker to production",
    updated_at: 2000,
  };

  const remote = { ...base };

  const result = ClientMergeEngine.threeWayMerge(local, remote, base);

  assertEqual(result.conflict, false);
  assertEqual(result.merged.content, "Deploy worker to production");
});

mergeTests.test("No conflict: Both changed identically", () => {
  const base = {
    id: "1",
    content: "Deploy worker",
    status: "pending",
    updated_at: 1000,
  };

  const local = {
    ...base,
    status: "completed",
    updated_at: 2000,
  };

  const remote = {
    ...base,
    status: "completed",
    updated_at: 2500,
  };

  const result = ClientMergeEngine.threeWayMerge(local, remote, base);

  assertEqual(result.conflict, false);
  assertEqual(result.merged.status, "completed");
});

mergeTests.test("Content conflict: Both modified content", () => {
  const base = {
    id: "1",
    content: "Deploy worker",
    status: "pending",
    platform: "claude-code",
    updated_at: 1000,
  };

  const local = {
    ...base,
    content: "Deploy worker to production",
    updated_at: 2000,
  };

  const remote = {
    ...base,
    content: "Deploy worker to staging",
    platform: "chatgpt",
    updated_at: 2500,
  };

  const result = ClientMergeEngine.threeWayMerge(
    local,
    remote,
    base,
    "timestamp",
  );

  assertEqual(result.conflict, true);
  assertEqual(result.conflictType, "content_diff");
  // Timestamp strategy: remote wins (later timestamp)
  assertEqual(result.merged.content, "Deploy worker to staging");
});

mergeTests.test("Status conflict: Both modified status", () => {
  const base = {
    id: "1",
    content: "Deploy worker",
    status: "pending",
    updated_at: 1000,
  };

  const local = {
    ...base,
    status: "in_progress",
    updated_at: 2000,
  };

  const remote = {
    ...base,
    status: "completed",
    updated_at: 1500,
  };

  const result = ClientMergeEngine.threeWayMerge(
    local,
    remote,
    base,
    "status_priority",
  );

  assertEqual(result.conflict, true);
  assertEqual(result.conflictType, "status_diff");
  // Status priority: completed > in_progress
  assertEqual(result.merged.status, "completed");
});

mergeTests.test("Delete conflict: Remote deleted, local modified", () => {
  const base = {
    id: "1",
    content: "Deploy worker",
    status: "pending",
    updated_at: 1000,
  };

  const local = {
    ...base,
    status: "completed",
    updated_at: 2000,
  };

  const remote = null;

  const result = ClientMergeEngine.threeWayMerge(local, remote, base);

  assertEqual(result.conflict, true);
  assertEqual(result.conflictType, "delete_conflict");
  // Modified version wins over delete
  assertEqual(result.merged.id, "1");
});

mergeTests.test("Vector clock: BEFORE (local before remote)", () => {
  const base = {
    id: "1",
    content: "Original",
    status: "pending",
    updated_at: 1000,
    vectorClock: { "claude-code": 1, chatgpt: 1 },
  };

  const local = {
    ...base,
    content: "Local change",
    updated_at: 2000,
    vectorClock: { "claude-code": 2, chatgpt: 1 },
  };

  const remote = {
    ...base,
    content: "Remote change",
    updated_at: 2500,
    vectorClock: { "claude-code": 2, chatgpt: 3 },
  };

  const result = ClientMergeEngine.threeWayMerge(local, remote, base);

  // Local happened before remote (local.vc < remote.vc)
  // Remote should win
  assertEqual(result.conflict, false);
  assertEqual(result.merged.content, "Remote change");
});

mergeTests.test("Vector clock: CONCURRENT (conflict)", () => {
  const base = {
    id: "1",
    content: "Original",
    status: "pending",
    updated_at: 1000,
    vectorClock: { "claude-code": 1, chatgpt: 1 },
  };

  const local = {
    ...base,
    content: "Local change",
    updated_at: 2000,
    vectorClock: { "claude-code": 5, chatgpt: 2 },
  };

  const remote = {
    ...base,
    content: "Remote change",
    updated_at: 2500,
    vectorClock: { "claude-code": 3, chatgpt: 7 },
  };

  const result = ClientMergeEngine.threeWayMerge(
    local,
    remote,
    base,
    "timestamp",
  );

  // Concurrent edits - conflict
  assertEqual(result.conflict, true);
  // Timestamp strategy used as fallback
  assertEqual(result.merged.content, "Remote change");
});

mergeTests.test("Keep both strategy", () => {
  const base = {
    id: "1",
    content: "Original",
    status: "pending",
    platform: "claude-code",
    updated_at: 1000,
  };

  const local = {
    ...base,
    content: "Local version",
    updated_at: 2000,
  };

  const remote = {
    ...base,
    content: "Remote version",
    platform: "chatgpt",
    updated_at: 2500,
  };

  const result = ClientMergeEngine.threeWayMerge(
    local,
    remote,
    base,
    "keep_both",
  );

  assertEqual(result.conflict, true);
  assertEqual(result.strategy, "keep_both");
  assert(Array.isArray(result.merged));
  assertEqual(result.merged.length, 2);
  assertEqual(result.merged[0].content, "[LOCAL] Local version");
  assertEqual(result.merged[1].content, "[REMOTE] Remote version");
});

mergeTests.test("Manual resolution with conflict markers", () => {
  const base = {
    id: "1",
    content: "Original",
    status: "pending",
    platform: "claude-code",
    updated_at: 1000,
  };

  const local = {
    ...base,
    content: "Local version",
    updated_at: 2000,
  };

  const remote = {
    ...base,
    content: "Remote version",
    platform: "chatgpt",
    updated_at: 2500,
  };

  const result = ClientMergeEngine.threeWayMerge(local, remote, base, "manual");

  assertEqual(result.conflict, true);
  assertEqual(result.strategy, "manual");
  assert(result.merged.content.includes("<<<<<<< LOCAL"));
  assert(result.merged.content.includes("======="));
  assert(result.merged.content.includes(">>>>>>> REMOTE"));
  assertEqual(result.merged.status, "pending");
  assert(result.merged.metadata.requiresResolution);
});

// ============================================================================
// Run All Tests
// ============================================================================

async function runAllTests() {
  const results = [];

  results.push(await vectorClockTests.run());
  results.push(await mergeTests.run());

  const allPassed = results.every((r) => r === true);

  console.log("\n========================================");
  console.log("OVERALL RESULTS");
  console.log("========================================");
  console.log(
    `Status: ${allPassed ? "✓ ALL TESTS PASSED" : "✗ SOME TESTS FAILED"}`,
  );
  console.log("========================================\n");

  process.exit(allPassed ? 0 : 1);
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch((error) => {
    console.error("Test runner error:", error);
    process.exit(1);
  });
}

module.exports = { runAllTests };
