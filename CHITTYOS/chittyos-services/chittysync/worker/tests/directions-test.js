#!/usr/bin/env node

/**
 * Directions Integration Test (Claude Code → Agent)
 * Usage: node tests/directions-test.js [base_url] [token]
 */

const BASE_URL = process.argv[2] || "http://localhost:8787";
const TOKEN = process.argv[3] || process.env.CHITTY_ID_TOKEN;

if (!TOKEN) {
  console.error("❌ Error: CHITTY_ID_TOKEN not set");
  console.error("Usage: node tests/directions-test.js [base_url] [token]");
  process.exit(1);
}

let pass = 0;
let fail = 0;
let createdId = null;
const agentId = `codex-cli`;
const sessionId = `session-${Date.now()}`;

async function api(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, data };
}

async function test(name, fn) {
  try { await fn(); console.log(`✅ ${name}`); pass++; }
  catch (e) { console.log(`❌ ${name}`); console.log(`   ${e.message}`); fail++; }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`); }

(async () => {
  console.log("🧪 Directions Integration Tests\n");

  await test("POST /api/directions creates direction", async () => {
    const { status, data } = await api("POST", "/api/directions", {
      agent_id: agentId,
      session_id: sessionId,
      content: "Run validate and summarize results",
      type: "instruction",
      priority: 5,
      source: "claude-code",
    });
    eq(status, 201, "status");
    assert(data.data && data.data.id, "direction id present");
    eq(data.data.status, "queued", "status queued");
    createdId = data.data.id;
  });

  await test("POST /api/directions/claim returns next direction", async () => {
    const { status, data } = await api("POST", "/api/directions/claim", {
      agent_id: agentId,
      session_id: sessionId,
    });
    eq(status, 200, "status");
    assert(data.data && data.data.id === createdId, "claimed id matches");
    eq(data.data.status, "in_progress", "status in_progress");
  });

  await test("POST /api/directions/:id/complete marks as completed", async () => {
    const { status, data } = await api(
      "POST",
      `/api/directions/${createdId}/complete`,
      { result: "Validated: all green" },
    );
    eq(status, 200, "status");
    eq(data.data.status, "completed", "completed status");
    assert(data.data.completed_at, "completed_at set");
  });

  await test("POST /api/directions/claim returns null after completion", async () => {
    const { status, data } = await api("POST", "/api/directions/claim", {
      agent_id: agentId,
      session_id: sessionId,
    });
    eq(status, 200, "status");
    eq(data.data, null, "no directions left");
  });

  console.log("\n=== Summary ===");
  console.log(`✅ Passed: ${pass}`);
  console.log(`❌ Failed: ${fail}`);
  process.exit(fail ? 1 : 0);
})();

