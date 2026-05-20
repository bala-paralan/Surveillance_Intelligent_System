/**
 * Incident routes — TASK-044.
 *
 * GET    /incidents                  — paginated incident list (VIEWER+)
 * GET    /incidents/:id              — single incident with linked alerts (VIEWER+)
 * POST   /incidents                  — create incident (OPERATOR | ADMIN | ENGINEER)
 * PATCH  /incidents/:id              — update title/severity/responder/bopZoneId (OPERATOR | ADMIN)
 * PATCH  /incidents/:id/status       — transition status (OPERATOR | ADMIN)
 * DELETE /incidents/:id              — hard delete (ADMIN only)
 *
 * Status transitions: OPEN → IN_PROGRESS → INVESTIGATING → ESCALATED → RESOLVED → CLOSED
 * Server does not enforce a strict state machine; operators can move between
 * any two statuses to allow for triage corrections. The set of allowed values
 * is constrained by the IncidentStatus enum.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { verifyJwt, requireRole } from '../middleware/auth.js';
import { NotFoundError, AppError } from '../errors.js';
import { logger } from '../logger.js';
import type { AlertSeverity, IncidentStatus } from '@prisma/client';

// ── Zod schemas ──────────────────────────────────────────────────────────────

const AlertSeveritySchema = z.enum([
  'CRITICAL', 'HIGH', 'MEDIUM', 'LOW',
]) as z.ZodType<AlertSeverity>;

const IncidentStatusSchema = z.enum([
  'OPEN', 'IN_PROGRESS', 'INVESTIGATING', 'ESCALATED', 'RESOLVED', 'CLOSED',
]) as z.ZodType<IncidentStatus>;

const CreateIncidentBodySchema = z.object({
  title:     z.string().min(1).max(200),
  severity:  AlertSeveritySchema.optional(),
  status:    IncidentStatusSchema.optional(),
  bopZoneId: z.string().min(1).optional(),
  responder: z.string().min(1).max(120).optional(),
  // Optional initial set of alerts to attach.
  alertIds:  z.array(z.string().min(1)).optional(),
});

const UpdateIncidentBodySchema = z.object({
  title:     z.string().min(1).max(200).optional(),
  severity:  AlertSeveritySchema.optional(),
  bopZoneId: z.string().min(1).nullable().optional(),
  responder: z.string().min(1).max(120).nullable().optional(),
}).refine(
  (v) => Object.keys(v).length > 0,
  { message: 'Body must contain at least one updatable field' },
);

const UpdateIncidentStatusBodySchema = z.object({
  status: IncidentStatusSchema,
});

const ListIncidentsQuerySchema = z.object({
  status:    IncidentStatusSchema.optional(),
  severity:  AlertSeveritySchema.optional(),
  bopZoneId: z.string().optional(),
  limit:     z.coerce.number().int().min(1).max(200).default(50),
  offset:    z.coerce.number().int().min(0).default(0),
});

const IdParamSchema = z.object({ id: z.string().min(1) });

// ── Public shape ─────────────────────────────────────────────────────────────

interface IncidentPublic {
  id:         string;
  title:      string;
  severity:   AlertSeverity;
  status:     IncidentStatus;
  bopZoneId:  string | null;
  responder:  string | null;
  alertCount: number;
  openedAt:   string;
  resolvedAt: string | null;
  createdBy:  string;
  createdAt:  string;
  updatedAt:  string;
}

const INCIDENT_SELECT = {
  id:         true,
  title:      true,
  severity:   true,
  status:     true,
  bopZoneId:  true,
  responder:  true,
  openedAt:   true,
  resolvedAt: true,
  createdBy:  true,
  createdAt:  true,
  updatedAt:  true,
  _count:     { select: { alerts: true } },
} as const;

interface IncidentRow {
  id:         string;
  title:      string;
  severity:   AlertSeverity;
  status:     IncidentStatus;
  bopZoneId:  string | null;
  responder:  string | null;
  openedAt:   Date;
  resolvedAt: Date | null;
  createdBy:  string;
  createdAt:  Date;
  updatedAt:  Date;
  _count:     { alerts: number };
}

const toIncidentPublic = (row: IncidentRow): IncidentPublic => ({
  id:         row.id,
  title:      row.title,
  severity:   row.severity,
  status:     row.status,
  bopZoneId:  row.bopZoneId,
  responder:  row.responder,
  alertCount: row._count.alerts,
  openedAt:   row.openedAt.toISOString(),
  resolvedAt: row.resolvedAt?.toISOString() ?? null,
  createdBy:  row.createdBy,
  createdAt:  row.createdAt.toISOString(),
  updatedAt:  row.updatedAt.toISOString(),
});

// ── Redis publish (non-fatal) ─────────────────────────────────────────────────

const tryPublishIncident = async (channel: string, payload: unknown): Promise<void> => {
  try {
    const { createClient } = await import('redis');
    const redis = createClient({ url: process.env['REDIS_URL'] ?? 'redis://localhost:6379' });
    await redis.connect();
    await redis.publish(channel, JSON.stringify(payload));
    await redis.disconnect();
  } catch (err: unknown) {
    logger.debug({ err, channel }, 'Redis incident publish skipped (non-fatal)');
  }
};

// ── Route plugin ──────────────────────────────────────────────────────────────

export const incidentRoutes = async (app: FastifyInstance): Promise<void> => {

  // ── GET /incidents ────────────────────────────────────────────────────────
  app.get('/incidents', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR', 'VIEWER', 'ENGINEER')],
    handler: async (req, reply) => {
      const q = ListIncidentsQuerySchema.safeParse(req.query);
      if (!q.success) {
        return reply.code(400).send({ error: 'Invalid query', details: q.error.flatten() });
      }

      const { status, severity, bopZoneId, limit, offset } = q.data;
      const where = {
        ...(status    !== undefined ? { status }    : {}),
        ...(severity  !== undefined ? { severity }  : {}),
        ...(bopZoneId !== undefined ? { bopZoneId } : {}),
      };

      try {
        const [rows, total] = await Promise.all([
          prisma.incident.findMany({
            where,
            select:  INCIDENT_SELECT,
            orderBy: [{ severity: 'asc' }, { openedAt: 'desc' }],
            skip:    offset,
            take:    limit,
          }),
          prisma.incident.count({ where }),
        ]);

        const incidents: IncidentPublic[] = rows.map(toIncidentPublic);
        return reply.send({ incidents, total, page: { limit, offset } });
      } catch (err: unknown) {
        logger.error({ err }, 'GET /incidents failed');
        throw err;
      }
    },
  });

  // ── GET /incidents/:id ────────────────────────────────────────────────────
  app.get('/incidents/:id', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR', 'VIEWER', 'ENGINEER')],
    handler: async (req, reply) => {
      const param = IdParamSchema.safeParse(req.params);
      if (!param.success) return reply.code(400).send({ error: 'Invalid id' });

      const { id } = param.data;
      try {
        const row = await prisma.incident.findUnique({
          where:  { id },
          select: {
            ...INCIDENT_SELECT,
            alerts: {
              select: {
                id:        true,
                type:      true,
                severity:  true,
                message:   true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
              take:    50,
            },
          },
        });
        if (!row) throw new NotFoundError('Incident');
        return reply.send({ incident: toIncidentPublic(row), alerts: row.alerts });
      } catch (err: unknown) {
        logger.error({ err, incidentId: id }, 'GET /incidents/:id failed');
        throw err;
      }
    },
  });

  // ── POST /incidents ───────────────────────────────────────────────────────
  app.post('/incidents', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR', 'ENGINEER')],
    handler: async (req, reply) => {
      if (!req.user) throw new AppError(401, 'Unauthorized');

      const body = CreateIncidentBodySchema.safeParse(req.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'Validation error', details: body.error.flatten() });
      }

      const { title, severity, status, bopZoneId, responder, alertIds } = body.data;
      const createdBy = req.user.sub;

      try {
        const row = await prisma.incident.create({
          data: {
            title,
            severity:  severity ?? 'MEDIUM',
            status:    status   ?? 'OPEN',
            bopZoneId: bopZoneId ?? null,
            responder: responder ?? null,
            createdBy,
            alerts: alertIds && alertIds.length > 0
              ? { connect: alertIds.map((id) => ({ id })) }
              : undefined,
          },
          select: INCIDENT_SELECT,
        });

        const incident = toIncidentPublic(row);
        logger.info(
          { incidentId: row.id, by: createdBy, severity: row.severity, alertCount: incident.alertCount },
          'POST /incidents created',
        );

        void tryPublishIncident('incidents:new', incident);

        return reply.code(201).send({ incident });
      } catch (err: unknown) {
        logger.error({ err }, 'POST /incidents failed');
        throw err;
      }
    },
  });

  // ── PATCH /incidents/:id ──────────────────────────────────────────────────
  app.patch('/incidents/:id', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR')],
    handler: async (req, reply) => {
      const param = IdParamSchema.safeParse(req.params);
      if (!param.success) return reply.code(400).send({ error: 'Invalid id' });

      const body = UpdateIncidentBodySchema.safeParse(req.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'Validation error', details: body.error.flatten() });
      }

      const { id } = param.data;
      try {
        const existing = await prisma.incident.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Incident');

        const row = await prisma.incident.update({
          where:  { id },
          data:   body.data,
          select: INCIDENT_SELECT,
        });

        logger.info({ incidentId: id, fields: Object.keys(body.data) }, 'PATCH /incidents/:id');
        return reply.send({ incident: toIncidentPublic(row) });
      } catch (err: unknown) {
        logger.error({ err, incidentId: id }, 'PATCH /incidents/:id failed');
        throw err;
      }
    },
  });

  // ── PATCH /incidents/:id/status ───────────────────────────────────────────
  app.patch('/incidents/:id/status', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR')],
    handler: async (req, reply) => {
      const param = IdParamSchema.safeParse(req.params);
      if (!param.success) return reply.code(400).send({ error: 'Invalid id' });

      const body = UpdateIncidentStatusBodySchema.safeParse(req.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'Validation error', details: body.error.flatten() });
      }

      const { id } = param.data;
      const { status } = body.data;

      try {
        const existing = await prisma.incident.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Incident');

        const row = await prisma.incident.update({
          where: { id },
          data: {
            status,
            // RESOLVED/CLOSED stamp resolvedAt; moving back clears it.
            resolvedAt: status === 'RESOLVED' || status === 'CLOSED'
              ? (existing.resolvedAt ?? new Date())
              : null,
          },
          select: INCIDENT_SELECT,
        });

        const incident = toIncidentPublic(row);
        logger.info({ incidentId: id, from: existing.status, to: status }, 'PATCH /incidents/:id/status');

        void tryPublishIncident('incidents:status', { id, from: existing.status, to: status });

        return reply.send({ incident });
      } catch (err: unknown) {
        logger.error({ err, incidentId: id }, 'PATCH /incidents/:id/status failed');
        throw err;
      }
    },
  });

  // ── DELETE /incidents/:id ─────────────────────────────────────────────────
  app.delete('/incidents/:id', {
    preHandler: [verifyJwt, requireRole('ADMIN')],
    handler: async (req, reply) => {
      const param = IdParamSchema.safeParse(req.params);
      if (!param.success) return reply.code(400).send({ error: 'Invalid id' });

      const { id } = param.data;
      try {
        const existing = await prisma.incident.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Incident');

        await prisma.incident.delete({ where: { id } });
        logger.info({ incidentId: id }, 'DELETE /incidents/:id');
        return reply.code(204).send();
      } catch (err: unknown) {
        logger.error({ err, incidentId: id }, 'DELETE /incidents/:id failed');
        throw err;
      }
    },
  });
};
