import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prismaStub, resetPrismaStub } from '../../utils/prisma-stub.js';

vi.mock('../../../src/db.js', () => ({ prisma: prismaStub }));

const { preferencesRoutes } = await import('../../../src/routes/preferences.js');
const { buildTestApp } = await import('../../utils/test-app.js');
const { bearer } = await import('../../utils/auth-helpers.js');

describe('routes/preferences', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    resetPrismaStub();
    app = await buildTestApp(preferencesRoutes);
  });
  afterEach(async () => { await app.close(); });

  it('requires auth', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/users/me/preferences', payload: { uiMode: 'operator' } });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 on missing/invalid body', async () => {
    const res = await app.inject({
      method: 'PATCH', url: '/users/me/preferences',
      headers: { authorization: bearer() },
      payload: { uiMode: 'nope' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('any authenticated user may set operator mode', async () => {
    prismaStub.user.update.mockResolvedValue({ id: 'u1', uiMode: 'operator' });
    const res = await app.inject({
      method: 'PATCH', url: '/users/me/preferences',
      headers: { authorization: bearer({ role: 'VIEWER' }) },
      payload: { uiMode: 'operator' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().uiMode).toBe('operator');
  });

  it('rejects engineering mode for non-engineer/non-admin', async () => {
    const res = await app.inject({
      method: 'PATCH', url: '/users/me/preferences',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { uiMode: 'engineering' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows engineering mode for ENGINEER', async () => {
    prismaStub.user.update.mockResolvedValue({ id: 'u1', uiMode: 'engineering' });
    const res = await app.inject({
      method: 'PATCH', url: '/users/me/preferences',
      headers: { authorization: bearer({ role: 'ENGINEER' }) },
      payload: { uiMode: 'engineering' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('allows engineering mode for ADMIN', async () => {
    prismaStub.user.update.mockResolvedValue({ id: 'u1', uiMode: 'engineering' });
    const res = await app.inject({
      method: 'PATCH', url: '/users/me/preferences',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
      payload: { uiMode: 'engineering' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('returns 500 on DB error (covers the catch + rethrow)', async () => {
    prismaStub.user.update.mockRejectedValue(new Error('db down'));
    const res = await app.inject({
      method: 'PATCH', url: '/users/me/preferences',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
      payload: { uiMode: 'operator' },
    });
    expect(res.statusCode).toBe(500);
  });
});
