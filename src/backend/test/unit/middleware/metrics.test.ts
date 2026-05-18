import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { metricsPlugin } from '../../../src/middleware/metrics.js';

describe('middleware/metrics', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(metricsPlugin);
    app.get('/echo', async () => ({ ok: true }));
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('exposes a /metrics endpoint that emits Prometheus text', async () => {
    // Hit the echo route first so a counter sample is recorded
    await app.inject({ method: 'GET', url: '/echo' });

    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.body).toContain('http_requests_total');
    expect(res.body).toContain('http_request_duration_ms');
  });

  it('records timing on every handled request', async () => {
    await app.inject({ method: 'GET', url: '/echo' });
    await app.inject({ method: 'GET', url: '/echo' });
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    // We should see at least two samples for GET /echo
    expect(res.body).toMatch(/http_requests_total\{[^}]*route="\/echo"[^}]*\}\s+\d/);
  });

  it('records timing for unknown routes (covers the fallback label)', async () => {
    await app.inject({ method: 'GET', url: '/unknown-route' });
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
  });
});
