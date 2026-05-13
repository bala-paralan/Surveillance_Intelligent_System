import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { verifyJwt, requireRole, requireScope } from '../../../src/middleware/auth.js';
import { buildTestApp } from '../../utils/test-app.js';
import { signAccessToken, bearer } from '../../utils/auth-helpers.js';

describe('middleware/auth', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp(async (a) => {
      a.get('/open', async () => ({ ok: true }));

      a.get(
        '/verify-only',
        { preHandler: [verifyJwt] },
        async (req) => ({ sub: req.user!.sub, role: req.user!.role, scope: req.user!.scope })
      );

      a.get(
        '/admin-only',
        { preHandler: [verifyJwt, requireRole('ADMIN')] },
        async () => ({ ok: true })
      );

      a.get(
        '/admin-or-eng',
        { preHandler: [verifyJwt, requireRole('ADMIN', 'ENGINEER')] },
        async () => ({ ok: true })
      );

      a.get(
        '/scope/:id',
        {
          preHandler: [
            verifyJwt,
            async (req, reply) =>
              new Promise<void>((resolve, reject) => {
                requireScope((req.params as { id: string }).id)(req, reply, (err) =>
                  err ? reject(err) : resolve()
                );
              }),
          ],
        },
        async () => ({ ok: true })
      );

      a.get(
        '/forced-no-user',
        {
          preHandler: [
            // Manually invoke requireRole without a prior verifyJwt — exercise the
            // "no req.user" branch.
            async (req, reply) =>
              new Promise<void>((resolve, reject) => {
                requireRole('ADMIN')(req, reply, (err) => (err ? reject(err) : resolve()));
              }),
          ],
        },
        async () => ({ ok: true })
      );

      a.get(
        '/forced-no-user-scope',
        {
          preHandler: [
            async (req, reply) =>
              new Promise<void>((resolve, reject) => {
                requireScope('bop-1')(req, reply, (err) => (err ? reject(err) : resolve()));
              }),
          ],
        },
        async () => ({ ok: true })
      );
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects requests with no Authorization header', async () => {
    const res = await app.inject({ method: 'GET', url: '/verify-only' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Missing Bearer token');
  });

  it('rejects malformed Authorization header (no Bearer prefix)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/verify-only',
      headers: { authorization: 'Basic foo' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Missing Bearer token');
  });

  it('rejects invalid/expired tokens', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/verify-only',
      headers: { authorization: 'Bearer not.a.real.jwt' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Invalid or expired token');
  });

  it('accepts a valid token and populates req.user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/verify-only',
      headers: { authorization: bearer({ sub: 'u1', role: 'VIEWER' }) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().sub).toBe('u1');
    expect(res.json().role).toBe('VIEWER');
  });

  it('backfills missing roles[] and scope on legacy tokens', async () => {
    // Hand-craft a JWT without `roles` or `scope` fields.
    const { config } = await import('../../../src/config.js');
    const jwt = (await import('jsonwebtoken')).default;
    const token = jwt.sign(
      { sub: 'u2', email: 'a@b.c', role: 'OPERATOR' as const },
      config.JWT_ACCESS_SECRET,
      { expiresIn: 60 }
    );
    const res = await app.inject({
      method: 'GET',
      url: '/verify-only',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().scope).toEqual({ bop_ids: [], zone_ids: [] });
  });

  it('requireRole rejects users without the role', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin-only',
      headers: { authorization: bearer({ role: 'VIEWER' }) },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toMatch(/Requires role/);
  });

  it('requireRole accepts users with the role', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin-only',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
    });
    expect(res.statusCode).toBe(200);
  });

  it('requireRole multi-role accepts any listed role', async () => {
    const r1 = await app.inject({
      method: 'GET',
      url: '/admin-or-eng',
      headers: { authorization: bearer({ role: 'ENGINEER' }) },
    });
    expect(r1.statusCode).toBe(200);
  });

  it('requireRole without prior verifyJwt — no user → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/forced-no-user' });
    expect(res.statusCode).toBe(401);
  });

  it('requireScope: ADMIN always passes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/scope/bop-x',
      headers: { authorization: bearer({ role: 'ADMIN', scope: { bop_ids: [], zone_ids: [] } }) },
    });
    expect(res.statusCode).toBe(200);
  });

  it('requireScope: non-ADMIN passes when bopId is in scope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/scope/bop-1',
      headers: {
        authorization: bearer({
          role: 'OPERATOR',
          scope: { bop_ids: ['bop-1'], zone_ids: [] },
        }),
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it('requireScope: non-ADMIN rejected when bopId not in scope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/scope/bop-other',
      headers: {
        authorization: bearer({
          role: 'OPERATOR',
          scope: { bop_ids: ['bop-1'], zone_ids: [] },
        }),
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toMatch(/Access to BOP/);
  });

  it('requireScope without prior verifyJwt — no user → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/forced-no-user-scope' });
    expect(res.statusCode).toBe(401);
  });

  it('signAccessToken helper works without explicit options (covers defaults)', () => {
    const t = signAccessToken();
    expect(typeof t).toBe('string');
    expect(t.split('.').length).toBe(3);
  });
});
