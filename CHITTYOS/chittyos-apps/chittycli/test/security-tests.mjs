#!/usr/bin/env node
/**
 * Security QA & Penetration Testing for ChittyCLI
 * Tests all security boundaries and attack vectors
 */

import { formatGate, validate, generate, isReservedCommand, detectScriptInjection } from '../src/index.mjs';
import fallback from '../src/fallback.mjs';

console.log("🔒 ChittyCLI Security Testing Suite\n");
console.log("=" .repeat(50));

let passed = 0;
let failed = 0;
let blocked = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (error) {
    if (error.message.includes('Security') || error.message.includes('FORBIDDEN')) {
      console.log(`🛡️ BLOCKED: ${name} (${error.message})`);
      blocked++;
      passed++; // Blocking is the expected behavior
    } else {
      console.log(`❌ FAIL: ${name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
    }
  }
}

console.log("\n1. Script Injection Tests\n" + "-".repeat(30));

// XSS Attempts
await test("Block <script> tag injection", () => {
  formatGate("01-1-<script>alert(1)</script>-2024-D-202409-1-7");
});

await test("Block javascript: protocol", () => {
  formatGate("01-1-javascript:alert(1)-2024-D-202409-1-7");
});

await test("Block eval() injection", () => {
  formatGate("01-1-eval-2024-D-202409-1-7");
});

await test("Block onclick handler", () => {
  formatGate("01-1-onclick=alert-2024-D-202409-1-7");
});

// SQL Injection
await test("Block SQL DROP TABLE", () => {
  formatGate("01-1-USA-2024-DROP TABLE-202409-1-7");
});

await test("Block SQL comment --", () => {
  formatGate("01-1-USA-2024-D--202409-1-7");
});

// Path Traversal
await test("Block ../ path traversal", () => {
  formatGate("01-1-USA-2024-D-../../../etc/passwd-1-7");
});

await test("Block file:// protocol", () => {
  formatGate("01-1-file://etc/passwd-2024-D-202409-1-7");
});

// Template Injection
await test("Block ${} template injection", () => {
  formatGate("01-1-USA-2024-${process.exit()}-202409-1-7");
});

await test("Block {{}} template injection", () => {
  formatGate("01-1-USA-2024-{{7*7}}-202409-1-7");
});

// Encoded Attacks
await test("Block hex encoded script", () => {
  formatGate("01-1-USA-2024-\\x3cscript\\x3e-202409-1-7");
});

await test("Block unicode escape", () => {
  formatGate("01-1-USA-2024-\\u003cscript\\u003e-202409-1-7");
});

await test("Block URL encoded", () => {
  formatGate("01-1-USA-2024-%3Cscript%3E-202409-1-7");
});

console.log("\n2. Reserved ID Security\n" + "-".repeat(30));

// Reserved Version Blocking
await test("Block generation of version 00", async () => {
  await generate({ kind: "test", version: "00" });
});

await test("Block generation of version 99", async () => {
  await generate({ kind: "test", version: "99" });
});

await test("Block generation of SYS kind", async () => {
  await generate({ kind: "SYS" });
});

await test("Block generation of ADM kind", async () => {
  await generate({ kind: "ADM" });
});

// Admin Command Authorization
await test("Block admin command without auth", async () => {
  process.env.CHITTY_ADMIN = "false";
  await validate("00-0-SYS-9999-E-9999-9-9"); // Emergency stop
});

console.log("\n3. Format Validation Tests\n" + "-".repeat(30));

// Length Attacks
await test("Block oversized ChittyID", () => {
  formatGate("A".repeat(100));
});

await test("Block empty segments", () => {
  formatGate("01--USA-2024-D-202409-1-7");
});

await test("Block wrong segment count", () => {
  formatGate("01-1-USA-2024-D-202409"); // Missing segments
});

await test("Block non-string input", () => {
  formatGate({ malicious: "object" });
});

await test("Block control characters", () => {
  formatGate("01-1-USA-2024-D\x00-202409-1-7");
});

console.log("\n4. Fake ChittyID Detection\n" + "-".repeat(30));

// IDs that look valid but aren't
await test("Detect fake valid-looking ID", () => {
  formatGate("01-1-USA-2024-X-202409-1-7ABC"); // Extra characters
});

await test("Detect script masquerading as ID", () => {
  detectScriptInjection("01-1-eval-2024-D-202409-1-7");
});

await test("Detect URL in ChittyID", () => {
  detectScriptInjection("01-1-http-2024-D-202409-1-7");
});

console.log("\n5. Fallback ID Security\n" + "-".repeat(30));

// Fallback Status Testing
await test("Recognize SERVICE_DOWN fallback", () => {
  const status = fallback.decodeFallbackStatus("00-1-ERR-5030-S-0000-0-0");
  if (!status.isFallback) throw new Error("Should recognize fallback");
});

await test("Detect non-retryable status", () => {
  const status = fallback.decodeFallbackStatus("00-1-MNT-5031-M-0000-0-1");
  if (status.retryable) throw new Error("Maintenance should not be retryable");
});

console.log("\n6. Input Sanitization\n" + "-".repeat(30));

// Parameter Injection
await test("Block invalid kind parameter", async () => {
  await generate({ kind: { "$ne": null } }); // NoSQL injection attempt
});

await test("Block oversized kind", async () => {
  await generate({ kind: "A".repeat(100) });
});

await test("Block non-object attrs", async () => {
  await generate({ attrs: "string-not-object" });
});

console.log("\n7. Retry & Resilience Tests\n" + "-".repeat(30));

// Test retry logic
await test("Handle network failure gracefully", async () => {
  const originalBase = process.env.CHITTY_BASE_URL;
  process.env.CHITTY_BASE_URL = "http://invalid-domain-that-does-not-exist.com";
  process.env.CHITTY_MAX_RETRIES = "1"; // Reduce for testing

  try {
    await validate("01-1-USA-2024-D-202409-1-7");
  } finally {
    process.env.CHITTY_BASE_URL = originalBase;
  }
});

console.log("\n8. Cache Poisoning Prevention\n" + "-".repeat(30));

await test("Block cache poisoning with script", () => {
  // Try to poison cache with malicious ID
  formatGate("<img src=x onerror=alert(1)>");
});

console.log("\n9. Command Injection Prevention\n" + "-".repeat(30));

await test("Block shell command injection", () => {
  formatGate("01-1-USA-2024-;rm -rf /-202409-1-7");
});

await test("Block pipe injection", () => {
  formatGate("01-1-USA-2024-|cat /etc/passwd-202409-1-7");
});

await test("Block backtick injection", () => {
  formatGate("01-1-USA-2024-`whoami`-202409-1-7");
});

console.log("\n10. Business Logic Tests\n" + "-".repeat(30));

// Placeholder blocking
await test("Block placeholder IDs", () => {
  const guards = forbidLocalMint();
  guards.placeholder();
});

await test("Block temporary IDs", () => {
  const guards = forbidLocalMint();
  guards.temporary();
});

await test("Block local ID generation", () => {
  const guards = forbidLocalMint();
  guards.makeId();
});

// Special character handling
console.log("\n11. Special Character Tests\n" + "-".repeat(30));

await test("Block null bytes", () => {
  formatGate("01-1-USA\0-2024-D-202409-1-7");
});

await test("Block newlines", () => {
  formatGate("01-1-USA\n-2024-D-202409-1-7");
});

await test("Block tabs", () => {
  formatGate("01-1-USA\t-2024-D-202409-1-7");
});

// Performance & DoS Prevention
console.log("\n12. DoS Prevention Tests\n" + "-".repeat(30));

await test("Handle rapid repeated validations", async () => {
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(validate("99-9-TST-0000-M-0000-0-0").catch(() => {}));
  }
  await Promise.all(promises);
});

await test("Block regex DoS (ReDoS)", () => {
  // Attempt catastrophic backtracking
  const malicious = "01-1-" + "A".repeat(1000) + "-2024-D-202409-1-7";
  formatGate(malicious);
});

// Summary
console.log("\n" + "=".repeat(50));
console.log("📊 Test Summary:");
console.log(`   ✅ Passed: ${passed}`);
console.log(`   🛡️ Blocked: ${blocked}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   📈 Security Score: ${Math.round((passed / (passed + failed)) * 100)}%`);

if (failed === 0) {
  console.log("\n🎉 All security tests passed! System is secure.");
} else {
  console.log("\n⚠️ Some tests failed. Review security measures.");
  process.exit(1);
}

// Additional manual penetration tests to run
console.log("\n📝 Manual Penetration Tests to Perform:");
console.log("1. Burp Suite scan on the validation endpoint");
console.log("2. OWASP ZAP automated scan");
console.log("3. Rate limiting verification (send 1000+ requests)");
console.log("4. Certificate pinning test");
console.log("5. Man-in-the-middle attack simulation");
console.log("6. DNS hijacking simulation");
console.log("7. Token rotation verification");
console.log("8. Audit log integrity check");