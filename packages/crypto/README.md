# @pkg/crypto

ChittyOS cryptographic primitives for signing, verification, and canonical serialization.

## Features

- **Ed25519 Digital Signatures** - Web Crypto based, works in Node.js 18+, Cloudflare Workers, and browsers
- **RFC 8785 JSON Canonicalization (JCS)** - Deterministic JSON serialization for cryptographic use
- **Base64/Base64URL Encoding** - Standard and URL-safe encoding utilities

## Installation

```bash
# Within the monorepo
pnpm add @pkg/crypto
```

## Usage

### Ed25519 Signing

```typescript
import { Ed25519 } from '@pkg/crypto';

// Generate a key pair
const { publicKey, privateKey } = await Ed25519.generateKeyPair();

// Sign a message
const signature = await Ed25519.signBase64Url(privateKey, 'message to sign');

// Verify
const valid = await Ed25519.verify(publicKey, signature, 'message to sign');

// Export/import JWK for key persistence
const jwk = await Ed25519.exportJwk(publicKey);
const restored = await Ed25519.importPublicJwk(jwk);
```

### JSON Canonicalization (JCS)

```typescript
import { JCS } from '@pkg/crypto';

// Canonicalize JSON (RFC 8785 compliant)
const canonical = JCS.canonicalizeJson('{"b":2,"a":1}');
// Result: '{"a":1,"b":2}'

// Canonicalize and hash in one step
const result = await JCS.canonicalizeAndHash({
  type: 'json',
  content: '{"b":2,"a":1}'
});
// result.canonical = '{"a":1,"b":2}'
// result.hash = 'sha256:...'

// Also supports YAML and text
const yamlResult = await JCS.canonicalizeAndHash({
  type: 'yaml',
  content: 'key: value\n'
});
```

### Base64 Utilities

```typescript
import { Base64 } from '@pkg/crypto';

// Standard Base64
const encoded = Base64.toBase64(new Uint8Array([1, 2, 3]));
const decoded = Base64.fromBase64(encoded);

// URL-safe Base64 (no padding, - and _ instead of + and /)
const urlSafe = Base64.toBase64Url(new Uint8Array([1, 2, 3]));
const fromUrl = Base64.fromBase64Url(urlSafe);

// Hex encoding
const hex = Base64.toHex(new Uint8Array([255, 0, 127]));
const fromHex = Base64.fromHex(hex);
```

## Complete Example: Sign Canonical JSON

```typescript
import { Ed25519, JCS } from '@pkg/crypto';

// 1. Canonicalize the payload
const payload = { timestamp: Date.now(), action: 'create', data: { id: 123 } };
const result = await JCS.canonicalizeAndHash({
  type: 'json',
  content: JSON.stringify(payload)
});

// 2. Sign the canonical content
const { publicKey, privateKey } = await Ed25519.generateKeyPair();
const signature = await Ed25519.signBase64Url(privateKey, result.canonical);

// 3. Create signed envelope
const signedEnvelope = {
  payload: result.canonical,
  hash: result.hash,
  signature,
  publicKey: await Ed25519.exportJwk(publicKey)
};

// 4. Verify on receiving end
const pubKey = await Ed25519.importPublicJwk(signedEnvelope.publicKey);
const verified = await Ed25519.verify(
  pubKey,
  signedEnvelope.signature,
  signedEnvelope.payload
);
```

## API Reference

### Ed25519

| Function | Description |
|----------|-------------|
| `generateKeyPair()` | Generate Ed25519 public/private key pair |
| `sign(privateKey, data)` | Sign data, returns `Uint8Array` |
| `signBase64Url(privateKey, data)` | Sign data, returns Base64URL string |
| `verify(publicKey, signature, data)` | Verify signature, returns `boolean` |
| `exportJwk(key)` | Export key to JWK format |
| `importPublicJwk(jwk)` | Import public key from JWK |
| `importPrivateJwk(jwk)` | Import private key from JWK |

### JCS

| Function | Description |
|----------|-------------|
| `canonicalizeJson(jsonString)` | RFC 8785 canonicalize JSON string |
| `canonicalizeValue(value)` | RFC 8785 canonicalize JS value |
| `canonicalizeYaml(yamlString)` | Parse YAML and canonicalize as JSON |
| `canonicalizeText(text)` | Normalize line endings and whitespace |
| `sha256(data)` | Compute SHA-256 hash as hex string |
| `canonicalizeAndHash(input)` | Canonicalize and hash in one call |

### Base64

| Function | Description |
|----------|-------------|
| `toBase64(bytes)` | Encode to standard Base64 |
| `fromBase64(string)` | Decode from standard Base64 |
| `toBase64Url(bytes)` | Encode to URL-safe Base64 (no padding) |
| `fromBase64Url(string)` | Decode from URL-safe Base64 |
| `toHex(bytes)` | Encode to hexadecimal |
| `fromHex(string)` | Decode from hexadecimal |

## Compatibility

- Node.js 18+ (uses native Web Crypto)
- Cloudflare Workers
- Modern browsers with Web Crypto API

## Related Packages

- **ChittyChain** - Uses this for blockchain entry signing
- **ChittyCert** - Uses this for certificate operations
- **ChittyVerify** - Uses this for evidence verification
