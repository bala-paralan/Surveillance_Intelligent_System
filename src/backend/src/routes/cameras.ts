/**
 * Camera CRUD routes — TASK-002.
 * All write operations require admin or operator role.
 */
import type { FastifyInstance } from 'fastify';
import {
  CreateCameraSchema,
  UpdateCameraSchema,
  ListCamerasSchema,
  createCamera,
  listCameras,
  getCameraById,
  updateCamera,
  deleteCamera,
  testCamera,
} from '../services/camera-service.js';
import { verifyJwt, requireRole } from '../middleware/auth.js';

interface IdParams { id: string }

export const cameraRoutes = async (app: FastifyInstance): Promise<void> => {

  // ── GET /cameras ──────────────────────────────────────────────────────────
  app.get('/cameras', {
    preHandler: [verifyJwt],
    handler: async (req, reply) => {
      const q = ListCamerasSchema.safeParse(req.query);
      if (!q.success) return reply.code(400).send({ error: q.error.flatten() });
      return reply.send(await listCameras(q.data));
    },
  });

  // ── GET /cameras/:id ──────────────────────────────────────────────────────
  app.get<{ Params: IdParams }>('/cameras/:id', {
    preHandler: [verifyJwt],
    handler: async (req, reply) => {
      return reply.send(await getCameraById(req.params.id));
    },
  });

  // ── POST /cameras ─────────────────────────────────────────────────────────
  app.post('/cameras', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR')],
    handler: async (req, reply) => {
      const body = CreateCameraSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
      const camera = await createCamera(body.data, req.user!.sub);
      return reply.code(201).send(camera);
    },
  });

  // ── PUT /cameras/:id ──────────────────────────────────────────────────────
  app.put<{ Params: IdParams }>('/cameras/:id', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR')],
    handler: async (req, reply) => {
      const body = UpdateCameraSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
      return reply.send(await updateCamera(req.params.id, body.data));
    },
  });

  // ── DELETE /cameras/:id ───────────────────────────────────────────────────
  app.delete<{ Params: IdParams }>('/cameras/:id', {
    preHandler: [verifyJwt, requireRole('ADMIN')],
    handler: async (req, reply) => {
      await deleteCamera(req.params.id);
      return reply.code(204).send();
    },
  });

  // ── POST /cameras/:id/test ────────────────────────────────────────────────
  app.post<{ Params: IdParams }>('/cameras/:id/test', {
    preHandler: [verifyJwt, requireRole('ADMIN', 'OPERATOR')],
    handler: async (req, reply) => {
      return reply.send(await testCamera(req.params.id));
    },
  });
};
