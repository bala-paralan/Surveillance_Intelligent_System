import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prismaStub, resetPrismaStub } from '../../utils/prisma-stub.js';

vi.mock('../../../src/db.js', () => ({ prisma: prismaStub }));

const runGisSyncSpy = vi.fn();
vi.mock('../../../src/services/gis-sync-service.js', () => ({
  runGisSync: (...a: unknown[]) => runGisSyncSpy(...a),
  GeoPackageMockSource: class { fetchAll = async () => ({ bops: [], zones: [], assets: [] }); },
}));

const { bopRoutes } = await import('../../../src/routes/bop.js');
const { buildTestApp } = await import('../../utils/test-app.js');
const { bearer } = await import('../../utils/auth-helpers.js');

describe('routes/bop', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    resetPrismaStub();
    runGisSyncSpy.mockReset();
    app = await buildTestApp(bopRoutes);
  });
  afterEach(async () => { await app.close(); });

  it('GET /bop requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/bop' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /bop returns list (VIEWER+)', async () => {
    prismaStub.bop.findMany.mockResolvedValue([{ id: 'b1', code: 'ALPHA', name: 'Alpha' }]);
    const res = await app.inject({
      method: 'GET',
      url: '/bop',
      headers: { authorization: bearer({ role: 'VIEWER' }) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ id: 'b1', code: 'ALPHA', name: 'Alpha' }]);
  });

  it('GET /bop propagates DB errors → 500', async () => {
    prismaStub.bop.findMany.mockRejectedValue(new Error('db down'));
    const res = await app.inject({
      method: 'GET',
      url: '/bop',
      headers: { authorization: bearer({ role: 'VIEWER' }) },
    });
    expect(res.statusCode).toBe(500);
  });

  it('GET /bop/sync/logs returns last 20 (ENGINEER allowed)', async () => {
    prismaStub.gisSyncLog.findMany.mockResolvedValue([{ id: 'g1', status: 'done' }]);
    const res = await app.inject({
      method: 'GET',
      url: '/bop/sync/logs',
      headers: { authorization: bearer({ role: 'ENGINEER' }) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ id: 'g1', status: 'done' }]);
  });

  it('GET /bop/sync/logs rejected for VIEWER', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/bop/sync/logs',
      headers: { authorization: bearer({ role: 'VIEWER' }) },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /bop/sync/logs propagates DB errors → 500', async () => {
    prismaStub.gisSyncLog.findMany.mockRejectedValue(new Error('boom'));
    const res = await app.inject({
      method: 'GET',
      url: '/bop/sync/logs',
      headers: { authorization: bearer({ role: 'ENGINEER' }) },
    });
    expect(res.statusCode).toBe(500);
  });

  it('GET /bop/:id returns the bop with zones (ADMIN passes scope check)', async () => {
    prismaStub.bop.findUnique.mockResolvedValue({ id: 'b1', code: 'ALPHA', name: 'Alpha', bopZones: [] });
    const res = await app.inject({
      method: 'GET',
      url: '/bop/b1',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe('b1');
  });

  it('GET /bop/:id → 404 when not found', async () => {
    prismaStub.bop.findUnique.mockResolvedValue(null);
    const res = await app.inject({
      method: 'GET',
      url: '/bop/b1',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET /bop/:id rejected when out of scope (non-ADMIN)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/bop/b1',
      headers: { authorization: bearer({ role: 'OPERATOR', scope: { bop_ids: ['other'], zone_ids: [] } }) },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /bop/:id propagates DB errors → 500', async () => {
    prismaStub.bop.findUnique.mockRejectedValue(new Error('db'));
    const res = await app.inject({
      method: 'GET',
      url: '/bop/b1',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
    });
    expect(res.statusCode).toBe(500);
  });

  it('GET /bop/:id/zones returns zone list', async () => {
    prismaStub.bop.findUnique.mockResolvedValue({ id: 'b1' });
    prismaStub.bopZone.findMany.mockResolvedValue([{ id: 'z1', code: 'A-Z1', name: 'Z1', parentZoneId: null, sensors: [] }]);
    const res = await app.inject({
      method: 'GET',
      url: '/bop/b1/zones',
      headers: { authorization: bearer({ role: 'VIEWER' }) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ id: 'z1', code: 'A-Z1', name: 'Z1', parentZoneId: null, sensors: [] }]);
  });

  it('GET /bop/:id/zones → 404 when bop missing', async () => {
    prismaStub.bop.findUnique.mockResolvedValue(null);
    const res = await app.inject({
      method: 'GET',
      url: '/bop/b1/zones',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET /bop/:id/zones propagates errors → 500', async () => {
    prismaStub.bop.findUnique.mockRejectedValue(new Error('x'));
    const res = await app.inject({
      method: 'GET',
      url: '/bop/b1/zones',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(500);
  });

  it('POST /bop/sync → 202 (ADMIN) and runGisSync runs in background', async () => {
    let resolveSync: () => void;
    runGisSyncSpy.mockImplementation(() => new Promise<void>((resolve) => { resolveSync = resolve; }));
    const res = await app.inject({
      method: 'POST',
      url: '/bop/sync',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
    });
    expect(res.statusCode).toBe(202);
    expect(runGisSyncSpy).toHaveBeenCalled();
    resolveSync!();
  });

  it('POST /bop/sync rejected for OPERATOR', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/bop/sync',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST /bop/sync handles background GIS sync rejection without crashing', async () => {
    runGisSyncSpy.mockRejectedValue(new Error('sync failed'));
    const res = await app.inject({
      method: 'POST',
      url: '/bop/sync',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
    });
    expect(res.statusCode).toBe(202);
  });
});
