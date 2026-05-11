/**
 * Build a Fastify test app with a custom plugin and a sane error handler that
 * mirrors src/index.ts.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { AppError } from '../../src/errors.js';

export const buildTestApp = async (
  ...plugins: Array<(app: FastifyInstance) => Promise<void> | void>
): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({ error: err.message });
    }
    if (err.validation) {
      return reply.code(400).send({ error: 'Validation error', details: err.validation });
    }
    return reply.code(500).send({ error: 'Internal server error', message: err.message });
  });

  for (const plugin of plugins) {
    await app.register(plugin);
  }

  await app.ready();
  return app;
};
