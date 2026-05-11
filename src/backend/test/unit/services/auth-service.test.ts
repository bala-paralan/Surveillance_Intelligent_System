import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prismaStub, resetPrismaStub } from '../../utils/prisma-stub.js';

vi.mock('../../../src/db.js', () => ({ prisma: prismaStub }));

const {
  loginUser,
  refreshTokens,
  logoutUser,
  hashPassword,
  getUserById,
  verifyAccessToken,
} = await import('../../../src/services/auth-service.js');

const { config } = await import('../../../src/config.js');

const mkUser = (overrides: Record<string, unknown> = {}) => ({
  id:           'u1',
  email:        'a@b.c',
  passwordHash: bcrypt.hashSync('hunter2', 4),
  displayName:  'Alice',
  role:         'OPERATOR' as const,
  active:       true,
  bopScope:     [],
  zoneScope:    [],
  uiMode:       null,
  createdAt:    new Date(),
  updatedAt:    new Date(),
  ...overrides,
});

describe('services/auth-service', () => {
  beforeEach(() => resetPrismaStub());

  it('loginUser → returns access + refresh token on valid creds', async () => {
    const user = mkUser();
    prismaStub.user.findUnique.mockResolvedValue(user);
    prismaStub.refreshToken.create.mockResolvedValue({ id: 'rt1' });

    const out = await loginUser('a@b.c', 'hunter2');
    expect(out.accessToken.split('.').length).toBe(3);
    expect(out.refreshToken.length).toBeGreaterThan(50);
    expect(prismaStub.refreshToken.create).toHaveBeenCalled();
  });

  it('loginUser → 401 when user not found', async () => {
    prismaStub.user.findUnique.mockResolvedValue(null);
    await expect(loginUser('x@y.z', 'x')).rejects.toThrow(/Invalid credentials/);
  });

  it('loginUser → 401 when user inactive', async () => {
    prismaStub.user.findUnique.mockResolvedValue(mkUser({ active: false }));
    await expect(loginUser('a@b.c', 'hunter2')).rejects.toThrow(/Invalid credentials/);
  });

  it('loginUser → 401 when password wrong', async () => {
    prismaStub.user.findUnique.mockResolvedValue(mkUser());
    await expect(loginUser('a@b.c', 'wrong')).rejects.toThrow(/Invalid credentials/);
  });

  it('loginUser → defaults bopScope/zoneScope arrays when null', async () => {
    prismaStub.user.findUnique.mockResolvedValue(
      mkUser({ bopScope: null, zoneScope: null }) as never
    );
    prismaStub.refreshToken.create.mockResolvedValue({ id: 'rt1' });
    const out = await loginUser('a@b.c', 'hunter2');
    const decoded = jwt.verify(out.accessToken, config.JWT_ACCESS_SECRET) as { scope: { bop_ids: string[]; zone_ids: string[] } };
    expect(decoded.scope).toEqual({ bop_ids: [], zone_ids: [] });
  });

  it('refreshTokens rotates and issues new pair', async () => {
    // Create a "stored" hashed refresh token
    const raw = 'rawrefresh' + Math.random();
    const tokenHash = await bcrypt.hash(raw, 4);
    const record = {
      id: 'rt1',
      tokenHash,
      userId: 'u1',
      expiresAt: new Date(Date.now() + 10_000),
      user: mkUser({ id: 'u1', active: true }),
    };
    prismaStub.refreshToken.findMany.mockResolvedValue([record]);
    prismaStub.refreshToken.delete.mockResolvedValue({ id: 'rt1' });
    prismaStub.refreshToken.create.mockResolvedValue({ id: 'rt2' });

    const out = await refreshTokens(raw);
    expect(out.accessToken).toBeTypeOf('string');
    expect(out.refreshToken).not.toBe(raw);
    expect(prismaStub.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt1' } });
  });

  it('refreshTokens → 401 when no matching token', async () => {
    prismaStub.refreshToken.findMany.mockResolvedValue([]);
    await expect(refreshTokens('whatever')).rejects.toThrow(/Invalid or expired refresh token/);
  });

  it('refreshTokens → 401 when account disabled', async () => {
    const raw = 'rawX';
    prismaStub.refreshToken.findMany.mockResolvedValue([
      {
        id: 'rt1',
        tokenHash: await bcrypt.hash(raw, 4),
        userId: 'u1',
        expiresAt: new Date(Date.now() + 10_000),
        user: mkUser({ active: false }),
      },
    ]);
    await expect(refreshTokens(raw)).rejects.toThrow(/Account disabled/);
  });

  it('refreshTokens → ignores non-matching hashes before finding a match', async () => {
    const raw = 'rawY';
    const otherHash = await bcrypt.hash('different', 4);
    const matchHash = await bcrypt.hash(raw, 4);
    prismaStub.refreshToken.findMany.mockResolvedValue([
      { id: 'r_other', tokenHash: otherHash, userId: 'u', expiresAt: new Date(Date.now() + 10_000), user: mkUser() },
      { id: 'r_match', tokenHash: matchHash, userId: 'u', expiresAt: new Date(Date.now() + 10_000), user: mkUser() },
    ]);
    prismaStub.refreshToken.delete.mockResolvedValue({});
    prismaStub.refreshToken.create.mockResolvedValue({});
    const out = await refreshTokens(raw);
    expect(out.refreshToken).not.toBe(raw);
    expect(prismaStub.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'r_match' } });
  });

  it('refreshTokens → defaults scope arrays when DB has null', async () => {
    const raw = 'rawZ';
    prismaStub.refreshToken.findMany.mockResolvedValue([
      { id: 'r1', tokenHash: await bcrypt.hash(raw, 4), userId: 'u', expiresAt: new Date(Date.now() + 10_000), user: mkUser({ bopScope: null, zoneScope: null }) as never },
    ]);
    prismaStub.refreshToken.delete.mockResolvedValue({});
    prismaStub.refreshToken.create.mockResolvedValue({});
    const out = await refreshTokens(raw);
    expect(out.accessToken).toBeTypeOf('string');
  });

  it('logoutUser deletes matching record (idempotent on miss)', async () => {
    const raw = 'logoutme';
    prismaStub.refreshToken.findMany.mockResolvedValue([
      { id: 'rt1', tokenHash: await bcrypt.hash(raw, 4) },
    ]);
    prismaStub.refreshToken.delete.mockResolvedValue({ id: 'rt1' });
    await expect(logoutUser(raw)).resolves.toBeUndefined();
    expect(prismaStub.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt1' } });

    // Empty list → idempotent (no throw, no delete)
    prismaStub.refreshToken.delete.mockReset();
    prismaStub.refreshToken.findMany.mockResolvedValue([]);
    await expect(logoutUser('nope')).resolves.toBeUndefined();
    expect(prismaStub.refreshToken.delete).not.toHaveBeenCalled();
  });

  it('logoutUser → ignores non-matching hashes', async () => {
    prismaStub.refreshToken.findMany.mockResolvedValue([
      { id: 'rt1', tokenHash: await bcrypt.hash('other', 4) },
    ]);
    await expect(logoutUser('mine')).resolves.toBeUndefined();
    expect(prismaStub.refreshToken.delete).not.toHaveBeenCalled();
  });

  it('hashPassword produces a bcrypt-compatible hash', async () => {
    const h = await hashPassword('topsecret');
    expect(h.startsWith('$2')).toBe(true);
    expect(await bcrypt.compare('topsecret', h)).toBe(true);
  });

  it('getUserById returns the public projection', async () => {
    prismaStub.user.findUnique.mockResolvedValue({ id: 'u1' });
    expect(await getUserById('u1')).toEqual({ id: 'u1' });
  });

  it('verifyAccessToken decodes a signed token', async () => {
    const token = jwt.sign(
      { sub: 'u', email: 'x@y.z', role: 'ADMIN', roles: ['ADMIN'], scope: { bop_ids: [], zone_ids: [] } },
      config.JWT_ACCESS_SECRET,
      { expiresIn: 60 }
    );
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('u');
  });
});
