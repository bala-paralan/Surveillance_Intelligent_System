import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prismaStub, resetPrismaStub } from '../../utils/prisma-stub.js';

vi.mock('../../../src/db.js', () => ({ prisma: prismaStub }));

// Force the redis dynamic import path to throw — exercises the catch branch.
vi.mock('redis', () => {
  throw new Error('redis not installed');
});

const { aoiRoutes } = await import('../../../src/routes/aoi.js');
const { buildTestApp } = await import('../../utils/test-app.js');
const { bearer } = await import('../../utils/auth-helpers.js');

const validRing = [
  [0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5], [0, 0],
];
const validGeometry = { type: 'Polygon' as const, coordinates: [validRing] };
const geomJson = JSON.stringify(validGeometry);

describe('routes/aoi', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    resetPrismaStub();
    app = await buildTestApp(aoiRoutes);
  });
  afterEach(async () => { await app.close(); });

  it('GET /aoi requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/aoi' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /aoi returns list', async () => {
    prismaStub.aoi.findMany.mockResolvedValue([
      { id: 'a1', name: 'AOI', bopZoneId: null, geometryJson: geomJson, createdById: 'u', createdAt: new Date(), updatedAt: new Date() },
    ]);
    const res = await app.inject({ method: 'GET', url: '/aoi', headers: { authorization: bearer() } });
    expect(res.statusCode).toBe(200);
    expect(res.json().aois.length).toBe(1);
  });

  it('GET /aoi accepts bopZoneId filter', async () => {
    prismaStub.aoi.findMany.mockResolvedValue([]);
    const res = await app.inject({ method: 'GET', url: '/aoi?bopZoneId=z1', headers: { authorization: bearer() } });
    expect(res.statusCode).toBe(200);
    expect(prismaStub.aoi.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ bopZoneId: 'z1' }) })
    );
  });

  it('GET /aoi rejects invalid query (array value for string field)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/aoi?bopZoneId=a&bopZoneId=b',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /aoi propagates DB errors → 500', async () => {
    prismaStub.aoi.findMany.mockRejectedValue(new Error('boom'));
    const res = await app.inject({ method: 'GET', url: '/aoi', headers: { authorization: bearer() } });
    expect(res.statusCode).toBe(500);
  });

  it('POST /aoi creates an AOI (OPERATOR) and emits redis event (best-effort)', async () => {
    prismaStub.aoi.create.mockResolvedValue({
      id: 'a1', name: 'AOI', bopZoneId: null, geometryJson: geomJson,
      createdById: 'u1', createdAt: new Date(), updatedAt: new Date(),
    });
    const res = await app.inject({
      method: 'POST', url: '/aoi',
      headers: { authorization: bearer({ role: 'OPERATOR', sub: 'u1' }) },
      payload: { name: 'AOI', geometry: validGeometry },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().aoi.id).toBe('a1');
  });

  it('POST /aoi → 400 with invalid geometry (too few vertices)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/aoi',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { name: 'AOI', geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] } },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /aoi → 400 with no rings', async () => {
    const res = await app.inject({
      method: 'POST', url: '/aoi',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { name: 'AOI', geometry: { type: 'Polygon', coordinates: [] } },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /aoi → 400 when polygon exceeds 1000 vertices', async () => {
    const tooMany = Array.from({ length: 1001 }, (_, i) => [i, i]);
    tooMany.push([0, 0]);
    const res = await app.inject({
      method: 'POST', url: '/aoi',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { name: 'AOI', geometry: { type: 'Polygon', coordinates: [tooMany] } },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /aoi propagates DB errors → 500', async () => {
    prismaStub.aoi.create.mockRejectedValue(new Error('boom'));
    const res = await app.inject({
      method: 'POST', url: '/aoi',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { name: 'AOI', geometry: validGeometry },
    });
    expect(res.statusCode).toBe(500);
  });

  it('POST /aoi rejected for VIEWER', async () => {
    const res = await app.inject({
      method: 'POST', url: '/aoi',
      headers: { authorization: bearer({ role: 'VIEWER' }) },
      payload: { name: 'AOI', geometry: validGeometry },
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST /aoi/import imports a FeatureCollection (skips invalid features)', async () => {
    prismaStub.aoi.create.mockResolvedValue({});
    const res = await app.inject({
      method: 'POST', url: '/aoi/import',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
      payload: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { name: 'Imported A', bopZoneId: 'z1' }, geometry: validGeometry },
          { type: 'Feature', properties: null, geometry: validGeometry }, // null properties → name fallback
          { type: 'Feature', properties: { name: '' }, geometry: validGeometry }, // empty name → fallback
          { type: 'Feature', properties: null, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] } }, // invalid geom → skipped
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ created: 3, skipped: 1 });
  });

  it('POST /aoi/import → 400 on non-FeatureCollection body', async () => {
    const res = await app.inject({
      method: 'POST', url: '/aoi/import',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
      payload: { foo: 'bar' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /aoi/import propagates DB errors → 500', async () => {
    prismaStub.aoi.create.mockRejectedValue(new Error('boom'));
    const res = await app.inject({
      method: 'POST', url: '/aoi/import',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
      payload: {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: { name: 'X' }, geometry: validGeometry }],
      },
    });
    expect(res.statusCode).toBe(500);
  });

  it('PATCH /aoi/:id updates name+geometry+bopZoneId (ADMIN)', async () => {
    prismaStub.aoi.findUnique.mockResolvedValue({ id: 'a1', deletedAt: null });
    prismaStub.aoi.update.mockResolvedValue({
      id: 'a1', name: 'New', bopZoneId: null, geometryJson: geomJson,
      createdById: 'u', createdAt: new Date(), updatedAt: new Date(),
    });
    const res = await app.inject({
      method: 'PATCH', url: '/aoi/a1',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
      payload: { name: 'New', bopZoneId: null, geometry: validGeometry },
    });
    expect(res.statusCode).toBe(200);
  });

  it('PATCH /aoi/:id → 404 when missing or deleted', async () => {
    prismaStub.aoi.findUnique.mockResolvedValue({ id: 'a1', deletedAt: new Date() });
    const res = await app.inject({
      method: 'PATCH', url: '/aoi/a1',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
      payload: { name: 'X' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /aoi/:id → 400 on invalid body', async () => {
    const res = await app.inject({
      method: 'PATCH', url: '/aoi/a1',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
      payload: { name: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('DELETE /aoi/:id (ADMIN) soft-deletes', async () => {
    prismaStub.aoi.findUnique.mockResolvedValue({ id: 'a1', deletedAt: null });
    prismaStub.aoi.update.mockResolvedValue({});
    const res = await app.inject({
      method: 'DELETE', url: '/aoi/a1',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
    });
    expect(res.statusCode).toBe(204);
  });

  it('DELETE /aoi/:id → 404 when already deleted', async () => {
    prismaStub.aoi.findUnique.mockResolvedValue({ id: 'a1', deletedAt: new Date() });
    const res = await app.inject({
      method: 'DELETE', url: '/aoi/a1',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
    });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /aoi/:id rejected for OPERATOR', async () => {
    const res = await app.inject({
      method: 'DELETE', url: '/aoi/a1',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /aoi/:id/export emits a GeoJSON FeatureCollection', async () => {
    prismaStub.aoi.findUnique.mockResolvedValue({
      id: 'a1', name: 'AOI', bopZoneId: null, geometryJson: geomJson,
      createdById: 'u', createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
    });
    const res = await app.inject({
      method: 'GET', url: '/aoi/a1/export',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/geo+json');
    expect(JSON.parse(res.body).type).toBe('FeatureCollection');
  });

  it('GET /aoi/:id/export → 404 when soft-deleted', async () => {
    prismaStub.aoi.findUnique.mockResolvedValue({
      id: 'a1', name: 'AOI', bopZoneId: null, geometryJson: geomJson,
      createdById: 'u', createdAt: new Date(), updatedAt: new Date(), deletedAt: new Date(),
    });
    const res = await app.inject({
      method: 'GET', url: '/aoi/a1/export',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /aoi/:id propagates DB errors → 500', async () => {
    prismaStub.aoi.findUnique.mockRejectedValue(new Error('db'));
    const res = await app.inject({
      method: 'DELETE', url: '/aoi/a1',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
    });
    expect(res.statusCode).toBe(500);
  });

  it('PATCH /aoi/:id propagates DB errors → 500', async () => {
    prismaStub.aoi.findUnique.mockRejectedValue(new Error('db'));
    const res = await app.inject({
      method: 'PATCH', url: '/aoi/a1',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
      payload: { name: 'New' },
    });
    expect(res.statusCode).toBe(500);
  });

  it('GET /aoi/:id/export propagates DB errors → 500', async () => {
    prismaStub.aoi.findUnique.mockRejectedValue(new Error('db'));
    const res = await app.inject({
      method: 'GET', url: '/aoi/a1/export',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(500);
  });
});
