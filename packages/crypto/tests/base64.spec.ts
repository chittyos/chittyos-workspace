import { describe, it, expect } from 'vitest';
import {
  toBase64,
  fromBase64,
  toBase64Url,
  fromBase64Url,
  toHex,
  fromHex,
} from '../src/base64';

describe('Base64', () => {
  it('encodes and decodes standard Base64', () => {
    const original = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const encoded = toBase64(original);
    expect(encoded).toBe('SGVsbG8=');

    const decoded = fromBase64(encoded);
    expect(decoded).toEqual(original);
  });

  it('handles empty input', () => {
    const empty = new Uint8Array([]);
    const encoded = toBase64(empty);
    expect(encoded).toBe('');

    const decoded = fromBase64('');
    expect(decoded).toEqual(empty);
  });

  it('handles binary data', () => {
    const binary = new Uint8Array([0, 127, 128, 255]);
    const encoded = toBase64(binary);
    const decoded = fromBase64(encoded);
    expect(decoded).toEqual(binary);
  });
});

describe('Base64URL', () => {
  it('encodes without padding', () => {
    const data = new Uint8Array([1, 2, 3]);
    const encoded = toBase64Url(data);
    expect(encoded).not.toContain('=');
  });

  it('uses URL-safe alphabet', () => {
    // Use data that would produce + or / in standard base64
    const data = new Uint8Array([251, 239, 254]);
    const encoded = toBase64Url(data);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('roundtrips correctly', () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const encoded = toBase64Url(original);
    const decoded = fromBase64Url(encoded);
    expect(decoded).toEqual(original);
  });

  it('handles various padding scenarios', () => {
    // 1 byte -> 2 chars (would need 2 padding)
    const one = new Uint8Array([255]);
    expect(fromBase64Url(toBase64Url(one))).toEqual(one);

    // 2 bytes -> 3 chars (would need 1 padding)
    const two = new Uint8Array([255, 255]);
    expect(fromBase64Url(toBase64Url(two))).toEqual(two);

    // 3 bytes -> 4 chars (no padding needed)
    const three = new Uint8Array([255, 255, 255]);
    expect(fromBase64Url(toBase64Url(three))).toEqual(three);
  });
});

describe('Hex', () => {
  it('encodes bytes to hex', () => {
    const data = new Uint8Array([0, 15, 16, 255]);
    const hex = toHex(data);
    expect(hex).toBe('000f10ff');
  });

  it('decodes hex to bytes', () => {
    const hex = '48656c6c6f'; // "Hello"
    const decoded = fromHex(hex);
    expect(decoded).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
  });

  it('handles uppercase hex', () => {
    const hex = '00FF10AB';
    const decoded = fromHex(hex);
    expect(decoded).toEqual(new Uint8Array([0, 255, 16, 171]));
  });

  it('roundtrips correctly', () => {
    const original = new Uint8Array([0, 1, 127, 128, 254, 255]);
    const hex = toHex(original);
    const decoded = fromHex(hex);
    expect(decoded).toEqual(original);
  });

  it('handles empty input', () => {
    expect(toHex(new Uint8Array([]))).toBe('');
    expect(fromHex('')).toEqual(new Uint8Array([]));
  });
});
