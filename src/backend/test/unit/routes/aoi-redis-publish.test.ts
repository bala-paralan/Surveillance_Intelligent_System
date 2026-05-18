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

const { aoiRoutes } = await import('../../../src/routes/aoi.js');
const { buildTestApp } = await import('../../utils/test-app.js');
const { bearer } = await import('../../utils/auth-helpers.js');

const validRing = [[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5], [0, 0]];
const validGeometry = { type: 'Polygon' as const, coordinates: [validRing] };
const geomJson = JSON.stringify(validGeometry);

describe('routes/aoi — Redis publish branch', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    resetPrismaStub();
    connectSpy.mockReset().mockResolvedValue(undefined);
    publishSpy.mockReset().mockResolvedValue(undefined);
    disconnectSpy.mockReset().mockResolvedValue(undefined);
    app = await buildTestApp(aoiRoutes);
  });
  afterEach(async () => { await app.close(); });

  it('POST /aoi publishes to Redis when client is available', async () => {
    prismaStub.aoi.create.mockResolvedValue({
      id: 'a1', name: 'AOI', bopZoneId: null, geometryJson: geomJson,
      createdById: 'u', createdAt: new Date(), updatedAt: new Date(),
    });
    const res = await app.inject({
      method: 'POST', url: '/aoi',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { name: 'AOI', geometry: validGeometry },
    });
    expect(res.statusCode).toBe(201);
    expect(connectSpy).toHaveBeenCalled();
    expect(publishSpy).toHaveBeenCalledWith('aoi:created', expect.any(String));
  });
});
