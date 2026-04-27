# TASK-005 — JWT Auth + RBAC

| Field | Value |
|-------|-------|
| Phase | Sprint 2 |
| Priority | 🔴 Critical |
| Owner | Backend agent |
| Estimate | M (½ day) |
| Depends on | TASK-001 ✅ |

## Summary
Stateless JWT access tokens (15 min TTL) + opaque refresh tokens (7 day, stored in DB). Three roles: admin, operator, viewer. Rate-limited auth endpoints.

## Acceptance Criteria
- [ ] `POST /auth/login` returns access_token + refresh_token; 401 on bad creds
- [ ] `POST /auth/refresh` rotates refresh token, returns new access_token
- [ ] `POST /auth/logout` revokes refresh token from DB
- [ ] `GET  /auth/me` returns current user profile
- [ ] All non-auth routes require valid Bearer JWT
- [ ] RBAC middleware: requireRole('ADMIN' | 'OPERATOR' | 'VIEWER')
- [ ] Rate limit: 5 req/min per IP on /auth/login and /auth/refresh
- [ ] Passwords hashed with bcrypt (cost 12)
- [ ] Refresh tokens stored hashed in DB

## Definition of Done
- [ ] Login → access + refresh → refresh → new access all working
- [ ] Role enforcement tested for each route
- [ ] Rate limiting tested (429 on 6th req)
- [ ] Integration tests passing
