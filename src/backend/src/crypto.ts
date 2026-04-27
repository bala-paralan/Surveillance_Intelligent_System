/**
 * AES-256-CBC encryption helpers for camera credentials.
 * Key is loaded from ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { config } from './config.js';

const KEY = Buffer.from(config.ENCRYPTION_KEY, 'hex');

/** Encrypt plaintext → "ivHex:ciphertextHex" */
export const encrypt = (plaintext: string): string => {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
};

/** Decrypt "ivHex:ciphertextHex" → plaintext */
export const decrypt = (ciphertext: string): string => {
  const [ivHex, encHex] = ciphertext.split(':');
  if (!ivHex || !encHex) throw new Error('Invalid ciphertext format');
  const iv = Buffer.from(ivHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', KEY, iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
};
