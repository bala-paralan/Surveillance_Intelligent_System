/**
 * Camera intrusion-zone routes — TASK-007.
 *
 * GET  /cameras/:cameraId/zones — list zones (VIEWER+)
 * POST /cameras/:cameraId/zones — set zones for a camera (ADMIN | OPERATOR)
 *
 * Zones are stored in the CameraZone table (keyed by cameraId + zoneId) and
 * also forwarded to the analytics microservice for live intrusion checking.
 * The analytics call is fire-and-forget; failures are logged but not fatal.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { verifyJwt, requireRole } from '../middleware/auth.js';
import { NotFoundError } from '../errors.js';
import { logger } from '../logger.js';

// ── Zod schemas ──────────────────────────────────────────────────────────────

interface CameraIdParams { cameraId: string }

/** A single normalised [x, y] coordinate pair */
const CoordPairSchema = z.tuple([
  z.number().min(0).max(1),
  z.number().min(0).max(1),
]);

const ZoneBodySchema = z.object({
  zoneId:  z.string().min(1).max(64),
  polygon: z
    .array(CoordPairSchema)
    .min(3, 'Polygon must have at least 3 vertices')
    .max(50, 'Polygon may not exceed 50 vertices'),
  label: z.string().max(120).optional(),
});

const SetZonesBodySchema = z.object({
  zones: z.array(ZoneBodySchema).min(0).max(100),
});

// ── Public zone shape (stripped from DB row) ──────────────────────────────────

interface ZonePublic {
  zoneId:   string;
  cameraId: string;
  label:    string | null;
  polygon:  [number, number][];
  createdAt: string;
  updatedAt: string;
}

const toZonePublic = (row: {
  zoneId:   string;
  cameraId: string;
  label:    string | null;
  polygon:  unknown;
  createdAt: Date;
  updatedAt: Date;
}): ZonePublic => ({
  zoneId:   row.zoneId,
  cameraId: row.cameraId,
  label:    row.label,
  polygon:  row.polygon as [number, number][],
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

// ── Analytics forwarding (fire-and-forget) ────────────────────────────────────

const forwardZonesToAnalytics = async (
  cameraId: string,
  zones: Array<{ zoneId: string; polygon: [number, number][] }>
): Promise<void> => {
  const analyticsUrl =
    process.env['ANALYTICS_URL'] ?? 'http://localhost:8001';

  try {
    const body = {
      camera_id: cameraId,
      zones: zones.map(z => ({
        zone_id:   z.zoneId,
        camera_id: cameraId,
        polygon:   z.polygon,
      })),
    };

    const res = await fetch(`${analyticsUrl}/zones`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      logger.warn(
        { cameraId, status: res.status },
        'Analytics zone registration returned non-2xx'
      );
    }
  } catch (err: unknown) {
    logger.warn({ err, cameraId }, 'Analytics zone registration failed (non-fatal)');
  }
};

// ── Route plugin ──────────────────────────────────────────────────────────────

export const zoneRoutes = async (app: FastifyInstance): Promise<void> => {

  // ── GET /cameras/:cameraId/zones ──────────────────────────────────────────
  app.get<{ Params: CameraIdParams }>('/cameras/:cameraId/zones', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR', 'VIEWER', 'ENGINEER')],
    handler: async (req, reply) => {
      const { cameraId } = req.params;

      try {
        // Verify camera exists
        const camera = await prisma.camera.findUnique({ where: { id: cameraId } });
        if (!camera) throw new NotFoundError('Camera');

        const rows = await prisma.cameraZone.findMany({
          where:   { cameraId },
          orderBy: { createdAt: 'asc' },
        });

        const zones: ZonePublic[] = rows.map(toZonePublic);
        return reply.send({ cameraId, zones });
      } catch (err: unknown) {
        logger.error({ err, cameraId }, 'GET /cameras/:cameraId/zones failed');
        throw err;
      }
    },
  });

  // ── POST /cameras/:cameraId/zones ─────────────────────────────────────────
  app.post<{ Params: CameraIdParams }>('/cameras/:cameraId/zones', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR')],
    handler: async (req, reply) => {
      const body = SetZonesBodySchema.safeParse(req.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'Validation error', details: body.error.flatten() });
      }

      const { cameraId } = req.params;
      const { zones }    = body.data;

      try {
        // Verify camera exists
        const camera = await prisma.camera.findUnique({ where: { id: cameraId } });
        if (!camera) throw new NotFoundError('Camera');

        // Upsert each zone — delete+recreate within a transaction for atomicity
        await prisma.$transaction(async (tx) => {
          // Remove zones that are no longer in the new list
          const incomingIds = zones.map(z => z.zoneId);
          await tx.cameraZone.deleteMany({
            where: {
              cameraId,
              zoneId: { notIn: incomingIds },
            },
          });

          // Upsert each incoming zone
          for (const zone of zones) {
            await tx.cameraZone.upsert({
              where:  { cameraId_zoneId: { cameraId, zoneId: zone.zoneId } },
              create: {
                cameraId,
                zoneId:  zone.zoneId,
                label:   zone.label ?? null,
                polygon: zone.polygon,
              },
              update: {
                label:   zone.label ?? null,
                polygon: zone.polygon,
              },
            });
          }
        });

        logger.info({ cameraId, count: zones.length }, 'POST /cameras/:cameraId/zones updated zones');

        // Forward to analytics microservice (fire-and-forget)
        void forwardZonesToAnalytics(
          cameraId,
          zones.map(z => ({ zoneId: z.zoneId, polygon: z.polygon }))
        );

        return reply.code(200).send({ registered: zones.length });
      } catch (err: unknown) {
        logger.error({ err, cameraId }, 'POST /cameras/:cameraId/zones failed');
        throw err;
      }
    },
  });
};
