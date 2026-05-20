# TASK-005 — JWT Auth + RBAC

| Field | Value |
|-------|-------|
| Phase | Sprint 2 |
| Priority | 🔴 Critical |
| Owner | Backend agent |
| Estimate | M (½ day) |
| Depends on | TASK-001 ✅ |
| Status | ✅ Done — commit `be9e850`, merged 2026-04-24 |

## Summary
Stateless JWT access tokens (15 min TTL) + opaque refresh tokens (7 day, stored in DB). Three roles: admin, operator, viewer. Rate-limited auth endpoints.

## Acceptance Criteria
- [x] `POST /auth/login` returns access_token + refresh_token; 401 on bad creds
- [x] `POST /auth/refresh` rotates refresh token, returns new access_token
- [x] `POST /auth/logout` revokes refresh token from DB (idempotent)
- [x] `GET  /auth/me` returns current user profile
- [x] All non-auth routes require valid Bearer JWT — `verifyJwt` preHandler populates `req.user`
- [x] RBAC middleware: `requireRole('ADMIN' | 'OPERATOR' | 'VIEWER')` factory
- [x] Rate limit: 5 req/min per IP on `/auth/login` and `/auth/refresh`
- [x] Passwords hashed with bcrypt (cost 12)
- [x] Refresh tokens stored hashed in DB (opaque tokens → bcrypt cost-10 hashes)

## Definition of Done
- [x] Login → access + refresh → refresh → new access all working (rotation on every refresh)
- [x] Role enforcement tested for each route
- [x] Rate limiting tested (429 on 6th req)
- [x] Integration tests passing

## Delivered artifacts
- `prisma/schema.prisma` — User, RefreshToken, Camera models with indexes and column mappings
- `sse/src/config.ts` — Zod env validation; process exits on bad config
- `sse/src/lib/crypto.ts` — AES-256-CBC `encrypt()` / `decrypt()`
- `sse/src/middleware/auth.ts` — `verifyJwt` preHandler + `requireRole(...roles)` factory
- `sse/src/services/auth-service.ts` — login (bcrypt 12), rotating refresh tokens (bcrypt 10 in DB), idempotent logout
- `sse/src/routes/auth.ts` — `/auth/login`, `/auth/refresh` (5 req/min), `/auth/logout`, `/auth/me`
- `sse/src/index.ts` — Fastify server with Helmet, CORS, rate-limit, static files, graceful SIGTERM/SIGINT shutdown
- `prisma/seed.ts` — seeds default ADMIN user (env-overrideable)
