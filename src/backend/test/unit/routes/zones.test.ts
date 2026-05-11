import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prismaStub, resetPrismaStub } from '../../utils/prisma-stub.js';

vi.mock('../../../src/db.js', () => ({ prisma: prismaStub }));

// Stub global fetch so analytics forwarding is captured + controllable
const originalFetch = globalThis.fetch;
const fetchSpy = vi.fn();
beforeEach(() => {
  fetchSpy.mockReset();
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

const { zoneRoutes } = await import('../../../src/routes/zones.js');
const { buildTestApp } = await import('../../utils/test-app.js');
const { bearer } = await import('../../utils/auth-helpers.js');

const validPolygon: [number, number][] = [[0, 0], [1, 0], [1, 1]];

describe('routes/zones', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    resetPrismaStub();
    app = await buildTestApp(zoneRoutes);
  });
  afterEach(async () => { await app.close(); });

  it('GET /cameras/:cameraId/zones requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/cameras/c1/zones' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /cameras/:cameraId/zones → 404 when camera missing', async () => {
    prismaStub.camera.findUnique.mockResolvedValue(null);
    const res = await app.inject({
      method: 'GET', url: '/cameras/c1/zones',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET /cameras/:cameraId/zones returns zone list', async () => {
    prismaStub.camera.findUnique.mockResolvedValue({ id: 'c1' });
    prismaStub.cameraZone.findMany.mockResolvedValue([
      { zoneId: 'z1', cameraId: 'c1', label: 'door', polygon: validPolygon, createdAt: new Date(), updatedAt: new Date() },
    ]);
    const res = await app.inject({
      method: 'GET', url: '/cameras/c1/zones',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().zones[0].zoneId).toBe('z1');
  });

  it('GET /cameras/:cameraId/zones propagates errors → 500', async () => {
    prismaStub.camera.findUnique.mockRejectedValue(new Error('db'));
    const res = await app.inject({
      method: 'GET', url: '/cameras/c1/zones',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(500);
  });

  it('POST /cameras/:cameraId/zones requires OPERATOR+', async () => {
    const res = await app.inject({
      method: 'POST', url: '/cameras/c1/zones',
      headers: { authorization: bearer({ role: 'VIEWER' }) },
      payload: { zones: [] },
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST /cameras/:cameraId/zones → 400 on invalid body', async () => {
    const res = await app.inject({
      method: 'POST', url: '/cameras/c1/zones',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { zones: [{ zoneId: '', polygon: [] }] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /cameras/:cameraId/zones → 404 when camera missing', async () => {
    prismaStub.camera.findUnique.mockResolvedValue(null);
    const res = await app.inject({
      method: 'POST', url: '/cameras/c1/zones',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { zones: [{ zoneId: 'z1', polygon: validPolygon }] },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /cameras/:cameraId/zones upserts and forwards to analytics', async () => {
    prismaStub.camera.findUnique.mockResolvedValue({ id: 'c1' });
    prismaStub.cameraZone.deleteMany.mockResolvedValue({ count: 0 });
    prismaStub.cameraZone.upsert.mockResolvedValue({});
    fetchSpy.mockResolvedValue(new Response('{}', { status: 200 }));

    const res = await app.inject({
      method: 'POST', url: '/cameras/c1/zones',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { zones: [
        { zoneId: 'z1', polygon: validPolygon, label: 'gate' },
        { zoneId: 'z2', polygon: validPolygon },
      ] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().registered).toBe(2);
    // analytics call happens after response (fire-and-forget) — give microtasks a tick
    await new Promise((r) => setImmediate(r));
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('POST /cameras/:cameraId/zones logs warning on analytics non-2xx', async () => {
    prismaStub.camera.findUnique.mockResolvedValue({ id: 'c1' });
    prismaStub.cameraZone.deleteMany.mockResolvedValue({ count: 0 });
    prismaStub.cameraZone.upsert.mockResolvedValue({});
    fetchSpy.mockResolvedValue(new Response('err', { status: 500 }));
    const res = await app.inject({
      method: 'POST', url: '/cameras/c1/zones',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { zones: [{ zoneId: 'z1', polygon: validPolygon }] },
    });
    expect(res.statusCode).toBe(200);
    await new Promise((r) => setImmediate(r));
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('POST /cameras/:cameraId/zones tolerates analytics fetch failure', async () => {
    prismaStub.camera.findUnique.mockResolvedValue({ id: 'c1' });
    prismaStub.cameraZone.deleteMany.mockResolvedValue({ count: 0 });
    prismaStub.cameraZone.upsert.mockResolvedValue({});
    fetchSpy.mockRejectedValue(new Error('network down'));
    const res = await app.inject({
      method: 'POST', url: '/cameras/c1/zones',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { zones: [{ zoneId: 'z1', polygon: validPolygon }] },
    });
    expect(res.statusCode).toBe(200);
    await new Promise((r) => setImmediate(r));
  });

  it('POST /cameras/:cameraId/zones propagates transaction errors → 500', async () => {
    prismaStub.camera.findUnique.mockResolvedValue({ id: 'c1' });
    prismaStub.$transaction.mockRejectedValueOnce(new Error('db boom'));
    const res = await app.inject({
      method: 'POST', url: '/cameras/c1/zones',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { zones: [{ zoneId: 'z1', polygon: validPolygon }] },
    });
    expect(res.statusCode).toBe(500);
  });
});
