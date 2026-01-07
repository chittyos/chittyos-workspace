import { describe, it, expect } from 'vitest';
import {
  generateKeyPair,
  sign,
  verify,
  exportJwk,
  importPublicJwk,
  signBase64Url,
} from '../src/ed25519';

describe('Ed25519', () => {
  it('generates keys, signs and verifies with raw bytes', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const msg = 'hello chitty';
    const sig = await sign(privateKey, msg);
    const ok = await verify(publicKey, sig, msg);
    expect(ok).toBe(true);
  });

  it('signs and verifies with Base64URL encoding', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const msg = 'test message for base64url';
    const sigUrl = await signBase64Url(privateKey, msg);
    expect(typeof sigUrl).toBe('string');
    expect(sigUrl).not.toContain('+');
    expect(sigUrl).not.toContain('/');
    expect(sigUrl).not.toContain('=');

    const ok = await verify(publicKey, sigUrl, msg);
    expect(ok).toBe(true);
  });

  it('exports and imports JWK public keys', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const msg = 'jwk roundtrip test';
    const sig = await sign(privateKey, msg);

    const jwk = await exportJwk(publicKey);
    expect(jwk.kty).toBe('OKP');
    expect(jwk.crv).toBe('Ed25519');
    expect(jwk.x).toBeDefined();

    const imported = await importPublicJwk(jwk);
    const ok = await verify(imported, sig, msg);
    expect(ok).toBe(true);
  });

  it('rejects invalid signatures', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const msg = 'original message';
    const sig = await sign(privateKey, msg);

    const ok = await verify(publicKey, sig, 'tampered message');
    expect(ok).toBe(false);
  });

  it('works with Uint8Array input', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const sig = await sign(privateKey, data);
    const ok = await verify(publicKey, sig, data);
    expect(ok).toBe(true);
  });
});
