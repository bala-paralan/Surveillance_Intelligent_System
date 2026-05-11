import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../../src/crypto.js';

describe('crypto', () => {
  it('round-trips ASCII plaintext', () => {
    const plain = 'rtsp://camera.example.com:554/stream';
    const cipher = encrypt(plain);
    expect(cipher).toContain(':');
    expect(cipher).not.toContain(plain);
    expect(decrypt(cipher)).toBe(plain);
  });

  it('round-trips unicode plaintext', () => {
    const plain = 'pwd-🔐-żółć';
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const a = encrypt('same');
    const b = encrypt('same');
    expect(a).not.toBe(b);
  });

  it('throws on malformed ciphertext (no separator)', () => {
    expect(() => decrypt('nope')).toThrow(/Invalid ciphertext/);
  });

  it('throws on malformed ciphertext (missing parts)', () => {
    expect(() => decrypt(':')).toThrow(/Invalid ciphertext/);
  });

  it('throws when IV or payload is not valid hex', () => {
    // valid format pattern but garbage hex
    expect(() => decrypt('zz:zz')).toThrow();
  });
});
