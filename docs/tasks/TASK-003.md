# TASK-003 — Camera Grid UI with Live Thumbnails

| Field | Value |
|-------|-------|
| Phase | Sprint 2 |
| Priority | 🔴 High |
| Owner | Frontend agent |
| Estimate | M (½ day) |
| Depends on | TASK-001 ✅, TASK-002, TASK-004 |

## Summary
Camera management panel in the dashboard: list cameras in a responsive grid, add/edit/delete via modals, play HLS streams via HLS.js player.

## Acceptance Criteria
- [ ] Camera grid renders cards with: name, status dot, site, last_seen_at
- [ ] Add Camera modal: form with name, RTSP URL, credentials, site
- [ ] Edit / Delete actions available to admin/operator
- [ ] Clicking a camera card opens HLS.js player modal
- [ ] Player degrades gracefully when HLS not reachable
- [ ] All API calls go through typed `src/api/cameras.ts` client
- [ ] Component tests with RTL; no raw WebSocket in component

## Definition of Done
- [ ] Camera grid, add-modal, player all rendering
- [ ] RTL component tests passing
- [ ] No TypeScript errors; no inline styles
