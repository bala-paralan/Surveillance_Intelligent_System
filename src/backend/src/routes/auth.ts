/**
 * Auth routes — login, refresh, logout, me.
 * Rate-limited: 5 req/min per IP on /login and /refresh.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { loginUser, refreshTokens, logoutUser, getUserById } from '../services/auth-service.js';
import { verifyJwt } from '../middleware/auth.js';
import { NotFoundError } from '../errors.js';

const LoginBody    = z.object({ email: z.string().email(), password: z.string().min(1) });
const RefreshBody  = z.object({ refresh_token: z.string().min(1) });
const LogoutBody   = z.object({ refresh_token: z.string().min(1) });

export const authRoutes = async (app: FastifyInstance): Promise<void> => {

  // Rate-limit auth endpoints — override global to 5 req/min
  const authRateLimit = { max: 5, timeWindow: '1 minute' };

  // ── POST /auth/login ─────────────────────────────────────────────────────
  app.post('/auth/login', {
    config: { rateLimit: authRateLimit },
    handler: async (req, reply) => {
      const body = LoginBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

      const { accessToken, refreshToken } = await loginUser(body.data.email, body.data.password);
      return reply.code(200).send({ access_token: accessToken, refresh_token: refreshToken, token_type: 'Bearer' });
    },
  });

  // ── POST /auth/refresh ───────────────────────────────────────────────────
  app.post('/auth/refresh', {
    config: { rateLimit: authRateLimit },
    handler: async (req, reply) => {
      const body = RefreshBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

      const { accessToken, refreshToken } = await refreshTokens(body.data.refresh_token);
      return reply.code(200).send({ access_token: accessToken, refresh_token: refreshToken, token_type: 'Bearer' });
    },
  });

  // ── POST /auth/logout ────────────────────────────────────────────────────
  app.post('/auth/logout', {
    preHandler: [verifyJwt],
    handler: async (req, reply) => {
      const body = LogoutBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

      await logoutUser(body.data.refresh_token);
      return reply.code(204).send();
    },
  });

  // ── GET /auth/me ─────────────────────────────────────────────────────────
  app.get('/auth/me', {
    preHandler: [verifyJwt],
    handler: async (req, reply) => {
      const user = await getUserById(req.user!.sub);
      if (!user) throw new NotFoundError('User');
      return reply.code(200).send(user);
    },
  });
};
