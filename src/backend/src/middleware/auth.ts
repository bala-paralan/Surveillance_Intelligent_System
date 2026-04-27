/**
 * Fastify authentication middleware.
 * Verifies Bearer JWT on every request; populates request.user.
 */
import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { UnauthorizedError, ForbiddenError } from '../errors.js';
import type { Role } from '@prisma/client';

export interface JwtPayload {
  sub:   string;   // user id
  email: string;
  role:  Role;
  /** Array form — backwards compat with single-role tokens */
  roles: Role[];
  scope: {
    bop_ids:  string[];
    zone_ids: string[];
  };
  iat:   number;
  exp:   number;
}

// Augment FastifyRequest so downstream handlers get typed user
declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

/** Parse and verify the Bearer token from Authorization header */
export const verifyJwt = (
  req: FastifyRequest,
  _reply: FastifyReply,
  done: HookHandlerDoneFunction
): void => {
  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    done(new UnauthorizedError('Missing Bearer token'));
    return;
  }

  try {
    const raw = jwt.verify(token, config.JWT_ACCESS_SECRET) as JwtPayload;

    // Backwards compat: tokens without `roles` array use single `role`
    if (!raw.roles) {
      raw.roles = [raw.role];
    }
    if (!raw.scope) {
      raw.scope = { bop_ids: [], zone_ids: [] };
    }

    req.user = raw;
    done();
  } catch {
    done(new UnauthorizedError('Invalid or expired token'));
  }
};

/** Role-gating factory — use after verifyJwt */
export const requireRole = (...roles: Role[]) =>
  (req: FastifyRequest, _reply: FastifyReply, done: HookHandlerDoneFunction): void => {
    if (!req.user) { done(new UnauthorizedError()); return; }
    if (!roles.includes(req.user.role)) {
      done(new ForbiddenError(`Requires role: ${roles.join(' | ')}`));
      return;
    }
    done();
  };

/**
 * BOP scope gating factory — use after verifyJwt.
 * ADMINs always pass; other roles must have the bopId in their scope.
 */
export const requireScope = (bopId: string) =>
  (req: FastifyRequest, _reply: FastifyReply, done: HookHandlerDoneFunction): void => {
    if (!req.user) { done(new UnauthorizedError()); return; }

    const isAdmin = req.user.role === 'ADMIN';
    const inScope = req.user.scope.bop_ids.includes(bopId);

    if (!isAdmin && !inScope) {
      done(new ForbiddenError(`Access to BOP ${bopId} not permitted`));
      return;
    }
    done();
  };
