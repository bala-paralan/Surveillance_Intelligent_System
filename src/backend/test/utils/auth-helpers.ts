import jwt from 'jsonwebtoken';
import { config } from '../../src/config.js';
import type { JwtPayload } from '../../src/middleware/auth.js';
import type { Role } from '@prisma/client';

export interface SignOptions {
  sub?: string;
  email?: string;
  role?: Role;
  roles?: Role[];
  scope?: { bop_ids: string[]; zone_ids: string[] };
  expiresIn?: number;
}

export const signAccessToken = (opts: SignOptions = {}): string => {
  const role: Role = opts.role ?? 'ADMIN';
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub:   opts.sub   ?? 'user_admin_1',
    email: opts.email ?? 'admin@example.com',
    role,
    roles: opts.roles ?? [role],
    scope: opts.scope ?? { bop_ids: [], zone_ids: [] },
  };
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: opts.expiresIn ?? 3600,
  });
};

export const bearer = (opts: SignOptions = {}): string =>
  `Bearer ${signAccessToken(opts)}`;
