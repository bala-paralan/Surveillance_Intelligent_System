/**
 * BOP / Site Hierarchy routes — TASK-041.
 *
 * GET  /bop              — list all BOPs (VIEWER+)
 * GET  /bop/:id          — get single BOP with zones (VIEWER+, scope-checked)
 * GET  /bop/:id/zones    — list zones for BOP (VIEWER+)
 * POST /bop/sync         — trigger GIS sync (ADMIN only)
 * GET  /bop/sync/logs    — list last 20 sync logs (ADMIN | ENGINEER)
 */
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { verifyJwt, requireRole, requireScope } from '../middleware/auth.js';
import { runGisSync, GeoPackageMockSource } from '../services/gis-sync-service.js';
import { NotFoundError } from '../errors.js';
import { logger } from '../logger.js';

interface IdParams { id: string }

export const bopRoutes = async (app: FastifyInstance): Promise<void> => {

  // ── GET /bop ────────────────────────────────────────────────────────────────
  app.get('/bop', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR', 'VIEWER', 'ENGINEER')],
    handler: async (_req, reply) => {
      try {
        const bops = await prisma.bop.findMany({
          orderBy: { code: 'asc' },
          select: { id: true, code: true, name: true, createdAt: true, updatedAt: true },
        });
        return reply.send(bops);
      } catch (err: unknown) {
        logger.error({ err }, 'GET /bop failed');
        throw err;
      }
    },
  });

  // ── GET /bop/sync/logs — must be registered before /bop/:id ─────────────────
  app.get('/bop/sync/logs', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'ENGINEER')],
    handler: async (_req, reply) => {
      try {
        const logs = await prisma.gisSyncLog.findMany({
          orderBy: { startedAt: 'desc' },
          take: 20,
        });
        return reply.send(logs);
      } catch (err: unknown) {
        logger.error({ err }, 'GET /bop/sync/logs failed');
        throw err;
      }
    },
  });

  // ── GET /bop/:id ────────────────────────────────────────────────────────────
  app.get<{ Params: IdParams }>('/bop/:id', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR', 'VIEWER', 'ENGINEER')],
    handler: async (req, reply) => {
      const { id } = req.params;

      // Scope check — dynamically call requireScope with the resolved bopId
      await new Promise<void>((resolve, reject) => {
        requireScope(id)(req, reply, (err?: unknown) => {
          if (err) reject(err); else resolve();
        });
      });

      try {
        const bop = await prisma.bop.findUnique({
          where: { id },
          include: {
            bopZones: {
              orderBy: { code: 'asc' },
              select: {
                id:           true,
                code:         true,
                name:         true,
                parentZoneId: true,
                sensors:      true,
              },
            },
          },
        });
        if (!bop) throw new NotFoundError('BOP');
        return reply.send(bop);
      } catch (err: unknown) {
        logger.error({ err, bopId: id }, 'GET /bop/:id failed');
        throw err;
      }
    },
  });

  // ── GET /bop/:id/zones ──────────────────────────────────────────────────────
  app.get<{ Params: IdParams }>('/bop/:id/zones', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR', 'VIEWER', 'ENGINEER')],
    handler: async (req, reply) => {
      const { id } = req.params;

      try {
        const bop = await prisma.bop.findUnique({ where: { id }, select: { id: true } });
        if (!bop) throw new NotFoundError('BOP');

        const zones = await prisma.bopZone.findMany({
          where:   { bopId: id },
          orderBy: { code: 'asc' },
          select: {
            id:           true,
            code:         true,
            name:         true,
            parentZoneId: true,
            sensors:      true,
          },
        });
        return reply.send(zones);
      } catch (err: unknown) {
        logger.error({ err, bopId: id }, 'GET /bop/:id/zones failed');
        throw err;
      }
    },
  });

  // ── POST /bop/sync ──────────────────────────────────────────────────────────
  app.post('/bop/sync', {
    preHandler: [verifyJwt, requireRole('ADMIN')],
    handler: async (_req, reply) => {
      const source = new GeoPackageMockSource();
      // Fire-and-forget; caller gets 202 immediately
      runGisSync(source).catch((err: unknown) => {
        logger.error({ err }, 'Background GIS sync failed');
      });
      return reply.code(202).send({ message: 'GIS sync started' });
    },
  });
};
