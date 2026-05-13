import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const createCameraSpy = vi.fn();
const listCamerasSpy = vi.fn();
const getCameraByIdSpy = vi.fn();
const updateCameraSpy = vi.fn();
const deleteCameraSpy = vi.fn();
const testCameraSpy = vi.fn();

vi.mock('../../../src/services/camera-service.js', async (orig) => {
  const real = await orig() as Record<string, unknown>;
  return {
    ...real,
    createCamera:    (...a: unknown[]) => createCameraSpy(...a),
    listCameras:     (...a: unknown[]) => listCamerasSpy(...a),
    getCameraById:   (...a: unknown[]) => getCameraByIdSpy(...a),
    updateCamera:    (...a: unknown[]) => updateCameraSpy(...a),
    deleteCamera:    (...a: unknown[]) => deleteCameraSpy(...a),
    testCamera:      (...a: unknown[]) => testCameraSpy(...a),
  };
});

const { cameraRoutes } = await import('../../../src/routes/cameras.js');
const { buildTestApp } = await import('../../utils/test-app.js');
const { bearer } = await import('../../utils/auth-helpers.js');

describe('routes/cameras', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    createCameraSpy.mockReset();
    listCamerasSpy.mockReset();
    getCameraByIdSpy.mockReset();
    updateCameraSpy.mockReset();
    deleteCameraSpy.mockReset();
    testCameraSpy.mockReset();
    app = await buildTestApp(cameraRoutes);
  });
  afterEach(async () => { await app.close(); });

  it('GET /cameras requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/cameras' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /cameras returns list (default filters)', async () => {
    listCamerasSpy.mockResolvedValue({ total: 0, page: 1, limit: 50, count: 0, cameras: [] });
    const res = await app.inject({
      method: 'GET',
      url: '/cameras',
      headers: { authorization: bearer({ role: 'VIEWER' }) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ total: 0, page: 1, limit: 50, count: 0, cameras: [] });
  });

  it('GET /cameras → 400 on invalid query', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/cameras?status=NOT_A_REAL_STATUS',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /cameras/:id returns camera', async () => {
    getCameraByIdSpy.mockResolvedValue({ id: 'c1', name: 'cam' });
    const res = await app.inject({
      method: 'GET', url: '/cameras/c1', headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe('c1');
  });

  it('POST /cameras requires admin or operator (rejected for VIEWER)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/cameras',
      headers: { authorization: bearer({ role: 'VIEWER' }) },
      payload: { name: 'X', rtspUrl: 'rtsp://h/s' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST /cameras creates a camera (OPERATOR)', async () => {
    createCameraSpy.mockResolvedValue({ id: 'c1', name: 'X' });
    const res = await app.inject({
      method: 'POST',
      url: '/cameras',
      headers: { authorization: bearer({ role: 'OPERATOR', sub: 'opr1' }) },
      payload: { name: 'X', rtspUrl: 'rtsp://h/s' },
    });
    expect(res.statusCode).toBe(201);
    expect(createCameraSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'X', rtspUrl: 'rtsp://h/s' }),
      'opr1',
    );
  });

  it('POST /cameras → 400 on validation error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/cameras',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { name: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('PUT /cameras/:id updates camera', async () => {
    updateCameraSpy.mockResolvedValue({ id: 'c1', name: 'New' });
    const res = await app.inject({
      method: 'PUT',
      url: '/cameras/c1',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { name: 'New' },
    });
    expect(res.statusCode).toBe(200);
    expect(updateCameraSpy).toHaveBeenCalledWith('c1', { name: 'New' });
  });

  it('PUT /cameras/:id → 400 on body validation error', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/cameras/c1',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { rtspUrl: 'not-an-rtsp' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('DELETE /cameras/:id (ADMIN) returns 204', async () => {
    deleteCameraSpy.mockResolvedValue(undefined);
    const res = await app.inject({
      method: 'DELETE',
      url: '/cameras/c1',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
    });
    expect(res.statusCode).toBe(204);
  });

  it('DELETE /cameras/:id rejected for OPERATOR', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/cameras/c1',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST /cameras/:id/test returns reachability', async () => {
    testCameraSpy.mockResolvedValue({ reachable: true, latency_ms: 10, message: 'ok' });
    const res = await app.inject({
      method: 'POST',
      url: '/cameras/c1/test',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().reachable).toBe(true);
  });
});
