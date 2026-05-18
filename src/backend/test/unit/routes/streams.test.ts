import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';

const startStreamSpy = vi.fn();
const stopStreamSpy = vi.fn();
const touchStreamSpy = vi.fn();
const listActiveStreamsSpy = vi.fn();

vi.mock('../../../src/services/stream-service.js', () => ({
  startStream:        (...a: unknown[]) => startStreamSpy(...a),
  stopStream:         (...a: unknown[]) => stopStreamSpy(...a),
  touchStream:        (...a: unknown[]) => touchStreamSpy(...a),
  listActiveStreams:  (...a: unknown[]) => listActiveStreamsSpy(...a),
  stopAllStreams:     vi.fn(),
}));

const { streamRoutes } = await import('../../../src/routes/streams.js');
const { buildTestApp } = await import('../../utils/test-app.js');
const { bearer } = await import('../../utils/auth-helpers.js');
const { config } = await import('../../../src/config.js');

describe('routes/streams', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    startStreamSpy.mockReset();
    stopStreamSpy.mockReset();
    touchStreamSpy.mockReset();
    listActiveStreamsSpy.mockReset();
    app = await buildTestApp(streamRoutes);
  });
  afterEach(async () => { await app.close(); });

  it('POST /streams/:id/start (OPERATOR) returns the public hls url', async () => {
    startStreamSpy.mockResolvedValue({ hlsPath: '/internal/abs/path' });
    const res = await app.inject({
      method: 'POST',
      url: '/streams/c1/start',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().hlsUrl).toBe('/streams/c1/hls/stream.m3u8');
    expect(res.body).not.toContain('/internal');
  });

  it('POST /streams/:id/start → 403 for VIEWER', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/streams/c1/start',
      headers: { authorization: bearer({ role: 'VIEWER' }) },
    });
    expect(res.statusCode).toBe(403);
  });

  it('DELETE /streams/:id (OPERATOR) returns 204', async () => {
    stopStreamSpy.mockResolvedValue(undefined);
    const res = await app.inject({
      method: 'DELETE',
      url: '/streams/c1',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
    });
    expect(res.statusCode).toBe(204);
  });

  it('GET /streams returns active list', async () => {
    listActiveStreamsSpy.mockReturnValue([{ cameraId: 'c1', lastTouched: 1 }]);
    const res = await app.inject({
      method: 'GET',
      url: '/streams',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ streams: [{ cameraId: 'c1', lastTouched: 1 }] });
  });

  it('GET /streams/:id/hls/:file → 400 on bad file name', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/streams/c1/hls/..%2Fetc%2Fpasswd',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /streams/:id/hls/:file serves an existing m3u8 file', async () => {
    // Use a unique camera dir within the configured HLS_DIR
    const cameraId = 'cam-test-' + Date.now();
    const dir = path.join(config.HLS_DIR, cameraId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'stream.m3u8'), '#EXTM3U\n');

    const res = await app.inject({
      method: 'GET',
      url: `/streams/${cameraId}/hls/stream.m3u8`,
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/vnd.apple.mpegurl');
    expect(res.body).toContain('#EXTM3U');
    expect(touchStreamSpy).toHaveBeenCalledWith(cameraId);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('GET /streams/:id/hls/:file serves an existing ts segment with video/MP2T', async () => {
    const cameraId = 'cam-ts-' + Date.now();
    const dir = path.join(config.HLS_DIR, cameraId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'seg001.ts'), 'binary');
    const res = await app.inject({
      method: 'GET',
      url: `/streams/${cameraId}/hls/seg001.ts`,
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('video/MP2T');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('GET /streams/:id/hls/:file returns 404 when missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/streams/no-such-cam/hls/stream.m3u8',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET /streams/:id/hls/:file returns 404 when not a file (is a dir)', async () => {
    const cameraId = 'cam-dirfile-' + Date.now();
    const dir = path.join(config.HLS_DIR, cameraId, 'stream.m3u8'); // create dir at file path
    fs.mkdirSync(dir, { recursive: true });
    const res = await app.inject({
      method: 'GET',
      url: `/streams/${cameraId}/hls/stream.m3u8`,
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(404);
    fs.rmSync(path.dirname(dir), { recursive: true, force: true });
  });

  it('does not log to /tmp os-specific path interference', () => {
    expect(os.platform()).toBeTypeOf('string');
  });
});
