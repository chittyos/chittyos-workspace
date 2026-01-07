import { describe, it, expect } from 'vitest';
import {
  canonicalizeJson,
  canonicalizeYaml,
  canonicalizeText,
  canonicalizeValue,
  canonicalizeAndHash,
  sha256,
} from '../src/jcs';

describe('JCS - JSON Canonicalization', () => {
  it('sorts object keys lexicographically', () => {
    const input = '{"b":2,"a":1}';
    const canonical = canonicalizeJson(input);
    expect(canonical).toBe('{"a":1,"b":2}');
  });

  it('handles nested objects', () => {
    const input = '{"b":2,"a":1,"nested":{"z":true,"x":null}}';
    const canonical = canonicalizeJson(input);
    expect(canonical).toBe('{"a":1,"b":2,"nested":{"x":null,"z":true}}');
  });

  it('preserves array order', () => {
    const input = '{"arr":[3,1,2]}';
    const canonical = canonicalizeJson(input);
    expect(canonical).toBe('{"arr":[3,1,2]}');
  });

  it('handles special characters', () => {
    const input = '{"emoji":"🎉","unicode":"日本語"}';
    const canonical = canonicalizeJson(input);
    expect(canonical).toContain('🎉');
    expect(canonical).toContain('日本語');
  });

  it('canonicalizes values directly', () => {
    const value = { z: 1, a: 2, m: [3, 2, 1] };
    const canonical = canonicalizeValue(value);
    expect(canonical).toBe('{"a":2,"m":[3,2,1],"z":1}');
  });
});

describe('JCS - YAML Canonicalization', () => {
  it('parses YAML and canonicalizes as JSON', () => {
    const yaml = 'b: 2\na: 1\nlist:\n  - 2\n  - 1\n';
    const canonical = canonicalizeYaml(yaml);
    expect(canonical).toBe('{"a":1,"b":2,"list":[2,1]}');
  });

  it('handles complex YAML', () => {
    const yaml = `
name: test
version: 1.0.0
config:
  debug: true
  level: info
`;
    const canonical = canonicalizeYaml(yaml);
    const parsed = JSON.parse(canonical);
    expect(parsed.name).toBe('test');
    expect(parsed.config.debug).toBe(true);
  });
});

describe('JCS - Text Canonicalization', () => {
  it('normalizes CRLF to LF', () => {
    const text = 'line1\r\nline2\r\n';
    const canonical = canonicalizeText(text);
    expect(canonical).toBe('line1\nline2');
  });

  it('normalizes CR to LF', () => {
    const text = 'line1\rline2\r';
    const canonical = canonicalizeText(text);
    expect(canonical).toBe('line1\nline2');
  });

  it('trims trailing whitespace per line', () => {
    const text = 'a  \n b\t \n c';
    const canonical = canonicalizeText(text);
    expect(canonical).toBe('a\n b\n c');
  });

  it('removes trailing newline', () => {
    const text = 'content\n';
    const canonical = canonicalizeText(text);
    expect(canonical).toBe('content');
  });

  it('handles mixed line endings and whitespace', () => {
    const txt = 'a  \r\n b\t \n c\r\n';
    const normalized = canonicalizeText(txt);
    expect(normalized).toBe('a\n b\n c');
  });
});

describe('JCS - Hash Generation', () => {
  it('generates SHA-256 hash', async () => {
    const hash = await sha256('test');
    expect(hash).toHaveLength(64); // 256 bits = 64 hex chars
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('produces consistent hashes', async () => {
    const hash1 = await sha256('consistent');
    const hash2 = await sha256('consistent');
    expect(hash1).toBe(hash2);
  });
});

describe('JCS - canonicalizeAndHash', () => {
  it('canonicalizes JSON and computes hash', async () => {
    const result = await canonicalizeAndHash({
      type: 'json',
      content: '{"b":2,"a":1}',
    });
    expect(result.canonical).toBe('{"a":1,"b":2}');
    expect(result.hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result.type).toBe('json');
  });

  it('canonicalizes YAML and computes hash', async () => {
    const result = await canonicalizeAndHash({
      type: 'yaml',
      content: 'a: 1\nb: 2\n',
    });
    expect(result.canonical).toBe('{"a":1,"b":2}');
    expect(result.hash).toMatch(/^sha256:/);
    expect(result.type).toBe('yaml');
  });

  it('canonicalizes text and computes hash', async () => {
    const result = await canonicalizeAndHash({
      type: 'text',
      content: 'hello world  \n',
    });
    expect(result.canonical).toBe('hello world');
    expect(result.hash).toMatch(/^sha256:/);
    expect(result.type).toBe('text');
  });

  it('throws on unsupported type', async () => {
    await expect(
      canonicalizeAndHash({ type: 'xml' as any, content: '<root/>' })
    ).rejects.toThrow('Unsupported content type');
  });
});
