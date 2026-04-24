# Sprint 2 Changelog — 2026-04-24

## TASK-002 · Camera CRUD API (Backend agent)

- `src/backend/src/repositories/camera-repo.ts` — Prisma wrapper; encrypted fields excluded from list view
- `src/backend/src/services/camera-service.ts` — AES-256-CBC encryption of RTSP URL + credentials; Zod input validation; `toPublic()` strips all encrypted fields from responses
- `src/backend/src/routes/cameras.ts` — 6 REST endpoints (list, get, create, update, delete, test-TCP); RBAC-gated

## TASK-004 · HLS Stream Proxy (Backend agent)

- `src/backend/src/services/stream-service.ts` — fluent-ffmpeg RTSP→HLS transcoder; per-camera idle timer (60 s); auto-cleanup of HLS segments on stop
- `src/backend/src/routes/streams.ts` — POST start, DELETE stop, GET list, GET HLS segment serve; auth gated

## TASK-005 · JWT Auth + RBAC (Backend agent)

- `src/backend/prisma/schema.prisma` — User, RefreshToken, Camera models + enums
- `src/backend/src/config.ts` — Zod env validation; exits on bad config
- `src/backend/src/crypto.ts` — AES-256-CBC encrypt/decrypt
- `src/backend/src/middleware/auth.ts` — `verifyJwt` + `requireRole()` Fastify preHandlers
- `src/backend/src/services/auth-service.ts` — login, refresh-token rotation, logout, hashPassword
- `src/backend/src/routes/auth.ts` — /auth/login (5 req/min), /refresh (5 req/min), /logout, /me
- `src/backend/src/index.ts` — server entrypoint; CORS, Helmet, rate-limit, static; error handler; graceful shutdown
- `src/backend/prisma/seed.ts` — seeds default ADMIN user (override via SEED_ADMIN_* env vars)

## TASK-003 · Camera Grid UI (Frontend agent)

- `dashboard/src/api/client.ts` — typed fetch wrapper; auto token refresh on 401
- `dashboard/src/api/auth.ts` — login, logout, getMe
- `dashboard/src/api/cameras.ts` — typed wrappers for all camera + stream endpoints
- `dashboard/src/store/cameraStore.ts` — Zustand store (CRUD, filter, stream URLs, test results)
- `dashboard/src/components/cameras/CameraStatusBadge.tsx` — colour-coded status pill
- `dashboard/src/components/cameras/CameraCard.tsx` — camera tile with actions (live, test, edit, delete)
- `dashboard/src/components/cameras/CameraFormModal.tsx` — shared add/edit form modal
- `dashboard/src/components/cameras/CameraPlayer.tsx` — HLS.js player with native-HLS fallback (Safari)
- `dashboard/src/components/cameras/CameraGrid.tsx` — paginated grid with toolbar, filters, all modals
- `dashboard/src/components/layout/PanelGrid.tsx` — added "IP Cameras" full-screen route
- `dashboard/src/components/layout/LeftSidebar.tsx` — added 📷 IP Cameras nav link

## Infrastructure

- `docs/tasks/TASK-002.md` through `TASK-005.md` created
- `src/backend/tsconfig.json` — excludes `prisma/` from rootDir compilation (seed uses tsx directly)
