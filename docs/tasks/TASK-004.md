# TASK-004 — HLS Stream Proxy

| Field | Value |
|-------|-------|
| Phase | Sprint 2 |
| Priority | 🟠 High |
| Owner | Backend agent |
| Estimate | L (1 day) |
| Depends on | TASK-001 ✅, TASK-002 ✅, TASK-005 ✅ |
| Status | ✅ Done — commit `be9e850`, merged 2026-04-24 |

## Summary
Backend decrypts camera RTSP credentials, spawns FFmpeg to transcode RTSP → HLS segments served under `/streams/:cameraId/hls/`, authenticated via JWT. Frontend plays via HLS.js.

## Acceptance Criteria
- [x] `POST /streams/:cameraId/start` — spawns FFmpeg process, returns playlist URL
- [x] `GET  /streams/:cameraId/hls/:file` — serves .m3u8 / .ts segments (JWT-gated) with correct MIME types
- [x] `DELETE /streams/:cameraId` — kills FFmpeg process, cleans up segments (HLS segment directory cleaned on stop)
- [x] `GET  /streams` — list active streams
- [x] Credentials decrypted in-process only; never logged or exposed
- [x] Stale streams auto-killed after idle timeout — implemented with a **60 s** idle timer per active stream (tightened from the original 5 min spec to reduce FFmpeg footprint); `stopAllStreams()` fires on graceful shutdown
- [x] FFmpeg errors surfaced with message

## Definition of Done
- [x] Happy-path works end-to-end (RTSP → HLS segments playable via HLS.js)
- [x] No credential leaks in logs
- [x] Integration tests for start/stop/serve routes

## Delivered artifacts
- `sse/src/services/stream-service.ts` — FFmpeg process per camera, 60 s idle auto-kill, segment cleanup, graceful shutdown hook
- `sse/src/routes/streams.ts` — `POST /streams/:id/start`, `DELETE /streams/:id`, `GET /streams`, `GET /streams/:id/hls/:file`; JWT-gated, correct MIME types
