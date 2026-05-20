/**
 * Alert routes — TASK-008.
 *
 * GET    /alerts                   — paginated alert list (VIEWER+)
 * POST   /alerts                   — create alert (ADMIN | OPERATOR | ENGINEER)
 * PATCH  /alerts/:id/acknowledge   — acknowledge (OPERATOR | ADMIN)
 * PATCH  /alerts/:id/escalate      — escalate (optionally attach to incident) (OPERATOR | ADMIN) [TASK-044]
 * PATCH  /alerts/:id/resolve       — resolve (OPERATOR | ADMIN)
 * GET    /alerts/stats             — severity counts for last 24 h (VIEWER+)
 *
 * On creation the alert is published to Redis channel "alerts:new" (non-fatal).
 * On escalation the alert is published to "alerts:escalated" (non-fatal).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { verifyJwt, requireRole } from '../middleware/auth.js';
import { NotFoundError, AppError } from '../errors.js';
import { logger } from '../logger.js';
import type { AlertType, AlertSeverity } from '@prisma/client';

// ── Zod schemas ──────────────────────────────────────────────────────────────

const AlertTypeSchema = z.enum([
  'INTRUSION', 'MOTION', 'PERSON', 'VEHICLE', 'SEISMIC', 'ACOUSTIC', 'SYSTEM',
]) as z.ZodType<AlertType>;

const AlertSeveritySchema = z.enum([
  'CRITICAL', 'HIGH', 'MEDIUM', 'LOW',
]) as z.ZodType<AlertSeverity>;

const CreateAlertBodySchema = z.object({
  type:      AlertTypeSchema.optional(),
  severity:  AlertSeveritySchema.optional(),
  cameraId:  z.string().min(1).optional(),
  bopZoneId: z.string().min(1).optional(),
  aoiId:     z.string().min(1).optional(),
  message:   z.string().min(1).max(500),
  metadata:  z.record(z.unknown()).optional(),
});

const ListAlertsQuerySchema = z.object({
  acknowledged: z
    .string()
    .transform(v => v === 'true')
    .optional(),
  severity:  AlertSeveritySchema.optional(),
  bopZoneId: z.string().optional(),
  aoiId:     z.string().optional(),
  limit:  z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const IdParamSchema = z.object({ id: z.string().min(1) });

// ── Public shape ─────────────────────────────────────────────────────────────

interface AlertPublic {
  id:             string;
  type:           AlertType;
  severity:       AlertSeverity;
  cameraId:       string | null;
  bopZoneId:      string | null;
  aoiId:          string | null;
  message:        string;
  acknowledged:   boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  escalated:      boolean;
  escalatedBy:    string | null;
  escalatedAt:    string | null;
  incidentId:     string | null;
  resolvedAt:     string | null;
  createdAt:      string;
}

const toAlertPublic = (row: {
  id:             string;
  type:           AlertType;
  severity:       AlertSeverity;
  cameraId:       string | null;
  bopZoneId:      string | null;
  aoiId:          string | null;
  message:        string;
  acknowledged:   boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  escalated:      boolean;
  escalatedBy:    string | null;
  escalatedAt:    Date | null;
  incidentId:     string | null;
  resolvedAt:     Date | null;
  createdAt:      Date;
}): AlertPublic => ({
  id:             row.id,
  type:           row.type,
  severity:       row.severity,
  cameraId:       row.cameraId,
  bopZoneId:      row.bopZoneId,
  aoiId:          row.aoiId,
  message:        row.message,
  acknowledged:   row.acknowledged,
  acknowledgedBy: row.acknowledgedBy,
  acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
  escalated:      row.escalated,
  escalatedBy:    row.escalatedBy,
  escalatedAt:    row.escalatedAt?.toISOString() ?? null,
  incidentId:     row.incidentId,
  resolvedAt:     row.resolvedAt?.toISOString() ?? null,
  createdAt:      row.createdAt.toISOString(),
});

// ── Redis publish (non-fatal) ─────────────────────────────────────────────────

const tryPublishAlert = async (alert: AlertPublic): Promise<void> => {
  try {
    const { createClient } = await import('redis');
    const redis = createClient({ url: process.env['REDIS_URL'] ?? 'redis://localhost:6379' });
    await redis.connect();
    await redis.publish('alerts:new', JSON.stringify(alert));
    await redis.disconnect();
  } catch (err: unknown) {
    logger.debug({ err }, 'Redis alerts:new publish skipped (non-fatal)');
  }
};

// ── Selected columns for list queries (no metadata for perf) ─────────────────

const ALERT_SELECT = {
  id:             true,
  type:           true,
  severity:       true,
  cameraId:       true,
  bopZoneId:      true,
  aoiId:          true,
  message:        true,
  acknowledged:   true,
  acknowledgedBy: true,
  acknowledgedAt: true,
  escalated:      true,
  escalatedBy:    true,
  escalatedAt:    true,
  incidentId:     true,
  resolvedAt:     true,
  createdAt:      true,
} as const;

const EscalateBodySchema = z.object({
  incidentId: z.string().min(1).optional(),
});

// ── Route plugin ──────────────────────────────────────────────────────────────

export const alertRoutes = async (app: FastifyInstance): Promise<void> => {

  // ── GET /alerts/stats (must be registered before /:id routes) ─────────────
  app.get('/alerts/stats', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR', 'VIEWER', 'ENGINEER')],
    handler: async (_req, reply) => {
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [critical, high, medium, low] = await Promise.all([
          prisma.alert.count({ where: { severity: 'CRITICAL', createdAt: { gte: since } } }),
          prisma.alert.count({ where: { severity: 'HIGH',     createdAt: { gte: since } } }),
          prisma.alert.count({ where: { severity: 'MEDIUM',   createdAt: { gte: since } } }),
          prisma.alert.count({ where: { severity: 'LOW',      createdAt: { gte: since } } }),
        ]);

        const total = critical + high + medium + low;
        return reply.send({ critical, high, medium, low, total });
      } catch (err: unknown) {
        logger.error({ err }, 'GET /alerts/stats failed');
        throw err;
      }
    },
  });

  // ── GET /alerts ───────────────────────────────────────────────────────────
  app.get('/alerts', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR', 'VIEWER', 'ENGINEER')],
    handler: async (req, reply) => {
      const q = ListAlertsQuerySchema.safeParse(req.query);
      if (!q.success) {
        return reply.code(400).send({ error: 'Invalid query', details: q.error.flatten() });
      }

      const { acknowledged, severity, bopZoneId, aoiId, limit, offset } = q.data;

      const where = {
        ...(acknowledged !== undefined ? { acknowledged } : {}),
        ...(severity    !== undefined ? { severity }    : {}),
        ...(bopZoneId   !== undefined ? { bopZoneId }   : {}),
        ...(aoiId       !== undefined ? { aoiId }       : {}),
      };

      try {
        const [rows, total] = await Promise.all([
          prisma.alert.findMany({
            where,
            select:  ALERT_SELECT,
            orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
            skip:    offset,
            take:    limit,
          }),
          prisma.alert.count({ where }),
        ]);

        const alerts: AlertPublic[] = rows.map(toAlertPublic);
        return reply.send({ alerts, total, page: { limit, offset } });
      } catch (err: unknown) {
        logger.error({ err }, 'GET /alerts failed');
        throw err;
      }
    },
  });

  // ── POST /alerts ──────────────────────────────────────────────────────────
  app.post('/alerts', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR', 'ENGINEER')],
    handler: async (req, reply) => {
      const body = CreateAlertBodySchema.safeParse(req.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'Validation error', details: body.error.flatten() });
      }

      const { type, severity, cameraId, bopZoneId, aoiId, message, metadata } = body.data;

      try {
        const row = await prisma.alert.create({
          data: {
            type:      type     ?? 'INTRUSION',
            severity:  severity ?? 'MEDIUM',
            cameraId:  cameraId  ?? null,
            bopZoneId: bopZoneId ?? null,
            aoiId:     aoiId     ?? null,
            message,
            metadata:  metadata ?? undefined,
          },
          select: ALERT_SELECT,
        });

        const alert = toAlertPublic(row);
        logger.info({ alertId: row.id, type: row.type, severity: row.severity }, 'POST /alerts created');

        // Publish to Redis (non-fatal)
        void tryPublishAlert(alert);

        return reply.code(201).send({ alert });
      } catch (err: unknown) {
        logger.error({ err }, 'POST /alerts failed');
        throw err;
      }
    },
  });

  // ── PATCH /alerts/:id/acknowledge ─────────────────────────────────────────
  app.patch('/alerts/:id/acknowledge', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR')],
    handler: async (req, reply) => {
      if (!req.user) throw new AppError(401, 'Unauthorized');

      const param = IdParamSchema.safeParse(req.params);
      if (!param.success) return reply.code(400).send({ error: 'Invalid id' });

      const { id } = param.data;

      try {
        const existing = await prisma.alert.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Alert');

        const row = await prisma.alert.update({
          where: { id },
          data: {
            acknowledged:   true,
            acknowledgedBy: req.user.sub,
            acknowledgedAt: new Date(),
          },
          select: ALERT_SELECT,
        });

        logger.info({ alertId: id, by: req.user.sub }, 'PATCH /alerts/:id/acknowledge');
        return reply.send({ alert: toAlertPublic(row) });
      } catch (err: unknown) {
        logger.error({ err, alertId: id }, 'PATCH /alerts/:id/acknowledge failed');
        throw err;
      }
    },
  });

  // ── PATCH /alerts/:id/escalate ────────────────────────────────────────────
  // Escalate an alert; optionally attach it to an existing incident. If no
  // incidentId is supplied the alert is flagged escalated but unattached and
  // can be linked later via PATCH /incidents/:id (alertIds) or by re-calling
  // this endpoint with an incidentId.
  app.patch('/alerts/:id/escalate', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR')],
    handler: async (req, reply) => {
      if (!req.user) throw new AppError(401, 'Unauthorized');

      const param = IdParamSchema.safeParse(req.params);
      if (!param.success) return reply.code(400).send({ error: 'Invalid id' });

      const body = EscalateBodySchema.safeParse(req.body ?? {});
      if (!body.success) {
        return reply.code(400).send({ error: 'Validation error', details: body.error.flatten() });
      }

      const { id } = param.data;
      const { incidentId } = body.data;

      try {
        const existing = await prisma.alert.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Alert');

        if (incidentId !== undefined) {
          const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
          if (!incident) throw new NotFoundError('Incident');
        }

        const row = await prisma.alert.update({
          where: { id },
          data: {
            escalated:   true,
            escalatedBy: req.user.sub,
            escalatedAt: new Date(),
            ...(incidentId !== undefined ? { incidentId } : {}),
          },
          select: ALERT_SELECT,
        });

        const alert = toAlertPublic(row);
        logger.info({ alertId: id, by: req.user.sub, incidentId: incidentId ?? null }, 'PATCH /alerts/:id/escalate');

        // Publish to Redis (non-fatal)
        void (async () => {
          try {
            const { createClient } = await import('redis');
            const redis = createClient({ url: process.env['REDIS_URL'] ?? 'redis://localhost:6379' });
            await redis.connect();
            await redis.publish('alerts:escalated', JSON.stringify(alert));
            await redis.disconnect();
          } catch (err: unknown) {
            logger.debug({ err }, 'Redis alerts:escalated publish skipped (non-fatal)');
          }
        })();

        return reply.send({ alert });
      } catch (err: unknown) {
        logger.error({ err, alertId: id }, 'PATCH /alerts/:id/escalate failed');
        throw err;
      }
    },
  });

  // ── PATCH /alerts/:id/resolve ─────────────────────────────────────────────
  app.patch('/alerts/:id/resolve', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR')],
    handler: async (req, reply) => {
      const param = IdParamSchema.safeParse(req.params);
      if (!param.success) return reply.code(400).send({ error: 'Invalid id' });

      const { id } = param.data;

      try {
        const existing = await prisma.alert.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Alert');

        const row = await prisma.alert.update({
          where: { id },
          data:  { resolvedAt: new Date() },
          select: ALERT_SELECT,
        });

        logger.info({ alertId: id }, 'PATCH /alerts/:id/resolve');
        return reply.send({ alert: toAlertPublic(row) });
      } catch (err: unknown) {
        logger.error({ err, alertId: id }, 'PATCH /alerts/:id/resolve failed');
        throw err;
      }
    },
  });
};
