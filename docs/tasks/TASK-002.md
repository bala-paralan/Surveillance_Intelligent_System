# TASK-002 — Camera CRUD API

| Field | Value |
|-------|-------|
| Phase | Sprint 2 |
| Priority | 🔴 High |
| Owner | Backend agent |
| Estimate | M (½ day) |
| Depends on | TASK-001 ✅, TASK-005 |

## Summary
REST API for creating, reading, updating and deleting IP cameras. RTSP URLs and credentials are stored AES-256-CBC encrypted. All write endpoints require JWT auth; reads require at minimum the VIEWER role.

## Acceptance Criteria
- [ ] `POST /cameras` creates a camera; credentials encrypted before DB write
- [ ] `GET /cameras` returns list with last_seen_at, status, never raw credentials
- [ ] `GET /cameras/:id` returns single camera detail (no credentials in response)
- [ ] `PUT /cameras/:id` updates metadata / credentials (admin/operator only)
- [ ] `DELETE /cameras/:id` hard-deletes (admin only)
- [ ] `POST /cameras/:id/test` pings RTSP URL, returns latency_ms + reachable bool
- [ ] All inputs validated with Zod; 400 on invalid body/params
- [ ] 401 when no/invalid JWT; 403 when role insufficient
- [ ] Integration test for each route

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
- [ ] All routes implemented and Zod-validated
- [ ] Credentials never appear in API responses or logs
- [ ] Integration tests passing
- [ ] OpenAPI comments on every route
