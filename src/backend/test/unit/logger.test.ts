import { describe, it, expect } from 'vitest';
import { logger } from '../../src/logger.js';

describe('logger', () => {
  it('exports a pino instance with the configured level', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    // LOG_LEVEL=silent is set in test/setup-env.ts
    expect(logger.level).toBe('silent');
  });
});
