/**
 * Recording management routes — TASK-012.
 *
 * GET  /recordings             — list recordings (paginated, filterable)
 * POST /recordings/schedule    — create recording schedule
 * GET  /recordings/:id         — single recording
 * DELETE /recordings/:id       — delete recording (ADMIN only)
 * POST /recordings/:id/export  — request clip export URL
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { verifyJwt, requireRole } from '../middleware/auth.js';
import { scheduleRecording, recordingQueue } from '../jobs/recording-job.js';
import { NotFoundError, ForbiddenError } from '../errors.js';
import type { RecordingStatus, StorageTier } from '@prisma/client';

// ── Schemas ───────────────────────────────────────────────────────────────────

const IdParam = z.object({ id: z.string().min(1) });

const ListRecordingsQuery = z.object({
  cameraId:  z.string().optional(),
  status:    z.enum(['SCHEDULED', 'RECORDING', 'PROCESSING', 'STORED', 'FAILED', 'EXPIRED']).optional(),
  from:      z.string().datetime().optional(),
  to:        z.string().datetime().optional(),
  page:      z.coerce.number().int().min(1).default(1),
  pageSize:  z.coerce.number().int().min(1).max(100).default(20),
});

const CreateScheduleBody = z.object({
  cameraId:  z.string().min(1),
  cronExpr:  z.string().min(1),
  durationS: z.number().int().min(1).max(86_400), // max 24 h
});

const ExportBody = z.object({
  /** Optional clip window within the recording (seconds from start) */
  clipStartS: z.number().int().min(0).optional(),
  clipEndS:   z.number().int().min(1).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip internal fields before sending to clients */
const toPublicRecording = (r: {
  id: string;
  cameraId: string;
  startedAt: Date;
  endedAt: Date | null;
  durationS: number | null;
  storageTier: StorageTier;
  status: RecordingStatus;
  fileSizeBytes: bigint | null;
  createdAt: Date;
  updatedAt: Date;
  // storagePath intentionally omitted — never expose storage keys to frontend
}) => ({
  id:           r.id,
  cameraId:     r.cameraId,
  startedAt:    r.startedAt.toISOString(),
  endedAt:      r.endedAt?.toISOString() ?? null,
  durationS:    r.durationS,
  storageTier:  r.storageTier,
  status:       r.status,
  fileSizeBytes: r.fileSizeBytes !== null ? Number(r.fileSizeBytes) : null,
  createdAt:    r.createdAt.toISOString(),
  updatedAt:    r.updatedAt.toISOString(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

export const recordingRoutes = async (app: FastifyInstance): Promise<void> => {

  // ── GET /recordings ───────────────────────────────────────────────────────

  app.get('/recordings', {
    preHandler: [verifyJwt],
    handler: async (req, reply) => {
      const q = ListRecordingsQuery.safeParse(req.query);
      if (!q.success) return reply.code(400).send({ error: q.error.flatten() });

      const { cameraId, status, from, to, page, pageSize } = q.data;
      const skip = (page - 1) * pageSize;

      const where = {
        ...(cameraId ? { cameraId } : {}),
        ...(status ? { status: status as RecordingStatus } : {}),
        ...(from || to
          ? {
              startedAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to   ? { lte: new Date(to)   } : {}),
              },
            }
          : {}),
      };

      const [recordings, total] = await Promise.all([
        prisma.recording.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { startedAt: 'desc' },
          select: {
            id: true, cameraId: true, startedAt: true, endedAt: true,
            durationS: true, storageTier: true, status: true,
            fileSizeBytes: true, createdAt: true, updatedAt: true,
            // storagePath excluded intentionally
          },
        }),
        prisma.recording.count({ where }),
      ]);

      return reply.send({
        recordings: recordings.map(toPublicRecording),
        total,
        page,
        pageSize,
      });
    },
  });

  // ── POST /recordings/schedule ─────────────────────────────────────────────

  app.post('/recordings/schedule', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR')],
    handler: async (req, reply) => {
      const body = CreateScheduleBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

      const { cameraId, cronExpr, durationS } = body.data;

      // Verify camera exists
      const camera = await prisma.camera.findUnique({ where: { id: cameraId } });
      if (!camera) throw new NotFoundError('Camera');

      const schedule = await prisma.recordingSchedule.create({
        data: {
          cameraId,
          cronExpr,
          durationS,
          createdBy: req.user!.sub,
        },
      });

      return reply.code(201).send({ schedule });
    },
  });

  // ── GET /recordings/:id ───────────────────────────────────────────────────

  app.get('/recordings/:id', {
    preHandler: [verifyJwt],
    handler: async (req, reply) => {
      const p = IdParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'Invalid id' });

      const recording = await prisma.recording.findUnique({
        where: { id: p.data.id },
        select: {
          id: true, cameraId: true, startedAt: true, endedAt: true,
          durationS: true, storageTier: true, status: true,
          fileSizeBytes: true, createdAt: true, updatedAt: true,
        },
      });

      if (!recording) throw new NotFoundError('Recording');
      return reply.send(toPublicRecording(recording));
    },
  });

  // ── DELETE /recordings/:id ────────────────────────────────────────────────

  app.delete('/recordings/:id', {
    preHandler: [verifyJwt, requireRole('ADMIN')],
    handler: async (req, reply) => {
      const p = IdParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'Invalid id' });

      const recording = await prisma.recording.findUnique({
        where: { id: p.data.id },
        select: { id: true, storagePath: true },
      });
      if (!recording) throw new NotFoundError('Recording');

      // Log intent — actual object-storage deletion is handled by a background
      // cleanup job in production (never delete from the application server).
      if (recording.storagePath) {
        app.log.info(
          { storagePath: recording.storagePath },
          'Recording deletion requested — storage cleanup deferred to object-storage GC job'
        );
      }

      await prisma.recording.delete({ where: { id: p.data.id } });
      return reply.code(204).send();
    },
  });

  // ── POST /recordings/:id/export ───────────────────────────────────────────

  app.post('/recordings/:id/export', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR')],
    handler: async (req, reply) => {
      const p = IdParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'Invalid id' });

      const body = ExportBody.safeParse(req.body ?? {});
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

      const recording = await prisma.recording.findUnique({
        where: { id: p.data.id },
        select: { id: true, status: true, storagePath: true },
      });
      if (!recording) throw new NotFoundError('Recording');

      if (recording.status !== 'STORED') {
        return reply.code(409).send({
          error: `Recording is not yet available for export (status: ${recording.status})`,
        });
      }

      // v1: return a placeholder pre-signed URL with a 1-hour TTL.
      // Production: call AWS S3 getSignedUrl / MinIO presignedGetObject here.
      const expiresAt = new Date(Date.now() + 60 * 60 * 1_000).toISOString();
      const downloadUrl = `https://storage.example.com/exports/${recording.id}/clip.mp4?expires=${expiresAt}`;

      return reply.send({ downloadUrl, expiresAt });
    },
  });
};
