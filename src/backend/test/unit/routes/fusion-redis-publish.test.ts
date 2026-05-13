import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prismaStub, resetPrismaStub } from '../../utils/prisma-stub.js';

vi.mock('../../../src/db.js', () => ({ prisma: prismaStub }));

const connectSpy = vi.fn();
const publishSpy = vi.fn();
const disconnectSpy = vi.fn();

vi.mock('redis', () => ({
  createClient: () => ({
    connect:    connectSpy,
    publish:    publishSpy,
    disconnect: disconnectSpy,
  }),
}));

const { fusionRoutes } = await import('../../../src/routes/fusion.js');
const { buildTestApp } = await import('../../utils/test-app.js');
const { bearer } = await import('../../utils/auth-helpers.js');

describe('routes/fusion — Redis publish branch', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    resetPrismaStub();
    connectSpy.mockReset().mockResolvedValue(undefined);
    publishSpy.mockReset().mockResolvedValue(undefined);
    disconnectSpy.mockReset().mockResolvedValue(undefined);
    app = await buildTestApp(fusionRoutes);
  });
  afterEach(async () => { await app.close(); });

  it('POST /fusion/outcomes publishes alert:new on high confidence', async () => {
    prismaStub.fusionOutcome.create.mockResolvedValue({
      id: 'o1', aoiId: 'a1', outcomeClass: 'tunnel', confidence: 0.95,
      supportingEventIds: [], renderHint: {}, firstSeen: new Date(), lastSeen: new Date(), createdAt: new Date(),
    });
    const res = await app.inject({
      method: 'POST', url: '/fusion/outcomes',
      headers: { authorization: bearer({ role: 'ENGINEER' }) },
      payload: {
        aoiId: 'a1', outcomeClass: 'tunnel', confidence: 0.95,
        firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(),
      },
    });
    expect(res.statusCode).toBe(201);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(publishSpy).toHaveBeenCalledWith('alert:new', expect.any(String));
  });
});
