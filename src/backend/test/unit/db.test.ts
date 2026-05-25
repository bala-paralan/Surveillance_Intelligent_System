import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub out PrismaClient before importing db.ts so we capture the registered
// 'error' listener and can invoke it manually.
type ErrorEvent = { message: string; target: string };
const handlers = new Map<string, (e: ErrorEvent) => void>();

vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    $on(event: string, fn: (e: ErrorEvent) => void) {
      handlers.set(event, fn);
    }
  },
}));

const logSpy = vi.fn();
vi.mock('../../src/logger.js', () => ({
  logger: { error: (...args: unknown[]) => logSpy(...args), info: vi.fn() },
}));

describe('db', () => {
  beforeEach(() => {
    logSpy.mockReset();
    handlers.clear();
  });

  it('registers an error handler that logs through pino', async () => {
    await import('../../src/db.js');
    const handler = handlers.get('error');
    expect(handler).toBeTypeOf('function');

    handler!({ message: 'boom', target: 'camera' });

    expect(logSpy).toHaveBeenCalledOnce();
    const [obj, label] = logSpy.mock.calls[0]!;
    expect(obj).toEqual({ msg: 'boom', target: 'camera' });
    expect(label).toBe('Prisma error');
  });
});
