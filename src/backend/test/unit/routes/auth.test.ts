import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const loginUserSpy = vi.fn();
const refreshTokensSpy = vi.fn();
const logoutUserSpy = vi.fn();
const getUserByIdSpy = vi.fn();

vi.mock('../../../src/services/auth-service.js', () => ({
  loginUser: (...a: unknown[]) => loginUserSpy(...a),
  refreshTokens: (...a: unknown[]) => refreshTokensSpy(...a),
  logoutUser: (...a: unknown[]) => logoutUserSpy(...a),
  getUserById: (...a: unknown[]) => getUserByIdSpy(...a),
}));

const { authRoutes } = await import('../../../src/routes/auth.js');
const { buildTestApp } = await import('../../utils/test-app.js');
const { bearer } = await import('../../utils/auth-helpers.js');

describe('routes/auth', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    loginUserSpy.mockReset();
    refreshTokensSpy.mockReset();
    logoutUserSpy.mockReset();
    getUserByIdSpy.mockReset();
    app = await buildTestApp(authRoutes);
  });
  afterEach(async () => { await app.close(); });

  it('POST /auth/login returns tokens', async () => {
    loginUserSpy.mockResolvedValue({ accessToken: 'a.b.c', refreshToken: 'rt' });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'a@b.co', password: 'p' },
    });
    // Diagnose failures by printing the response body
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ access_token: 'a.b.c', refresh_token: 'rt', token_type: 'Bearer' });
  });

  it('POST /auth/login → 400 on invalid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'not-an-email' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /auth/refresh returns new tokens', async () => {
    refreshTokensSpy.mockResolvedValue({ accessToken: 'a2', refreshToken: 'r2' });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refresh_token: 'rt' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().access_token).toBe('a2');
  });

  it('POST /auth/refresh → 400 on invalid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /auth/logout → 204 when authenticated', async () => {
    logoutUserSpy.mockResolvedValue(undefined);
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: bearer() },
      payload: { refresh_token: 'rt' },
    });
    expect(res.statusCode).toBe(204);
  });

  it('POST /auth/logout → 400 on invalid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: bearer() },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /auth/logout → 401 without token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: { refresh_token: 'rt' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /auth/me returns the authenticated user', async () => {
    getUserByIdSpy.mockResolvedValue({ id: 'u1', email: 'me@x.com' });
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: bearer({ sub: 'u1' }) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: 'u1', email: 'me@x.com' });
  });

  it('GET /auth/me → 404 when user not found', async () => {
    getUserByIdSpy.mockResolvedValue(null);
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: bearer({ sub: 'missing' }) },
    });
    expect(res.statusCode).toBe(404);
  });
});
