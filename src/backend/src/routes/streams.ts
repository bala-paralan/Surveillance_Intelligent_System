/**
 * HLS stream proxy routes — TASK-004.
 * All routes require JWT auth; start/stop require ADMIN or OPERATOR.
 */
import path from 'path';
import { createReadStream, statSync } from 'fs';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  startStream,
  stopStream,
  touchStream,
  listActiveStreams,
} from '../services/stream-service.js';
import { verifyJwt, requireRole } from '../middleware/auth.js';
import { config } from '../config.js';
import { NotFoundError } from '../errors.js';

const IdParam   = z.object({ id: z.string().min(1) });
const FileParam = z.object({ id: z.string().min(1), file: z.string().regex(/^[\w%-]+\.(m3u8|ts)$/) });

export const streamRoutes = async (app: FastifyInstance): Promise<void> => {

  // ── POST /streams/:id/start ───────────────────────────────────────────────
  app.post('/streams/:id/start', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR')],
    handler: async (req, reply) => {
      const p = IdParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'Invalid id' });

      const { hlsPath } = await startStream(p.data.id);
      void hlsPath; // internal path — do not expose

      return reply.code(200).send({
        cameraId:   p.data.id,
        hlsUrl:     `/streams/${p.data.id}/hls/stream.m3u8`,
        message:    'Stream starting',
      });
    },
  });

  // ── DELETE /streams/:id ───────────────────────────────────────────────────
  app.delete('/streams/:id', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR')],
    handler: async (req, reply) => {
      const p = IdParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'Invalid id' });
      await stopStream(p.data.id);
      return reply.code(204).send();
    },
  });

  // ── GET /streams ──────────────────────────────────────────────────────────
  app.get('/streams', {
    preHandler: [verifyJwt],
    handler: async (_req, reply) => {
      return reply.send({ streams: listActiveStreams() });
    },
  });

  // ── GET /streams/:id/hls/:file — serve HLS playlist & segments ───────────
  app.get('/streams/:id/hls/:file', {
    preHandler: [verifyJwt],
    handler: async (req, reply) => {
      const p = FileParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'Invalid params' });

      // Touch idle timer on each segment request
      touchStream(p.data.id);

      const filePath = path.join(config.HLS_DIR, p.data.id, p.data.file);

      try {
        const stat = statSync(filePath);
        if (!stat.isFile()) throw new NotFoundError('Segment');
      } catch {
        return reply.code(404).send({ error: 'Segment not found' });
      }

      const ext         = path.extname(p.data.file);
      const contentType = ext === '.m3u8'
        ? 'application/vnd.apple.mpegurl'
        : 'video/MP2T';

      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'no-cache');
      return reply.send(createReadStream(filePath));
    },
  });
};
