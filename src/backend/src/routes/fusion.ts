/**
 * Fusion routes — TASK-039.
 *
 * GET  /aoi/:id/outcomes   — paginated fusion outcome history (VIEWER+)
 * PUT  /fusion/weights     — upsert a fusion weight entry (ADMIN only)
 * GET  /fusion/weights     — list current weights (VIEWER+)
 * POST /fusion/outcomes    — ingest a fusion outcome from analytics (ADMIN | ENGINEER)
 *   └─ publishes to Redis "alert:new" if confidence ≥ 0.75
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { verifyJwt, requireRole } from '../middleware/auth.js';
import { logger } from '../logger.js';
import { config } from '../config.js';

// ── Zod schemas ──────────────────────────────────────────────────────────────

interface IdParams { id: string }

const OutcomeHistoryQuery = z.object({
  from:   z.string().datetime().optional(),
  to:     z.string().datetime().optional(),
  limit:  z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const UpsertWeightBody = z.object({
  className:   z.string().min(1),
  prior:       z.number().min(0).max(1),
  likelihoods: z.record(z.string(), z.number().min(0).max(1)),
});

const IngestOutcomeBody = z.object({
  aoiId:              z.string().min(1),
  outcomeClass:       z.string().min(1),
  confidence:         z.number().min(0).max(1),
  supportingEventIds: z.array(z.string()).default([]),
  renderHint:         z.record(z.string(), z.unknown()).default({}),
  firstSeen:          z.string().datetime(),
  lastSeen:           z.string().datetime(),
});

// ── Public shapes ─────────────────────────────────────────────────────────────

interface FusionOutcomePublic {
  id:                 string;
  aoiId:              string;
  outcomeClass:       string;
  confidence:         number;
  supportingEventIds: string[];
  renderHint:         Record<string, unknown>;
  firstSeen:          string;
  lastSeen:           string;
  createdAt:          string;
}

interface FusionWeightPublic {
  id:          string;
  className:   string;
  prior:       number;
  likelihoods: Record<string, unknown>;
  updatedBy:   string;
  updatedAt:   string;
}

const toOutcomePublic = (row: {
  id:                 string;
  aoiId:              string;
  outcomeClass:       string;
  confidence:         number;
  supportingEventIds: string[];
  renderHint:         unknown;
  firstSeen:          Date;
  lastSeen:           Date;
  createdAt:          Date;
}): FusionOutcomePublic => ({
  id:                 row.id,
  aoiId:              row.aoiId,
  outcomeClass:       row.outcomeClass,
  confidence:         row.confidence,
  supportingEventIds: row.supportingEventIds,
  renderHint:         row.renderHint as Record<string, unknown>,
  firstSeen:          row.firstSeen.toISOString(),
  lastSeen:           row.lastSeen.toISOString(),
  createdAt:          row.createdAt.toISOString(),
});

const toWeightPublic = (row: {
  id:          string;
  className:   string;
  prior:       number;
  likelihoods: unknown;
  updatedBy:   string;
  updatedAt:   Date;
}): FusionWeightPublic => ({
  id:          row.id,
  className:   row.className,
  prior:       row.prior,
  likelihoods: row.likelihoods as Record<string, unknown>,
  updatedBy:   row.updatedBy,
  updatedAt:   row.updatedAt.toISOString(),
});

// ── Redis helper (non-fatal) ──────────────────────────────────────────────────

const tryPublishAlert = async (payload: Record<string, unknown>): Promise<void> => {
  try {
    const { createClient } = await import('redis');
    const redis = createClient({ url: config.REDIS_URL });
    await redis.connect();
    await redis.publish('alert:new', JSON.stringify(payload));
    await redis.disconnect();
  } catch (err: unknown) {
    logger.debug({ err }, 'Redis alert:new publish skipped (non-fatal)');
  }
};

// ── Route plugin ──────────────────────────────────────────────────────────────

export const fusionRoutes = async (app: FastifyInstance): Promise<void> => {

  // ── GET /aoi/:id/outcomes ─────────────────────────────────────────────────
  app.get<{ Params: IdParams }>('/aoi/:id/outcomes', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR', 'VIEWER', 'ENGINEER')],
    handler: async (req, reply) => {
      const query = OutcomeHistoryQuery.safeParse(req.query);
      if (!query.success) {
        return reply.code(400).send({ error: 'Invalid query', details: query.error.flatten() });
      }

      const { id: aoiId } = req.params;
      const { from, to, limit, offset } = query.data;

      const where = {
        aoiId,
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to   ? { lte: new Date(to)   } : {}),
              },
            }
          : {}),
      };

      try {
        const [rows, total] = await Promise.all([
          prisma.fusionOutcome.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }],
            skip:    offset,
            take:    limit,
          }),
          prisma.fusionOutcome.count({ where }),
        ]);

        const outcomes: FusionOutcomePublic[] = rows.map(toOutcomePublic);
        return reply.send({ outcomes, total });
      } catch (err: unknown) {
        logger.error({ err, aoiId }, 'GET /aoi/:id/outcomes failed');
        throw err;
      }
    },
  });

  // ── GET /fusion/weights ───────────────────────────────────────────────────
  app.get('/fusion/weights', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR', 'VIEWER', 'ENGINEER')],
    handler: async (_req, reply) => {
      try {
        const rows = await prisma.fusionWeight.findMany({
          orderBy: [{ className: 'asc' }],
        });
        return reply.send({ weights: rows.map(toWeightPublic) });
      } catch (err: unknown) {
        logger.error({ err }, 'GET /fusion/weights failed');
        throw err;
      }
    },
  });

  // ── PUT /fusion/weights ───────────────────────────────────────────────────
  app.put('/fusion/weights', {
    preHandler: [verifyJwt, requireRole('ADMIN')],
    handler: async (req, reply) => {
      const body = UpsertWeightBody.safeParse(req.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'Validation error', details: body.error.flatten() });
      }

      const { className, prior, likelihoods } = body.data;

      try {
        const row = await prisma.fusionWeight.upsert({
          where:  { className },
          create: {
            className,
            prior,
            likelihoods,
            updatedBy: req.user!.sub,
          },
          update: {
            prior,
            likelihoods,
            updatedBy: req.user!.sub,
          },
        });

        logger.info({ className, by: req.user!.sub }, 'PUT /fusion/weights upserted');
        return reply.send({ weight: toWeightPublic(row) });
      } catch (err: unknown) {
        logger.error({ err, className }, 'PUT /fusion/weights failed');
        throw err;
      }
    },
  });

  // ── POST /fusion/outcomes ─────────────────────────────────────────────────
  app.post('/fusion/outcomes', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'ENGINEER')],
    handler: async (req, reply) => {
      const body = IngestOutcomeBody.safeParse(req.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'Validation error', details: body.error.flatten() });
      }

      const {
        aoiId,
        outcomeClass,
        confidence,
        supportingEventIds,
        renderHint,
        firstSeen,
        lastSeen,
      } = body.data;

      try {
        const row = await prisma.fusionOutcome.create({
          data: {
            aoiId,
            outcomeClass,
            confidence,
            supportingEventIds,
            renderHint: renderHint as Prisma.InputJsonValue,
            firstSeen:  new Date(firstSeen),
            lastSeen:   new Date(lastSeen),
          },
        });

        const outcome = toOutcomePublic(row);
        logger.info(
          { outcomeId: row.id, outcomeClass, aoiId, confidence },
          'POST /fusion/outcomes ingested',
        );

        // Publish to Redis alert:new if confidence is high enough
        if (confidence >= 0.75) {
          void tryPublishAlert({
            source:      'fusion',
            outcomeId:   row.id,
            aoiId,
            outcomeClass,
            confidence,
            renderHint,
            firstSeen,
            lastSeen,
            createdAt:   row.createdAt.toISOString(),
          });
        }

        return reply.code(201).send({ outcome });
      } catch (err: unknown) {
        logger.error({ err, aoiId }, 'POST /fusion/outcomes failed');
        throw err;
      }
    },
  });
};
