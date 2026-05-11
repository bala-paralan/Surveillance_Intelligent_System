import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { config, corsOrigins } from '../../src/config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// Resolve the backend tsx binary
const tsxBin = path.resolve(here, '..', '..', 'node_modules', '.bin', 'tsx');
const configPath = path.resolve(here, '..', '..', 'src', 'config.ts');

describe('config', () => {
  it('parses valid env (from setup-env.ts) into a typed config object', () => {
    expect(config.PORT).toBe(3001);
    expect(config.HOST).toBe('0.0.0.0');
    expect(config.JWT_ACCESS_TTL).toBe(900);
    expect(config.JWT_REFRESH_TTL).toBe(604800);
    expect(config.ENCRYPTION_KEY).toHaveLength(64);
  });

  it('splits CORS_ORIGINS into a trimmed string array', () => {
    expect(corsOrigins).toContain('http://localhost:3000');
    expect(corsOrigins.every((s) => s === s.trim())).toBe(true);
  });

  it('rejects invalid env in a fresh process and exits with non-zero code', () => {
    // Spawn a fresh tsx subprocess that imports config.ts with broken env.
    // The module-level safeParse fails → process.exit(1) is invoked.
    const result = spawnSync(tsxBin, [configPath], {
      env: {
        PATH: process.env['PATH'],
        DATABASE_URL: 'not-a-url',
        JWT_ACCESS_SECRET: 'short',
        JWT_REFRESH_SECRET: 'short',
        ENCRYPTION_KEY: 'too-short',
      },
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toMatch(/Invalid environment variables/i);
  }, 40_000);
});
