import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prismaStub, resetPrismaStub } from '../../utils/prisma-stub.js';

vi.mock('../../../src/db.js', () => ({ prisma: prismaStub }));

const listForAoiSpy = vi.fn();
vi.mock('../../../src/services/catalogue-service.js', async (orig) => {
  const real = await orig() as Record<string, unknown>;
  return {
    ...real,
    listForAoi: (...a: unknown[]) => listForAoiSpy(...a),
  };
});

// Allow toggling the analytics API key for sensor-events tests.
let currentAnalyticsKey = 'test-key';
vi.mock('../../../src/config.js', async (orig) => {
  const real = (await orig()) as { config: Record<string, unknown>; corsOrigins: string[] };
  return {
    ...real,
    config: new Proxy(real.config, {
      get(target, prop) {
        if (prop === 'ANALYTICS_API_KEY') return currentAnalyticsKey;
        return Reflect.get(target, prop);
      },
    }),
  };
});

const { catalogueRoutes } = await import('../../../src/routes/catalogue.js');
const { buildTestApp } = await import('../../utils/test-app.js');
const { bearer } = await import('../../utils/auth-helpers.js');

describe('routes/catalogue', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    resetPrismaStub();
    listForAoiSpy.mockReset();
    currentAnalyticsKey = 'test-key';
    app = await buildTestApp(catalogueRoutes);
  });
  afterEach(async () => { await app.close(); });

  it('GET /aoi/:aoiId/catalogue returns items', async () => {
    listForAoiSpy.mockResolvedValue([{ id: 's1', kind: 'sensor', type: 'SEISMIC', lat: 1, lon: 2, bopZoneId: null, installedOn: 'x', lastHeartbeat: null, health: 'HEALTHY', availableStreams: [] }]);
    const res = await app.inject({ method: 'GET', url: '/aoi/a1/catalogue', headers: { authorization: bearer() } });
    expect(res.statusCode).toBe(200);
    expect(res.json().items.length).toBe(1);
  });

  it('GET /aoi/:aoiId/catalogue propagates errors → 500', async () => {
    listForAoiSpy.mockRejectedValue(new Error('boom'));
    const res = await app.inject({ method: 'GET', url: '/aoi/a1/catalogue', headers: { authorization: bearer() } });
    expect(res.statusCode).toBe(500);
  });

  it('GET /sensors returns paginated list with bopZoneId filter', async () => {
    prismaStub.sensor.findMany.mockResolvedValue([
      { id: 's1', type: 'SEISMIC', lat: 1, lon: 2, bopZoneId: 'z1', installedOn: new Date(), lastHeartbeat: null, health: 'HEALTHY' },
    ]);
    prismaStub.sensor.count.mockResolvedValue(1);
    const res = await app.inject({
      method: 'GET',
      url: '/sensors?bopZoneId=z1',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(1);
  });

  it('GET /sensors returns default-page list with no filter', async () => {
    prismaStub.sensor.findMany.mockResolvedValue([]);
    prismaStub.sensor.count.mockResolvedValue(0);
    const res = await app.inject({
      method: 'GET',
      url: '/sensors',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /sensors → 400 on invalid query', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/sensors?page=0',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /sensors propagates errors → 500', async () => {
    prismaStub.sensor.findMany.mockRejectedValue(new Error('boom'));
    prismaStub.sensor.count.mockRejectedValue(new Error('boom'));
    const res = await app.inject({
      method: 'GET',
      url: '/sensors',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(500);
  });

  it('POST /sensors creates a sensor (ENGINEER)', async () => {
    prismaStub.sensor.create.mockResolvedValue({
      id: 's2', type: 'SEISMIC', lat: 1, lon: 2, bopZoneId: 'z1', installedOn: new Date(), lastHeartbeat: null, health: 'UNKNOWN',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/sensors',
      headers: { authorization: bearer({ role: 'ENGINEER' }) },
      payload: { type: 'SEISMIC', lat: 1, lon: 2, bopZoneId: 'z1', installedOn: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(201);
  });

  it('POST /sensors handles optional bopZoneId omitted', async () => {
    prismaStub.sensor.create.mockResolvedValue({
      id: 's3', type: 'LIDAR', lat: 0, lon: 0, bopZoneId: null, installedOn: new Date(), lastHeartbeat: null, health: 'UNKNOWN',
    });
    const res = await app.inject({
      method: 'POST', url: '/sensors',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
      payload: { type: 'LIDAR', lat: 0, lon: 0, installedOn: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(201);
  });

  it('POST /sensors rejected for VIEWER', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sensors',
      headers: { authorization: bearer({ role: 'VIEWER' }) },
      payload: { type: 'SEISMIC', lat: 1, lon: 2, installedOn: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST /sensors → 400 on invalid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sensors',
      headers: { authorization: bearer({ role: 'ENGINEER' }) },
      payload: { type: 'NOPE', lat: 999, lon: 0, installedOn: 'not-a-date' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /sensors propagates errors → 500', async () => {
    prismaStub.sensor.create.mockRejectedValue(new Error('db'));
    const res = await app.inject({
      method: 'POST',
      url: '/sensors',
      headers: { authorization: bearer({ role: 'ENGINEER' }) },
      payload: { type: 'SEISMIC', lat: 1, lon: 2, installedOn: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(500);
  });

  it('GET /sensors/:id returns sensor', async () => {
    prismaStub.sensor.findUnique.mockResolvedValue({
      id: 's1', type: 'SEISMIC', lat: 0, lon: 0, bopZoneId: null, installedOn: new Date(), lastHeartbeat: null, health: 'HEALTHY',
    });
    const res = await app.inject({
      method: 'GET',
      url: '/sensors/s1',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /sensors/:id → 404 when missing', async () => {
    prismaStub.sensor.findUnique.mockResolvedValue(null);
    const res = await app.inject({
      method: 'GET',
      url: '/sensors/missing',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /sensors/:id/health updates without lastHeartbeat', async () => {
    prismaStub.sensor.findUnique.mockResolvedValue({ id: 's1' });
    prismaStub.sensor.update.mockResolvedValue({
      id: 's1', type: 'SEISMIC', lat: 0, lon: 0, bopZoneId: null, installedOn: new Date(), lastHeartbeat: null, health: 'OFFLINE',
    });
    const res = await app.inject({
      method: 'PATCH',
      url: '/sensors/s1/health',
      headers: { authorization: bearer({ role: 'ENGINEER' }) },
      payload: { health: 'OFFLINE' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('PATCH /sensors/:id/health updates with lastHeartbeat', async () => {
    prismaStub.sensor.findUnique.mockResolvedValue({ id: 's1' });
    prismaStub.sensor.update.mockResolvedValue({
      id: 's1', type: 'SEISMIC', lat: 0, lon: 0, bopZoneId: null,
      installedOn: new Date(), lastHeartbeat: new Date(), health: 'HEALTHY',
    });
    const res = await app.inject({
      method: 'PATCH',
      url: '/sensors/s1/health',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
      payload: { health: 'HEALTHY', lastHeartbeat: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(200);
  });

  it('PATCH /sensors/:id/health → 404 when missing', async () => {
    prismaStub.sensor.findUnique.mockResolvedValue(null);
    const res = await app.inject({
      method: 'PATCH',
      url: '/sensors/missing/health',
      headers: { authorization: bearer({ role: 'ENGINEER' }) },
      payload: { health: 'HEALTHY' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /sensors/:id/health → 400 on invalid body', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/sensors/s1/health',
      headers: { authorization: bearer({ role: 'ENGINEER' }) },
      payload: { health: 'NOPE' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /sensor-events lists with filters', async () => {
    prismaStub.sensorEvent.findMany.mockResolvedValue([
      { id: 'e1', sensorId: 's1', type: 'SEISMIC_TUNNEL', aoiIds: ['a1'], confidence: 0.9, payload: {}, occurredAt: new Date('2024-01-01'), createdAt: new Date('2024-01-01') },
    ]);
    prismaStub.sensorEvent.count.mockResolvedValue(1);
    const res = await app.inject({
      method: 'GET',
      url: '/sensor-events?sensorId=s1&type=SEISMIC_TUNNEL&aoiId=a1&from=2024-01-01T00:00:00Z&to=2024-12-31T23:59:59Z',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(1);
  });

  it('GET /sensor-events with no filters', async () => {
    prismaStub.sensorEvent.findMany.mockResolvedValue([]);
    prismaStub.sensorEvent.count.mockResolvedValue(0);
    const res = await app.inject({
      method: 'GET',
      url: '/sensor-events',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /sensor-events with only from (no to)', async () => {
    prismaStub.sensorEvent.findMany.mockResolvedValue([]);
    prismaStub.sensorEvent.count.mockResolvedValue(0);
    const res = await app.inject({
      method: 'GET',
      url: '/sensor-events?from=2024-01-01T00:00:00Z',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /sensor-events with only to (no from)', async () => {
    prismaStub.sensorEvent.findMany.mockResolvedValue([]);
    prismaStub.sensorEvent.count.mockResolvedValue(0);
    const res = await app.inject({
      method: 'GET',
      url: '/sensor-events?to=2024-12-31T00:00:00Z',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /sensor-events → 400 on bad query', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/sensor-events?limit=-1',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /sensor-events propagates errors → 500', async () => {
    prismaStub.sensorEvent.findMany.mockRejectedValue(new Error('db'));
    prismaStub.sensorEvent.count.mockRejectedValue(new Error('db'));
    const res = await app.inject({
      method: 'GET',
      url: '/sensor-events',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(500);
  });

  it('POST /sensor-events → 503 when API key disabled', async () => {
    currentAnalyticsKey = '';
    const res = await app.inject({
      method: 'POST',
      url: '/sensor-events',
      payload: { sensorId: 's1', type: 'SEISMIC_TUNNEL', confidence: 0.5, payload: {}, occurredAt: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(503);
  });

  it('POST /sensor-events → 401 missing key header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sensor-events',
      payload: { sensorId: 's1', type: 'SEISMIC_TUNNEL', confidence: 0.5, payload: {}, occurredAt: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /sensor-events → 403 wrong key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sensor-events',
      headers: { 'x-analytics-api-key': 'wrong' },
      payload: { sensorId: 's1', type: 'SEISMIC_TUNNEL', confidence: 0.5, payload: {}, occurredAt: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST /sensor-events → 400 on invalid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sensor-events',
      headers: { 'x-analytics-api-key': 'test-key' },
      payload: { sensorId: '', type: 'NOPE' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /sensor-events → 404 when sensor missing', async () => {
    prismaStub.sensor.findUnique.mockResolvedValue(null);
    const res = await app.inject({
      method: 'POST',
      url: '/sensor-events',
      headers: { 'x-analytics-api-key': 'test-key' },
      payload: { sensorId: 's1', type: 'SEISMIC_TUNNEL', confidence: 0.5, payload: {}, occurredAt: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /sensor-events → 201 on success', async () => {
    prismaStub.sensor.findUnique.mockResolvedValue({ id: 's1' });
    prismaStub.sensorEvent.create.mockResolvedValue({ id: 'e1' });
    const res = await app.inject({
      method: 'POST',
      url: '/sensor-events',
      headers: { 'x-analytics-api-key': 'test-key' },
      payload: { sensorId: 's1', type: 'SEISMIC_TUNNEL', confidence: 0.5, payload: { dir: 90 }, occurredAt: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().event.id).toBe('e1');
  });

  it('POST /sensor-events propagates errors → 500', async () => {
    prismaStub.sensor.findUnique.mockResolvedValue({ id: 's1' });
    prismaStub.sensorEvent.create.mockRejectedValue(new Error('db'));
    const res = await app.inject({
      method: 'POST',
      url: '/sensor-events',
      headers: { 'x-analytics-api-key': 'test-key' },
      payload: { sensorId: 's1', type: 'SEISMIC_TUNNEL', confidence: 0.5, payload: {}, occurredAt: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(500);
  });
});
