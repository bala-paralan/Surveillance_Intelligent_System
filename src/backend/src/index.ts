/**
 * SurveillanceOS backend — Fastify server entrypoint.
 * Registers plugins, routes, error handler, and starts listening.
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import { config, corsOrigins } from './config.js';
import { logger } from './logger.js';
import { authRoutes } from './routes/auth.js';
import { cameraRoutes } from './routes/cameras.js';
import { streamRoutes } from './routes/streams.js';
import { AppError } from './errors.js';
import { stopAllStreams } from './services/stream-service.js';

const app = Fastify({ logger: logger as Parameters<typeof Fastify>[0]['logger'] });

// ── Plugins ───────────────────────────────────────────────────────────────────

await app.register(helmet, {
  contentSecurityPolicy: false, // handled by frontend
});

await app.register(cors, {
  origin: corsOrigins,
  credentials: true,
});

await app.register(rateLimit, {
  global: true,
  max:    100,
  timeWindow: '1 minute',
});

// Serve HLS segments directory (also served per-request via stream routes)
await app.register(staticFiles, {
  root:   config.HLS_DIR,
  prefix: '/hls-static/',
  decorateReply: false,
});

// ── Routes ────────────────────────────────────────────────────────────────────

await app.register(authRoutes);
await app.register(cameraRoutes);
await app.register(streamRoutes);

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

// ── Error handler ─────────────────────────────────────────────────────────────

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof AppError) {
    return reply.code(err.statusCode).send({ error: err.message });
  }
  // Fastify validation errors
  if (err.validation) {
    return reply.code(400).send({ error: 'Validation error', details: err.validation });
  }
  logger.error({ err }, 'Unhandled error');
  return reply.code(500).send({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────

const start = async (): Promise<void> => {
  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    logger.info({ port: config.PORT }, 'Backend listening');
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
};

// ── Graceful shutdown ─────────────────────────────────────────────────────────

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'Shutting down');
  await stopAllStreams();
  await app.close();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT',  () => void shutdown('SIGINT'));

await start();
