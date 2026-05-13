import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prismaStub, resetPrismaStub } from '../../utils/prisma-stub.js';

vi.mock('../../../src/db.js', () => ({ prisma: prismaStub }));

const { recordingRoutes } = await import('../../../src/routes/recordings.js');
const { buildTestApp } = await import('../../utils/test-app.js');
const { bearer } = await import('../../utils/auth-helpers.js');

describe('routes/recordings', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    resetPrismaStub();
    app = await buildTestApp(recordingRoutes);
  });
  afterEach(async () => { await app.close(); });

  it('GET /recordings requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/recordings' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /recordings with all filters', async () => {
    prismaStub.recording.findMany.mockResolvedValue([{
      id: 'r1', cameraId: 'c1', startedAt: new Date(), endedAt: new Date(),
      durationS: 10, storageTier: 'HOT', status: 'STORED',
      fileSizeBytes: BigInt(123), createdAt: new Date(), updatedAt: new Date(),
    }]);
    prismaStub.recording.count.mockResolvedValue(1);
    const res = await app.inject({
      method: 'GET',
      url: '/recordings?cameraId=c1&status=STORED&from=2024-01-01T00:00:00Z&to=2024-12-31T00:00:00Z&page=1&pageSize=20',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().recordings[0].fileSizeBytes).toBe(123);
  });

  it('GET /recordings without filters', async () => {
    prismaStub.recording.findMany.mockResolvedValue([]);
    prismaStub.recording.count.mockResolvedValue(0);
    const res = await app.inject({
      method: 'GET', url: '/recordings', headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /recordings with only from', async () => {
    prismaStub.recording.findMany.mockResolvedValue([]);
    prismaStub.recording.count.mockResolvedValue(0);
    const res = await app.inject({
      method: 'GET', url: '/recordings?from=2024-01-01T00:00:00Z',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /recordings with only to', async () => {
    prismaStub.recording.findMany.mockResolvedValue([]);
    prismaStub.recording.count.mockResolvedValue(0);
    const res = await app.inject({
      method: 'GET', url: '/recordings?to=2024-12-31T00:00:00Z',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /recordings → 400 on invalid query', async () => {
    const res = await app.inject({
      method: 'GET', url: '/recordings?page=0', headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /recordings emits null fileSizeBytes when DB has null', async () => {
    prismaStub.recording.findMany.mockResolvedValue([{
      id: 'r1', cameraId: 'c1', startedAt: new Date(), endedAt: null,
      durationS: null, storageTier: 'HOT', status: 'RECORDING',
      fileSizeBytes: null, createdAt: new Date(), updatedAt: new Date(),
    }]);
    prismaStub.recording.count.mockResolvedValue(1);
    const res = await app.inject({
      method: 'GET', url: '/recordings', headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().recordings[0].fileSizeBytes).toBeNull();
  });

  it('POST /recordings/schedule rejected for VIEWER', async () => {
    const res = await app.inject({
      method: 'POST', url: '/recordings/schedule',
      headers: { authorization: bearer({ role: 'VIEWER' }) },
      payload: { cameraId: 'c1', cronExpr: '* * * * *', durationS: 60 },
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST /recordings/schedule → 400 on invalid body', async () => {
    const res = await app.inject({
      method: 'POST', url: '/recordings/schedule',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { cameraId: '', cronExpr: '', durationS: 0 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /recordings/schedule → 404 when camera missing', async () => {
    prismaStub.camera.findUnique.mockResolvedValue(null);
    const res = await app.inject({
      method: 'POST', url: '/recordings/schedule',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { cameraId: 'c1', cronExpr: '0 9 * * *', durationS: 600 },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /recordings/schedule succeeds', async () => {
    prismaStub.camera.findUnique.mockResolvedValue({ id: 'c1' });
    prismaStub.recordingSchedule.create.mockResolvedValue({ id: 'sch_1' });
    const res = await app.inject({
      method: 'POST', url: '/recordings/schedule',
      headers: { authorization: bearer({ role: 'OPERATOR', sub: 'u1' }) },
      payload: { cameraId: 'c1', cronExpr: '0 9 * * *', durationS: 600 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().schedule.id).toBe('sch_1');
  });

  it('GET /recordings/:id returns the recording', async () => {
    prismaStub.recording.findUnique.mockResolvedValue({
      id: 'r1', cameraId: 'c1', startedAt: new Date(), endedAt: null,
      durationS: null, storageTier: 'HOT', status: 'RECORDING',
      fileSizeBytes: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const res = await app.inject({
      method: 'GET', url: '/recordings/r1',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /recordings/:id → 404 when missing', async () => {
    prismaStub.recording.findUnique.mockResolvedValue(null);
    const res = await app.inject({
      method: 'GET', url: '/recordings/r1',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /recordings/:id rejected for OPERATOR', async () => {
    const res = await app.inject({
      method: 'DELETE', url: '/recordings/r1',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
    });
    expect(res.statusCode).toBe(403);
  });

  it('DELETE /recordings/:id (ADMIN) → 204', async () => {
    prismaStub.recording.findUnique.mockResolvedValue({ id: 'r1', storagePath: 's3://x/y' });
    prismaStub.recording.delete.mockResolvedValue({});
    const res = await app.inject({
      method: 'DELETE', url: '/recordings/r1',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
    });
    expect(res.statusCode).toBe(204);
  });

  it('DELETE /recordings/:id with no storage path still deletes', async () => {
    prismaStub.recording.findUnique.mockResolvedValue({ id: 'r1', storagePath: null });
    prismaStub.recording.delete.mockResolvedValue({});
    const res = await app.inject({
      method: 'DELETE', url: '/recordings/r1',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
    });
    expect(res.statusCode).toBe(204);
  });

  it('DELETE /recordings/:id → 404 when missing', async () => {
    prismaStub.recording.findUnique.mockResolvedValue(null);
    const res = await app.inject({
      method: 'DELETE', url: '/recordings/r1',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /recordings/:id/export → 409 when status is not STORED', async () => {
    prismaStub.recording.findUnique.mockResolvedValue({ id: 'r1', status: 'RECORDING', storagePath: 's3://x' });
    const res = await app.inject({
      method: 'POST', url: '/recordings/r1/export',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: {},
    });
    expect(res.statusCode).toBe(409);
  });

  it('POST /recordings/:id/export accepts request without body (uses {} fallback)', async () => {
    prismaStub.recording.findUnique.mockResolvedValue({ id: 'r1', status: 'STORED', storagePath: 's3://x' });
    const res = await app.inject({
      method: 'POST', url: '/recordings/r1/export',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
    });
    expect(res.statusCode).toBe(200);
  });

  it('POST /recordings/:id/export → 200 with download URL when STORED', async () => {
    prismaStub.recording.findUnique.mockResolvedValue({ id: 'r1', status: 'STORED', storagePath: 's3://x' });
    const res = await app.inject({
      method: 'POST', url: '/recordings/r1/export',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { clipStartS: 0, clipEndS: 30 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().downloadUrl).toMatch(/clip\.mp4/);
  });

  it('POST /recordings/:id/export → 404 when missing', async () => {
    prismaStub.recording.findUnique.mockResolvedValue(null);
    const res = await app.inject({
      method: 'POST', url: '/recordings/r1/export',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: {},
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /recordings/:id/export → 400 on invalid clip times', async () => {
    const res = await app.inject({
      method: 'POST', url: '/recordings/r1/export',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { clipStartS: -1 },
    });
    expect(res.statusCode).toBe(400);
  });
});
