import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prismaStub, resetPrismaStub } from '../../utils/prisma-stub.js';

vi.mock('../../../src/db.js', () => ({ prisma: prismaStub }));
// Force redis to be unavailable → exercises the catch path
vi.mock('redis', () => { throw new Error('redis missing'); });

const { alertRoutes } = await import('../../../src/routes/alerts.js');
const { buildTestApp } = await import('../../utils/test-app.js');
const { bearer } = await import('../../utils/auth-helpers.js');

describe('routes/alerts', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    resetPrismaStub();
    app = await buildTestApp(alertRoutes);
  });
  afterEach(async () => { await app.close(); });

  it('GET /alerts/stats requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/alerts/stats' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /alerts/stats returns severity counts', async () => {
    prismaStub.alert.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4);
    const res = await app.inject({
      method: 'GET', url: '/alerts/stats',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ critical: 1, high: 2, medium: 3, low: 4, total: 10 });
  });

  it('GET /alerts/stats propagates errors → 500', async () => {
    prismaStub.alert.count.mockRejectedValue(new Error('db'));
    const res = await app.inject({
      method: 'GET', url: '/alerts/stats',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(500);
  });

  it('GET /alerts returns list with filters', async () => {
    prismaStub.alert.findMany.mockResolvedValue([
      { id: 'a1', type: 'INTRUSION', severity: 'HIGH', cameraId: 'c1', bopZoneId: null, aoiId: null, message: 'ok', acknowledged: false, acknowledgedBy: null, acknowledgedAt: null, resolvedAt: null, createdAt: new Date() },
    ]);
    prismaStub.alert.count.mockResolvedValue(1);
    const res = await app.inject({
      method: 'GET',
      url: '/alerts?acknowledged=true&severity=HIGH&bopZoneId=z1&aoiId=a1&limit=5&offset=0',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().alerts.length).toBe(1);
  });

  it('GET /alerts with no filters', async () => {
    prismaStub.alert.findMany.mockResolvedValue([]);
    prismaStub.alert.count.mockResolvedValue(0);
    const res = await app.inject({
      method: 'GET', url: '/alerts',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /alerts → 400 on invalid query', async () => {
    const res = await app.inject({
      method: 'GET', url: '/alerts?limit=-1',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /alerts propagates errors → 500', async () => {
    prismaStub.alert.findMany.mockRejectedValue(new Error('db'));
    prismaStub.alert.count.mockRejectedValue(new Error('db'));
    const res = await app.inject({
      method: 'GET', url: '/alerts',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(500);
  });

  it('POST /alerts creates an alert', async () => {
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
  });

  it('POST /alerts with full payload', async () => {
    prismaStub.alert.create.mockResolvedValue({
      id: 'a1', type: 'INTRUSION', severity: 'CRITICAL',
      cameraId: 'c1', bopZoneId: 'z1', aoiId: 'aoi1',
      message: 'm', acknowledged: false, acknowledgedBy: null,
      acknowledgedAt: new Date(), resolvedAt: new Date(), createdAt: new Date(),
    });
    const res = await app.inject({
      method: 'POST', url: '/alerts',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
      payload: {
        type: 'INTRUSION', severity: 'CRITICAL',
        cameraId: 'c1', bopZoneId: 'z1', aoiId: 'aoi1',
        message: 'm', metadata: { foo: 'bar' },
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it('POST /alerts → 400 on invalid body', async () => {
    const res = await app.inject({
      method: 'POST', url: '/alerts',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { message: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /alerts rejected for VIEWER', async () => {
    const res = await app.inject({
      method: 'POST', url: '/alerts',
      headers: { authorization: bearer({ role: 'VIEWER' }) },
      payload: { message: 'x' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST /alerts propagates errors → 500', async () => {
    prismaStub.alert.create.mockRejectedValue(new Error('db'));
    const res = await app.inject({
      method: 'POST', url: '/alerts',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { message: 'x' },
    });
    expect(res.statusCode).toBe(500);
  });

  it('PATCH /alerts/:id/acknowledge → 404 when missing', async () => {
    prismaStub.alert.findUnique.mockResolvedValue(null);
    const res = await app.inject({
      method: 'PATCH', url: '/alerts/a1/acknowledge',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
    });
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /alerts/:id/acknowledge succeeds', async () => {
    prismaStub.alert.findUnique.mockResolvedValue({ id: 'a1' });
    prismaStub.alert.update.mockResolvedValue({
      id: 'a1', type: 'INTRUSION', severity: 'MEDIUM',
      cameraId: null, bopZoneId: null, aoiId: null,
      message: 'm', acknowledged: true, acknowledgedBy: 'u',
      acknowledgedAt: new Date(), resolvedAt: null, createdAt: new Date(),
    });
    const res = await app.inject({
      method: 'PATCH', url: '/alerts/a1/acknowledge',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
    });
    expect(res.statusCode).toBe(200);
  });

  it('PATCH /alerts/:id/acknowledge propagates errors → 500', async () => {
    prismaStub.alert.findUnique.mockRejectedValue(new Error('db'));
    const res = await app.inject({
      method: 'PATCH', url: '/alerts/a1/acknowledge',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
    });
    expect(res.statusCode).toBe(500);
  });

  it('PATCH /alerts/:id/resolve → 404 when missing', async () => {
    prismaStub.alert.findUnique.mockResolvedValue(null);
    const res = await app.inject({
      method: 'PATCH', url: '/alerts/a1/resolve',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
    });
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /alerts/:id/resolve succeeds', async () => {
    prismaStub.alert.findUnique.mockResolvedValue({ id: 'a1' });
    prismaStub.alert.update.mockResolvedValue({
      id: 'a1', type: 'INTRUSION', severity: 'MEDIUM',
      cameraId: null, bopZoneId: null, aoiId: null,
      message: 'm', acknowledged: false, acknowledgedBy: null,
      acknowledgedAt: null, resolvedAt: new Date(), createdAt: new Date(),
    });
    const res = await app.inject({
      method: 'PATCH', url: '/alerts/a1/resolve',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
    });
    expect(res.statusCode).toBe(200);
  });

  it('PATCH /alerts/:id/resolve propagates errors → 500', async () => {
    prismaStub.alert.findUnique.mockRejectedValue(new Error('db'));
    const res = await app.inject({
      method: 'PATCH', url: '/alerts/a1/resolve',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
    });
    expect(res.statusCode).toBe(500);
  });
});
