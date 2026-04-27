# TASK-004 — HLS Stream Proxy

| Field | Value |
|-------|-------|
| Phase | Sprint 2 |
| Priority | 🟠 High |
| Owner | Backend agent |
| Estimate | L (1 day) |
| Depends on | TASK-001 ✅, TASK-002, TASK-005 |

## Summary
Backend decrypts camera RTSP credentials, spawns FFmpeg to transcode RTSP → HLS segments served under `/streams/:cameraId/hls/`, authenticated via JWT. Frontend plays via HLS.js.

## Acceptance Criteria
- [ ] `POST /streams/:cameraId/start` — spawns FFmpeg process, returns playlist URL
- [ ] `GET  /streams/:cameraId/hls/:file` — serves .m3u8 / .ts segments (JWT-gated)
- [ ] `DELETE /streams/:cameraId` — kills FFmpeg process, cleans up segments
- [ ] `GET  /streams` — list active streams with PID and viewer count
- [ ] Credentials decrypted in-process only; never logged or exposed
- [ ] Stale streams auto-killed after 5 min no-viewer timeout
- [ ] FFmpeg errors surfaced as 502 with message

## Definition of Done
- [ ] Happy-path works end-to-end in Docker Compose
- [ ] No credential leaks in logs
- [ ] Integration tests for start/stop/serve routes
