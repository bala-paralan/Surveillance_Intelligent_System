/**
 * AOI (Area of Interest) routes — TASK-031.
 *
 * GET    /aoi              — list active AOIs (VIEWER+), optional ?bopZoneId filter
 * POST   /aoi              — create AOI (ADMIN | OPERATOR)
 * PATCH  /aoi/:id          — update AOI (ADMIN | OPERATOR)
 * DELETE /aoi/:id          — soft-delete AOI (ADMIN)
 * GET    /aoi/:id/export   — export as GeoJSON FeatureCollection (VIEWER+)
 * POST   /aoi/import       — import GeoJSON FeatureCollection (ADMIN | OPERATOR)
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { verifyJwt, requireRole } from '../middleware/auth.js';
import { NotFoundError, AppError } from '../errors.js';
import { logger } from '../logger.js';

// ── GeoJSON types ────────────────────────────────────────────────────────────

interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

interface AoiPublic {
  id: string;
  name: string;
  bopZoneId: string | null;
  geometry: GeoJsonPolygon;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

// ── Zod schemas ──────────────────────────────────────────────────────────────

const CoordinatePairSchema = z.array(z.number()).length(2);

const PolygonGeometrySchema = z
  .object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.array(CoordinatePairSchema)),
  })
  .superRefine((geo, ctx) => {
    // Must have at least one ring
    if (geo.coordinates.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Polygon must have at least one ring',
      });
      return;
    }
    const outerRing = geo.coordinates[0];
    if (!outerRing || outerRing.length < 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Polygon outer ring must have at least 6 coordinate pairs',
      });
    }
    // Count total vertices across all rings
    const totalVertices = geo.coordinates.reduce((sum, ring) => sum + ring.length, 0);
    if (totalVertices > 1000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Polygon exceeds maximum of 1000 vertices',
      });
    }
  });

const CreateAoiBodySchema = z.object({
  name: z.string().min(1).max(120),
  bopZoneId: z.string().optional(),
  geometry: PolygonGeometrySchema,
});

const UpdateAoiBodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  bopZoneId: z.string().nullable().optional(),
  geometry: PolygonGeometrySchema.optional(),
});

const ListQuerySchema = z.object({
  bopZoneId: z.string().optional(),
});

const IdParamSchema = z.object({ id: z.string().min(1) });

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parse and re-stringify geometry to prevent prototype pollution */
const sanitizeGeometry = (raw: unknown): GeoJsonPolygon => {
  // Round-trip through JSON.parse to strip any non-plain properties
  const clean = JSON.parse(JSON.stringify(raw)) as GeoJsonPolygon;
  return clean;
};

