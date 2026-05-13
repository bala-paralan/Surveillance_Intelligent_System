/**
 * Catalogue routes — TASK-032 + TASK-035/036/037.
 *
 * GET  /aoi/:aoiId/catalogue  — list sensors + assets + cameras inside AOI
 * GET  /sensors               — list all sensors (paginated, optional ?bopZoneId)
 * POST /sensors               — create sensor
 * GET  /sensors/:id           — get single sensor
 * PATCH /sensors/:id/health   — update sensor health
 *
 * Phase 0B sensor events:
 * GET  /sensor-events         — list recent sensor events (VIEWER+)
 * POST /sensor-events         — create sensor event (analytics API key auth)
 */
import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { verifyJwt, requireRole } from '../middleware/auth.js';
import { NotFoundError, UnauthorizedError, ForbiddenError } from '../errors.js';
import { logger } from '../logger.js';
import { listForAoi, toSensorPublic } from '../services/catalogue-service.js';
import { config } from '../config.js';

// ── Zod schemas ──────────────────────────────────────────────────────────────

interface AoiIdParams { aoiId: string }
interface SensorIdParams { id: string }

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

// ── Sensor event Zod schemas ──────────────────────────────────────────────────

const SensorEventTypeSchema = z.enum([
  'SEISMIC_TUNNEL', 'SEISMIC_FOOTSTEP', 'SEISMIC_VEHICLE', 'SEISMIC_ANIMAL', 'SEISMIC_NOISE',
  'ACOUSTIC_VOICE', 'ACOUSTIC_GUNSHOT', 'ACOUSTIC_VEHICLE', 'ACOUSTIC_DRONE', 'ACOUSTIC_ANIMAL', 'ACOUSTIC_NOISE',
  'THERMAL_HUMAN', 'THERMAL_VEHICLE',
  'LIDAR_MOTION',
  'PAN_PERSON', 'PAN_VEHICLE',
]);

const ListSensorEventsQuerySchema = z.object({
  sensorId: z.string().optional(),
  type:     SensorEventTypeSchema.optional(),
  aoiId:    z.string().optional(),
  limit:    z.coerce.number().int().positive().max(500).optional().default(50),
  offset:   z.coerce.number().int().min(0).optional().default(0),
  from:     z.string().datetime().optional(),
  to:       z.string().datetime().optional(),
});

const CreateSensorEventBodySchema = z.object({
  sensorId:   z.string().min(1),
  type:       SensorEventTypeSchema,
  aoiIds:     z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  payload:    z.record(z.unknown()),
  occurredAt: z.string().datetime(),
});

// ── Route plugin ─────────────────────────────────────────────────────────────

export const catalogueRoutes = async (app: FastifyInstance): Promise<void> => {

  // ── GET /aoi/:aoiId/catalogue ─────────────────────────────────────────────
  app.get<{ Params: AoiIdParams }>('/aoi/:aoiId/catalogue', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR', 'VIEWER', 'ENGINEER')],
    handler: async (req, reply) => {
      const { aoiId } = req.params;

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
  app.get<{ Params: SensorIdParams }>('/sensors/:id', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR', 'VIEWER', 'ENGINEER')],
    handler: async (req, reply) => {
      const { id } = req.params;

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
  app.patch<{ Params: SensorIdParams }>('/sensors/:id/health', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'ENGINEER')],
    handler: async (req, reply) => {
      const bodyParsed = UpdateHealthBodySchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({ error: 'Validation error', details: bodyParsed.error.issues });
      }

      const { id } = req.params;
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

  // ── GET /sensor-events ────────────────────────────────────────────────────
  app.get('/sensor-events', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR', 'VIEWER', 'ENGINEER')],
    handler: async (req, reply) => {
      const queryParsed = ListSensorEventsQuerySchema.safeParse(req.query);
      if (!queryParsed.success) {
        return reply.code(400).send({ error: 'Invalid query', details: queryParsed.error.issues });
      }

      const { sensorId, type, aoiId, limit, offset, from, to } = queryParsed.data;

      const where: Prisma.SensorEventWhereInput = {
        ...(sensorId ? { sensorId } : {}),
        ...(type ? { type } : {}),
        ...(aoiId ? { aoiIds: { has: aoiId } } : {}),
        ...(from || to
          ? {
              occurredAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      };

      try {
        const [events, total] = await Promise.all([
          prisma.sensorEvent.findMany({
            where,
            orderBy: { occurredAt: 'desc' },
            skip:    offset,
            take:    limit,
          }),
          prisma.sensorEvent.count({ where }),
        ]);

        return reply.send({
          events: events.map((e) => ({
            id:         e.id,
            sensorId:   e.sensorId,
            type:       e.type,
            aoiIds:     e.aoiIds,
            confidence: e.confidence,
            payload:    e.payload,
            occurredAt: e.occurredAt.toISOString(),
            createdAt:  e.createdAt.toISOString(),
          })),
          total,
        });
      } catch (err: unknown) {
        logger.error({ err }, 'GET /sensor-events failed');
        throw err;
      }
    },
  });

  // ── POST /sensor-events ───────────────────────────────────────────────────
  // Analytics microservice posts events here. Auth is by static API key, not JWT.
  app.post('/sensor-events', async (req, reply) => {
    // Endpoint is disabled when no API key is configured (503).
    if (!config.ANALYTICS_API_KEY) {
      return reply.code(503).send({ error: 'sensor-events ingestion disabled' });
    }

    const provided = req.headers['x-analytics-api-key'];
    if (typeof provided !== 'string' || provided.length === 0) {
      throw new UnauthorizedError('Missing analytics API key');
    }
    if (provided !== config.ANALYTICS_API_KEY) {
      throw new ForbiddenError('Invalid analytics API key');
    }

    const bodyParsed = CreateSensorEventBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return reply.code(400).send({ error: 'Validation error', details: bodyParsed.error.issues });
    }

    const { sensorId, type, aoiIds, confidence, payload, occurredAt } = bodyParsed.data;

    try {
      const sensor = await prisma.sensor.findUnique({ where: { id: sensorId } });
      if (!sensor) throw new NotFoundError('Sensor');

      const event = await prisma.sensorEvent.create({
        data: {
          sensorId,
          type,
          aoiIds,
          confidence,
          payload:    payload as Prisma.InputJsonValue,
          occurredAt: new Date(occurredAt),
        },
      });

      logger.info({ eventId: event.id, sensorId, type }, 'POST /sensor-events ingested');
      return reply.code(201).send({ event: { id: event.id } });
    } catch (err: unknown) {
      logger.error({ err }, 'POST /sensor-events failed');
      throw err;
    }
  });
};
