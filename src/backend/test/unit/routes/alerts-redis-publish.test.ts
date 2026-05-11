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

const { alertRoutes } = await import('../../../src/routes/alerts.js');
const { buildTestApp } = await import('../../utils/test-app.js');
const { bearer } = await import('../../utils/auth-helpers.js');

describe('routes/alerts — Redis publish branch', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    resetPrismaStub();
    connectSpy.mockReset().mockResolvedValue(undefined);
    publishSpy.mockReset().mockResolvedValue(undefined);
    disconnectSpy.mockReset().mockResolvedValue(undefined);
    app = await buildTestApp(alertRoutes);
  });
  afterEach(async () => { await app.close(); });

  it('POST /alerts publishes to Redis when redis client is available', async () => {
    prismaStub.alert.create.mockResolvedValue({
      id: 'a1', type: 'INTRUSION', severity: 'MEDIUM',
      cameraId: null, bopZoneId: null, aoiId: null,
      message: 'm', acknowledged: false, acknowledgedBy: null,
      acknowledgedAt: null, resolvedAt: null, createdAt: new Date(),
    });
    const res = await app.inject({
      method: 'POST', url: '/alerts',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { message: 'A motion alert' },
    });
    expect(res.statusCode).toBe(201);
    // Background publish runs after response — wait a tick
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(connectSpy).toHaveBeenCalled();
    expect(publishSpy).toHaveBeenCalledWith('alerts:new', expect.any(String));
    expect(disconnectSpy).toHaveBeenCalled();
  });
});
