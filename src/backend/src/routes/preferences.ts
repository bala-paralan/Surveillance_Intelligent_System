/**
 * User preferences routes — TASK-034.
 *
 * PATCH /users/me/preferences — update uiMode for the authenticated user.
 *   - Any authenticated user can set uiMode to 'operator'.
 *   - Only ENGINEER (or ADMIN) can set uiMode to 'engineering'.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { verifyJwt } from '../middleware/auth.js';
import { ForbiddenError } from '../errors.js';
import { logger } from '../logger.js';

const UiMode = z.enum(['operator', 'engineering']);

const PatchPreferencesBodySchema = z.object({
  uiMode: UiMode,
});

export const preferencesRoutes = async (app: FastifyInstance): Promise<void> => {

  // ── PATCH /users/me/preferences ─────────────────────────────────────────────
  app.patch('/users/me/preferences', {
    preHandler: [verifyJwt],
    handler: async (req, reply) => {
      const body = PatchPreferencesBodySchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

      const { uiMode } = body.data;
      const user = req.user!;

      // Only ENGINEER or ADMIN may switch to engineering mode
      if (uiMode === 'engineering' && user.role !== 'ENGINEER' && user.role !== 'ADMIN') {
        throw new ForbiddenError('Only ENGINEER or ADMIN users may set uiMode to engineering');
      }

      try {
        const updated = await prisma.user.update({
          where: { id: user.sub },
          data:  { uiMode },
          select: {
            id:          true,
            email:       true,
            displayName: true,
            role:        true,
            uiMode:      true,
            bopScope:    true,
            zoneScope:   true,
            createdAt:   true,
            updatedAt:   true,
          },
        });

        logger.info({ userId: user.sub, uiMode }, 'User preferences updated');
        return reply.send(updated);
      } catch (err: unknown) {
        logger.error({ err, userId: user.sub }, 'PATCH /users/me/preferences failed');
        throw err;
      }
    },
  });
};
