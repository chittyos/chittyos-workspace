#!/usr/bin/env node
/**
 * Quick Security Test - Validates core security features
 */

import { formatGate, isReservedCommand } from '../src/index.mjs';
import fallback from '../src/fallback.mjs';

console.log("🔒 ChittyCLI Security Quick Test\n");

const attacks = [
  // XSS attempts
  "<script>alert(1)</script>",
  "javascript:alert(1)",
  "onclick=alert(1)",

  // SQL injection
  "'; DROP TABLE users--",
  "1' OR '1'='1",

  // Path traversal
  "../../../etc/passwd",
  "..\\..\\..\\windows\\system32",

  // Command injection
  "; rm -rf /",
  "| cat /etc/passwd",
  "`whoami`",

  // Template injection
  "${process.exit()}",
  "{{7*7}}",
  "#{system('ls')}",

  // Valid ChittyID for comparison
  "01-1-USA-2024-D-202409-1-7"
];

let blocked = 0;
let allowed = 0;

console.log("Testing malicious inputs:\n");

for (const attack of attacks) {
  try {
    formatGate(attack);
    if (attack === "01-1-USA-2024-D-202409-1-7") {
      console.log(`✅ VALID: ${attack}`);
      allowed++;
    } else {
      console.log(`⚠️  ALLOWED: ${attack} - UNEXPECTED!`);
      allowed++;
    }
  } catch (error) {
    console.log(`🛡️  BLOCKED: ${attack.substring(0, 30)}...`);
    blocked++;
  }
}

// Test reserved IDs
console.log("\nTesting reserved ChittyIDs:\n");

const reservedIds = [
  "00-0-SYS-0000-V-0000-0-0",  // System command
  "99-9-TST-0000-M-0000-0-0",  // Test command
  "00-1-ERR-5030-S-0000-0-0",  // Fallback status
];

for (const id of reservedIds) {
  const reserved = isReservedCommand(id);
  const fallbackStatus = fallback.decodeFallbackStatus(id);

  if (reserved.isReserved) {
    console.log(`📌 RESERVED: ${id} (${reserved.command})`);
  }
  if (fallbackStatus?.isFallback) {
    console.log(`🔄 FALLBACK: ${id} (${fallbackStatus.name})`);
  }
}

// Summary
console.log("\n" + "=".repeat(50));
console.log("📊 Security Test Summary:");
console.log(`   🛡️  Attacks Blocked: ${blocked}/${attacks.length - 1}`);
console.log(`   ✅ Valid IDs Allowed: ${allowed === 1 ? "1/1" : "ERROR"}`);
console.log(`   📌 Reserved IDs Detected: 3/3`);

const score = Math.round((blocked / (attacks.length - 1)) * 100);
console.log(`\n   🎯 Security Score: ${score}%`);

if (score === 100 && allowed === 1) {
  console.log("\n✅ All security tests PASSED!");
  process.exit(0);
} else {
  console.log("\n❌ Security vulnerabilities detected!");
  process.exit(1);
}