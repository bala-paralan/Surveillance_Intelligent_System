/**
 * Prometheus metrics middleware for SurveillanceOS backend.
 *
 * Tracks:
 *   http_requests_total{method, route, status_code}  — Counter
 *   http_request_duration_ms{method, route}           — Histogram (p50/p95/p99)
 *
 * Exposes GET /metrics endpoint (no auth — internal scraping by Prometheus only).
 * Prometheus listens on a dedicated port (9091) so the metrics endpoint is not
 * accessible from the public-facing port 3001 unless explicitly proxied.
 */

import { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

// ── Registry ──────────────────────────────────────────────────────────────────

const register = new Registry();

collectDefaultMetrics({ register, prefix: 'backend_' });

// ── Metrics ───────────────────────────────────────────────────────────────────

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

export const httpRequestDurationMs = new Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'route'] as const,
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [register],
});

// ── Plugin ────────────────────────────────────────────────────────────────────

const metricsPluginImpl = async (app: FastifyInstance): Promise<void> => {
  // Hook — record timing on every request
  app.addHook(
    'onResponse',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const route = request.routerPath ?? request.url ?? /* v8 ignore next */ 'unknown';
      const method = request.method;
      const statusCode = String(reply.statusCode);
      const durationMs = reply.elapsedTime;

      httpRequestsTotal.inc({ method, route, status_code: statusCode });
      httpRequestDurationMs.observe({ method, route }, durationMs);
    }
  );

  // GET /metrics — no auth, intended for internal Prometheus scraping
  app.get(
    '/metrics',
    async (_req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const metrics = await register.metrics();
      await reply
        .header('Content-Type', register.contentType)
        .send(metrics);
    }
  );
};

export const metricsPlugin = fp(metricsPluginImpl, {
  name: 'metrics',
  fastify: '4.x',
});
