/**
 * Authentication service — login, token issuance, refresh, logout.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { UnauthorizedError } from '../errors.js';
import type { Role } from '@prisma/client';
import type { JwtPayload } from '../middleware/auth.js';

const BCRYPT_ROUNDS = 12;

// ── Token helpers ────────────────────────────────────────────────────────────

const issueAccessToken = (sub: string, email: string, role: Role): string =>
  jwt.sign({ sub, email, role }, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_TTL,
  });

const issueRefreshToken = (): string => randomBytes(48).toString('hex');

// ── Public API ───────────────────────────────────────────────────────────────

export const loginUser = async (
  email: string,
  password: string
): Promise<{ accessToken: string; refreshToken: string }> => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) throw new UnauthorizedError('Invalid credentials');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Invalid credentials');

  const rawRefresh = issueRefreshToken();
  const tokenHash = await bcrypt.hash(rawRefresh, 10);

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId:    user.id,
      expiresAt: new Date(Date.now() + config.JWT_REFRESH_TTL * 1000),
    },
  });

  return {
    accessToken:  issueAccessToken(user.id, user.email, user.role),
    refreshToken: rawRefresh,
  };
};

export const refreshTokens = async (
  rawRefresh: string
): Promise<{ accessToken: string; refreshToken: string }> => {
  // Find a matching non-expired token record
  const records = await prisma.refreshToken.findMany({
    where: { expiresAt: { gt: new Date() } },
    include: { user: true },
  });

  let matched: (typeof records)[number] | undefined;
  for (const r of records) {
    if (await bcrypt.compare(rawRefresh, r.tokenHash)) { matched = r; break; }
  }

  if (!matched) throw new UnauthorizedError('Invalid or expired refresh token');
  if (!matched.user.active) throw new UnauthorizedError('Account disabled');

  // Rotate: delete old, issue new
  await prisma.refreshToken.delete({ where: { id: matched.id } });

  const newRaw = issueRefreshToken();
  const newHash = await bcrypt.hash(newRaw, 10);

  await prisma.refreshToken.create({
    data: {
      tokenHash: newHash,
      userId:    matched.userId,
      expiresAt: new Date(Date.now() + config.JWT_REFRESH_TTL * 1000),
    },
  });

  return {
    accessToken:  issueAccessToken(matched.userId, matched.user.email, matched.user.role),
    refreshToken: newRaw,
  };
};

export const logoutUser = async (rawRefresh: string): Promise<void> => {
  const records = await prisma.refreshToken.findMany({
    where: { expiresAt: { gt: new Date() } },
  });

  for (const r of records) {
    if (await bcrypt.compare(rawRefresh, r.tokenHash)) {
      await prisma.refreshToken.delete({ where: { id: r.id } });
      return;
    }
  }
  // Not found — silently succeed (idempotent)
};

export const hashPassword = (plain: string): Promise<string> =>
  bcrypt.hash(plain, BCRYPT_ROUNDS);

export const getUserById = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, displayName: true, role: true, createdAt: true },
  });
  return user;
};

/** Verify JWT and return payload (for programmatic use in non-Fastify contexts) */
export const verifyAccessToken = (token: string): JwtPayload =>
  jwt.verify(token, config.JWT_ACCESS_SECRET) as JwtPayload;
