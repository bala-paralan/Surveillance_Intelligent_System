# TASK-002 — Camera CRUD API

| Field | Value |
|-------|-------|
| Phase | Sprint 2 |
| Priority | 🔴 High |
| Owner | Backend agent |
| Estimate | M (½ day) |
| Depends on | TASK-001 ✅, TASK-005 ✅ |
| Status | ✅ Done — commit `be9e850`, merged 2026-04-24 |

## Summary
REST API for creating, reading, updating and deleting IP cameras. RTSP URLs and credentials are stored AES-256-CBC encrypted. All write endpoints require JWT auth; reads require at minimum the VIEWER role.

## Acceptance Criteria
- [x] `POST /cameras` creates a camera; credentials encrypted before DB write — `camera-service.ts` applies AES-256-CBC to RTSP URL, username, password
- [x] `GET /cameras` returns list with last_seen_at, status, never raw credentials — encrypted fields excluded by `camera-repo.ts`
- [x] `GET /cameras/:id` returns single camera detail (no credentials in response) — `toPublic()` strips secrets
- [x] `PUT /cameras/:id` updates metadata / credentials (admin/operator only)
- [x] `DELETE /cameras/:id` hard-deletes (admin only)
- [x] `POST /cameras/:id/test` pings RTSP URL, returns latency_ms + reachable bool — TCP reachability check
- [x] All inputs validated with Zod; 400 on invalid body/params
- [x] 401 when no/invalid JWT; 403 when role insufficient — VIEWER read / ADMIN+OPERATOR write / ADMIN delete
- [x] Integration test for each route

## API Contract
```
POST   /cameras          body: CreateCameraInput
GET    /cameras          query: ?site_id=&status=&page=&limit=
GET    /cameras/:id
PUT    /cameras/:id      body: UpdateCameraInput
DELETE /cameras/:id
POST   /cameras/:id/test
```

## Definition of Done
- [x] All routes implemented and Zod-validated
- [x] Credentials never appear in API responses or logs — `toPublic()` contract enforced
- [x] Integration tests passing
- [x] OpenAPI comments on every route

## Delivered artifacts
- `sse/src/repositories/camera-repo.ts` — Prisma wrapper, encrypted fields excluded from list queries
- `sse/src/services/camera-service.ts` — AES-256-CBC encryption at rest, `toPublic()` response sanitizer
- `sse/src/routes/cameras.ts` — 6 endpoints (list / get / create / update / delete / test), Zod-validated, RBAC-gated
