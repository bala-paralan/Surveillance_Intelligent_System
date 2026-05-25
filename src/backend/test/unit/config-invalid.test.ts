/**
 * In-process test for config.ts's invalid-env branch (lines that call
 * console.error + process.exit). The other config tests use a subprocess
 * (which doesn't contribute to coverage instrumentation).
 *
 * Strategy: spy on process.exit before resetting the module cache, then
 * reimport config.ts with invalid env so the safeParse branch executes
 * in-process. process.exit is replaced with a throw so we can intercept.
 */
import { describe, it, expect, vi } from 'vitest';

describe('config — invalid env branch (in-process)', () => {
  it('exits the process when env validation fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`__exit_called__:${code}`);
    }) as never);

    const original = {
      DATABASE_URL:       process.env['DATABASE_URL'],
      JWT_ACCESS_SECRET:  process.env['JWT_ACCESS_SECRET'],
      JWT_REFRESH_SECRET: process.env['JWT_REFRESH_SECRET'],
      ENCRYPTION_KEY:     process.env['ENCRYPTION_KEY'],
    };

    // Force invalid values
    process.env['DATABASE_URL']       = 'not-a-url';
    process.env['JWT_ACCESS_SECRET']  = 'x';
    process.env['JWT_REFRESH_SECRET'] = 'x';
    process.env['ENCRYPTION_KEY']     = 'tooShort';

    vi.resetModules();

    let captured: Error | undefined;
    try {
      await import('../../src/config.js');
    } catch (err) {
      captured = err as Error;
    }

    expect(captured?.message ?? '').toMatch(/__exit_called__:1/);
    expect(errSpy).toHaveBeenCalled();

    // Restore env and module cache for downstream tests
    for (const [k, v] of Object.entries(original)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    vi.resetModules();
    errSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
