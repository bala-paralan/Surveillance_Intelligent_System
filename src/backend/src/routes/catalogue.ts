/**
 * Catalogue routes — TASK-032.
 *
 * GET  /aoi/:aoiId/catalogue  — list sensors + assets + cameras inside AOI
 * GET  /sensors               — list all sensors (paginated, optional ?bopZoneId)
 * POST /sensors               — create sensor
 * GET  /sensors/:id           — get single sensor
 * PATCH /sensors/:id/health   — update sensor health
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { verifyJwt, requireRole } from '../middleware/auth.js';
import { NotFoundError } from '../errors.js';
import { logger } from '../logger.js';
import { listForAoi, toSensorPublic } from '../services/catalogue-service.js';

// ── Zod schemas ──────────────────────────────────────────────────────────────

const AoiIdParamSchema   = z.object({ aoiId: z.string().min(1) });
const SensorIdParamSchema = z.object({ id: z.string().min(1) });

const SensorTypeSchema   = z.enum(['SEISMIC', 'ACOUSTIC', 'THERMAL', 'LIDAR', 'PAN', 'CAMERA']);
const SensorHealthSchema = z.enum(['HEALTHY', 'DEGRADED', 'OFFLINE', 'UNKNOWN']);

const CreateSensorBodySchema = z.object({
  type:        SensorTypeSchema,
  lat:         z.number().min(-90).max(90),
  lon:         z.number().min(-180).max(180),
  bopZoneId:   z.string().optional(),
  installedOn: z.string().datetime(),
});

const UpdateHealthBodySchema = z.object({
  health:        SensorHealthSchema,
  lastHeartbeat: z.string().datetime().optional(),
});

const ListSensorsQuerySchema = z.object({
  bopZoneId: z.string().optional(),
  page:      z.coerce.number().int().positive().optional().default(1),
  pageSize:  z.coerce.number().int().positive().max(200).optional().default(50),
});

// ── Route plugin ─────────────────────────────────────────────────────────────

export const catalogueRoutes = async (app: FastifyInstance): Promise<void> => {

  // ── GET /aoi/:aoiId/catalogue ─────────────────────────────────────────────
  app.get('/aoi/:aoiId/catalogue', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR', 'VIEWER', 'ENGINEER')],
    handler: async (req, reply) => {
      const paramParsed = AoiIdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid aoiId' });
      }

      const { aoiId } = paramParsed.data;

      try {
        const items = await listForAoi(aoiId);
        return reply.send({ items, count: items.length, aoiId });
      } catch (err: unknown) {
        logger.error({ err, aoiId }, 'GET /aoi/:aoiId/catalogue failed');
        throw err;
      }
    },
  });

  // ── GET /sensors ──────────────────────────────────────────────────────────
  app.get('/sensors', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR', 'VIEWER', 'ENGINEER')],
    handler: async (req, reply) => {
      const queryParsed = ListSensorsQuerySchema.safeParse(req.query);
      if (!queryParsed.success) {
        return reply.code(400).send({ error: 'Invalid query parameters', details: queryParsed.error.issues });
      }

      const { bopZoneId, page, pageSize } = queryParsed.data;
      const skip = (page - 1) * pageSize;

      try {
        const where = bopZoneId !== undefined ? { bopZoneId } : {};

        const [sensors, total] = await Promise.all([
          prisma.sensor.findMany({
            where,
            skip,
            take:    pageSize,
            orderBy: [{ type: 'asc' }, { installedOn: 'asc' }],
          }),
          prisma.sensor.count({ where }),
        ]);

        logger.info({ count: sensors.length, total, page, pageSize }, 'GET /sensors');

        return reply.send({ sensors: sensors.map(toSensorPublic), total });
      } catch (err: unknown) {
        logger.error({ err }, 'GET /sensors failed');
        throw err;
      }
    },
  });

  // ── POST /sensors ─────────────────────────────────────────────────────────
  app.post('/sensors', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'ENGINEER')],
    handler: async (req, reply) => {
      const bodyParsed = CreateSensorBodySchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({ error: 'Validation error', details: bodyParsed.error.issues });
      }

      const { type, lat, lon, bopZoneId, installedOn } = bodyParsed.data;

      try {
        const sensor = await prisma.sensor.create({
          data: {
            type,
            lat,
            lon,
            bopZoneId:   bopZoneId ?? null,
            installedOn: new Date(installedOn),
            health:      'UNKNOWN',
          },
        });

        logger.info({ sensorId: sensor.id, type }, 'POST /sensors created sensor');

        return reply.code(201).send({ sensor: toSensorPublic(sensor) });
      } catch (err: unknown) {
        logger.error({ err }, 'POST /sensors failed');
        throw err;
      }
    },
  });

  // ── GET /sensors/:id ──────────────────────────────────────────────────────
  app.get('/sensors/:id', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR', 'VIEWER', 'ENGINEER')],
    handler: async (req, reply) => {
      const paramParsed = SensorIdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid id' });
      }

      const { id } = paramParsed.data;

      try {
        const sensor = await prisma.sensor.findUnique({ where: { id } });
        if (sensor === null) throw new NotFoundError('Sensor');

        return reply.send({ sensor: toSensorPublic(sensor) });
      } catch (err: unknown) {
        logger.error({ err, sensorId: id }, 'GET /sensors/:id failed');
        throw err;
      }
    },
  });

  // ── PATCH /sensors/:id/health ─────────────────────────────────────────────
  app.patch('/sensors/:id/health', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'ENGINEER')],
    handler: async (req, reply) => {
      const paramParsed = SensorIdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid id' });
      }

      const bodyParsed = UpdateHealthBodySchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({ error: 'Validation error', details: bodyParsed.error.issues });
      }

      const { id } = paramParsed.data;
      const { health, lastHeartbeat } = bodyParsed.data;

      try {
        const existing = await prisma.sensor.findUnique({ where: { id } });
        if (existing === null) throw new NotFoundError('Sensor');

        const updated = await prisma.sensor.update({
          where: { id },
          data: {
            health,
            ...(lastHeartbeat !== undefined
              ? { lastHeartbeat: new Date(lastHeartbeat) }
              : {}),
          },
        });

        logger.info({ sensorId: id, health }, 'PATCH /sensors/:id/health updated');

        return reply.send({ sensor: toSensorPublic(updated) });
      } catch (err: unknown) {
        logger.error({ err, sensorId: id }, 'PATCH /sensors/:id/health failed');
        throw err;
      }
    },
  });
};