/** Convert a DB Aoi row to AoiPublic, parsing geometryJson */
const toAoiPublic = (row: {
  id: string;
  name: string;
  bopZoneId: string | null;
  geometryJson: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}): AoiPublic => ({
  id: row.id,
  name: row.name,
  bopZoneId: row.bopZoneId,
  geometry: JSON.parse(row.geometryJson) as GeoJsonPolygon,
  createdById: row.createdById,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** Attempt to emit a Redis pub/sub event — non-fatal if Redis is unavailable */
const tryEmitRedisEvent = async (
  channel: string,
  payload: Record<string, string | null | undefined>
): Promise<void> => {
  try {
    // Redis may not be configured in all environments; import lazily
    const { createClient } = await import('redis');
    const redis = createClient({ url: process.env['REDIS_URL'] ?? 'redis://localhost:6379' });
    await redis.connect();
    await redis.publish(channel, JSON.stringify(payload));
    await redis.disconnect();
  } catch (err: unknown) {
    // Non-fatal — log at debug level only (no credentials or PII)
    logger.debug({ channel }, 'Redis pub/sub emit skipped (Redis unavailable or not configured)');
  }
};

// ── Route plugin ─────────────────────────────────────────────────────────────

export const aoiRoutes = async (app: FastifyInstance): Promise<void> => {

  // ── GET /aoi ──────────────────────────────────────────────────────────────
  app.get('/aoi', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR', 'VIEWER', 'ENGINEER')],
    handler: async (req, reply) => {
      const queryParsed = ListQuerySchema.safeParse(req.query);
      if (!queryParsed.success) {
        return reply.code(400).send({ error: 'Invalid query parameters', details: queryParsed.error.issues });
      }

      const { bopZoneId } = queryParsed.data;

      try {
        const rows = await prisma.aoi.findMany({
          where: {
            deletedAt: null,
            ...(bopZoneId !== undefined ? { bopZoneId } : {}),
          },
          orderBy: { createdAt: 'asc' },
          select: {
            id:          true,
            name:        true,
            bopZoneId:   true,
            geometryJson: true,
            createdById: true,
            createdAt:   true,
            updatedAt:   true,
          },
        });

        // Never log geometry coordinates; log only count and ids
        logger.info(
          { count: rows.length, ids: rows.map(r => r.id) },
          'GET /aoi returned AOIs'
        );

        const aois: AoiPublic[] = rows.map(toAoiPublic);
        return reply.send({ aois });
      } catch (err: unknown) {
        logger.error({ err }, 'GET /aoi failed');
        throw err;
      }
    },
  });

  // ── POST /aoi/import — must be registered before /aoi/:id ─────────────────
  app.post('/aoi/import', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR')],
    handler: async (req, reply) => {
      if (!req.user) throw new AppError(401, 'Unauthorized');

      // Expect a GeoJSON FeatureCollection body
      const FeatureCollectionSchema = z.object({
        type: z.literal('FeatureCollection'),
        features: z.array(
          z.object({
            type: z.literal('Feature'),
            properties: z.record(z.unknown()).nullable().optional(),
            geometry: z.unknown(),
          })
        ),
      });

      const bodyParsed = FeatureCollectionSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({ error: 'Body must be a GeoJSON FeatureCollection' });
      }

      let created = 0;
      let skipped = 0;

      try {
        for (const feature of bodyParsed.data.features) {
          // Sanitize each feature geometry to prevent prototype pollution
          const rawGeometry = JSON.parse(JSON.stringify(feature.geometry)) as unknown;

          const geoParsed = PolygonGeometrySchema.safeParse(rawGeometry);
          if (!geoParsed.success) {
            skipped++;
            continue;
          }

          const sanitized = sanitizeGeometry(geoParsed.data);

          // Extract a name from feature properties if available
          const props = feature.properties ?? {};
          const rawName = (props as Record<string, unknown>)['name'];
          const name = typeof rawName === 'string' && rawName.trim().length > 0
            ? rawName.trim().slice(0, 120)
            : `Imported AOI ${new Date().toISOString()}`;

          const rawBopZoneId = (props as Record<string, unknown>)['bopZoneId'];
          const bopZoneId = typeof rawBopZoneId === 'string' ? rawBopZoneId : undefined;

          await prisma.aoi.create({
            data: {
              name,
              bopZoneId:    bopZoneId ?? null,
              geometryJson: JSON.stringify(sanitized),
              createdById:  req.user.sub,
            },
          });

          created++;
        }

        logger.info({ created, skipped }, 'POST /aoi/import completed');
        return reply.code(201).send({ created, skipped });
      } catch (err: unknown) {
        logger.error({ err }, 'POST /aoi/import failed');
        throw err;
      }
    },
  });

  // ── POST /aoi ─────────────────────────────────────────────────────────────
  app.post('/aoi', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR')],
    handler: async (req, reply) => {
      if (!req.user) throw new AppError(401, 'Unauthorized');

      const bodyParsed = CreateAoiBodySchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({ error: 'Validation error', details: bodyParsed.error.issues });
      }

      const { name, bopZoneId, geometry } = bodyParsed.data;
      const sanitized = sanitizeGeometry(geometry);

      try {
        const row = await prisma.aoi.create({
          data: {
            name,
            bopZoneId:    bopZoneId ?? null,
            geometryJson: JSON.stringify(sanitized),
            createdById:  req.user.sub,
          },
        });

        logger.info({ aoiId: row.id }, 'POST /aoi created AOI');

        // Emit Redis event — non-fatal
        await tryEmitRedisEvent('aoi:created', {
          id:        row.id,
          name:      row.name,
          bopZoneId: row.bopZoneId,
        });

        return reply.code(201).send({ aoi: toAoiPublic(row) });
      } catch (err: unknown) {
        logger.error({ err }, 'POST /aoi failed');
        throw err;
      }
    },
  });

  // ── PATCH /aoi/:id ────────────────────────────────────────────────────────
  app.patch('/aoi/:id', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR')],
    handler: async (req, reply) => {
      const paramParsed = IdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid id' });
      }

      const bodyParsed = UpdateAoiBodySchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({ error: 'Validation error', details: bodyParsed.error.issues });
      }

      const { id } = paramParsed.data;
      const { name, bopZoneId, geometry } = bodyParsed.data;

      try {
        const existing = await prisma.aoi.findUnique({ where: { id } });
        if (!existing || existing.deletedAt !== null) {
          throw new NotFoundError('AOI');
        }

        const updateData: {
          name?: string;
          bopZoneId?: string | null;
          geometryJson?: string;
        } = {};

        if (name !== undefined) updateData.name = name;
        if (bopZoneId !== undefined) updateData.bopZoneId = bopZoneId;
        if (geometry !== undefined) {
          updateData.geometryJson = JSON.stringify(sanitizeGeometry(geometry));
        }

        const updated = await prisma.aoi.update({
          where: { id },
          data:  updateData,
        });

        logger.info({ aoiId: id }, 'PATCH /aoi/:id updated AOI');
        return reply.send({ aoi: toAoiPublic(updated) });
      } catch (err: unknown) {
        logger.error({ err, aoiId: id }, 'PATCH /aoi/:id failed');
        throw err;
      }
    },
  });

  // ── DELETE /aoi/:id ───────────────────────────────────────────────────────
  app.delete('/aoi/:id', {
    preHandler: [verifyJwt, requireRole('ADMIN')],
    handler: async (req, reply) => {
      const paramParsed = IdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid id' });
      }

      const { id } = paramParsed.data;

      try {
        const existing = await prisma.aoi.findUnique({ where: { id } });
        if (!existing || existing.deletedAt !== null) {
          throw new NotFoundError('AOI');
        }

        await prisma.aoi.update({
          where: { id },
          data:  { deletedAt: new Date() },
        });

        logger.info({ aoiId: id }, 'DELETE /aoi/:id soft-deleted AOI');
        return reply.code(204).send();
      } catch (err: unknown) {
        logger.error({ err, aoiId: id }, 'DELETE /aoi/:id failed');
        throw err;
      }
    },
  });

  // ── GET /aoi/:id/export ───────────────────────────────────────────────────
  app.get('/aoi/:id/export', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR', 'VIEWER', 'ENGINEER')],
    handler: async (req, reply) => {
      const paramParsed = IdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid id' });
      }

      const { id } = paramParsed.data;

      try {
        const row = await prisma.aoi.findUnique({
          where: { id },
          select: {
            id:          true,
            name:        true,
            bopZoneId:   true,
            geometryJson: true,
            createdById: true,
            createdAt:   true,
            updatedAt:   true,
            deletedAt:   true,
          },
        });

        if (!row || row.deletedAt !== null) {
          throw new NotFoundError('AOI');
        }

        const geometry = JSON.parse(row.geometryJson) as GeoJsonPolygon;

        const featureCollection = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              id:   row.id,
              properties: {
                name:        row.name,
                bopZoneId:   row.bopZoneId,
                createdById: row.createdById,
                createdAt:   row.createdAt.toISOString(),
                updatedAt:   row.updatedAt.toISOString(),
              },
              geometry,
            },
          ],
        };

        logger.info({ aoiId: id }, 'GET /aoi/:id/export served AOI export');

        return reply
          .header('Content-Type', 'application/geo+json')
          .send(featureCollection);
      } catch (err: unknown) {
        logger.error({ err, aoiId: id }, 'GET /aoi/:id/export failed');
        throw err;
      }
    },
  });
};
