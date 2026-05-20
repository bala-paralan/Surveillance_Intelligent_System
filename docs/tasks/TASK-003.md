# TASK-003 — Camera Grid UI with Live Thumbnails

| Field | Value |
|-------|-------|
| Phase | Sprint 2 |
| Priority | 🔴 High |
| Owner | Frontend agent |
| Estimate | M (½ day) |
| Depends on | TASK-001 ✅, TASK-002 ✅, TASK-004 ✅ |
| Status | ✅ Done — commit `bbad4db` (sis-dashboard), merged 2026-04-24 |

## Summary
Camera management panel in the dashboard: list cameras in a responsive grid, add/edit/delete via modals, play HLS streams via HLS.js player.

## Acceptance Criteria
- [x] Camera grid renders cards with: name, status dot, site, last_seen_at — `CameraStatusBadge` + `CameraCard`
- [x] Add Camera modal: form with name, RTSP URL, credentials, site — `CameraFormModal`
- [x] Edit / Delete actions available to admin/operator
- [x] Clicking a camera card opens HLS.js player modal — `CameraPlayer`
- [x] Player degrades gracefully when HLS not reachable — HLS.js + native HLS fallback for Safari
- [x] All API calls go through typed `src/api/cameras.ts` client — `client.ts` wrapper with automatic JWT refresh on 401
- [x] Component tests with RTL; no raw WebSocket in component

## Definition of Done
- [x] Camera grid, add-modal, player all rendering — wired as full-screen panel in `PanelGrid` + sidebar link
- [x] RTL component tests passing
- [x] No TypeScript errors; no inline styles

## Delivered artifacts
- `src/api/client.ts` — typed fetch wrapper, automatic JWT refresh on 401
- `src/api/auth.ts` + `src/api/cameras.ts` — typed wrappers for backend endpoints
- `src/store/cameraStore.ts` — Zustand store (CRUD, pagination, filters, stream URL, test results)
- Component stack: `CameraStatusBadge` → `CameraCard` → `CameraFormModal` → `CameraPlayer` → `CameraGrid`
- 📷 IP Cameras panel in `PanelGrid` + sidebar nav link
