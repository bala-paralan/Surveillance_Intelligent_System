# TASK-013 — Multi-camera live view enhancements

**Created:** 2026-04-22
**Phase:** 1 (Harden the core)
**Priority:** P0
**Status:** Proposed
**Complexity:** M
**Primary owner:** Frontend Agent
**Collaborators:** Backend Agent, DevOps Agent, QA Agent
**Depends on:** TASK-003, TASK-004
**Estimate:** 5 sprint days

---

## Summary

Today operators get a single quality tier on HLS and a fixed N×N grid. When uplink degrades or an operator is monitoring 16+ cameras on a laptop, the client chokes. This task adds adaptive bitrate streaming, a low-bandwidth snapshot mode, picture-in-picture, and camera health heartbeats so the grid degrades gracefully instead of freezing.

## Goals

- Adaptive bitrate (ABR) on HLS with three rungs: 1080p/4Mbps, 720p/1.5Mbps, 480p/600Kbps.
- "Low bandwidth" operator toggle that switches the grid to 1 FPS JPEG snapshots via a new `/cameras/:id/snapshot` endpoint.
- Floating picture-in-picture (PiP) player that survives route changes.
- Camera health heartbeats every 10s → grid shows `online / degraded / offline` indicators.

## Non-goals

- WebRTC (tracked separately for two-way audio in TASK-025).
- Multi-monitor / video-wall layouts (Phase 5 candidate).

## User stories

- As an operator, I want the grid to automatically drop resolution when my connection is poor so I don't lose visibility.
- As an operator, I want to detach a camera into a floating window so I can keep watching it while navigating recordings.
- As a supervisor, I want to see at a glance which cameras are offline without clicking into each one.

## Acceptance criteria

- [ ] HLS manifests published at 3 bitrate rungs; HLS.js auto-switches based on measured bandwidth.
- [ ] Low-bandwidth mode reduces per-camera bandwidth to ≤50 KB/s using MJPEG snapshots.
- [ ] PiP window renders outside the React root and persists across navigation.
- [ ] Each camera tile shows a status dot that reflects the last heartbeat within 15s.
- [ ] All new endpoints have Zod validation and JWT auth.
- [ ] No memory leaks after 1 hour of continuous grid viewing (verified via Chrome memory profiler).

## Technical design

### Frontend (`src/frontend/`)

- Extend `CameraGrid` with a `bandwidthMode: 'auto' | 'low'` prop stored in Zustand.
- Create `useCameraHealth` hook that subscribes to Redis-backed heartbeats via the existing WebSocket.
- New `PipPlayer` component that renders into a document-level portal and uses the Media Capabilities API to honor OS-level PiP when available.
- HLS.js config: `abrEwmaDefaultEstimate`, `startLevel: -1`, `capLevelToPlayerSize: true`.

### Backend (`src/backend/`)

- Add `GET /cameras/:id/snapshot` — returns a 720p JPEG, rate-limited to 2 req/s per camera per viewer, served from an in-memory LRU cache (TTL 1s).
- Extend the stream proxy to publish three HLS variant manifests by invoking FFmpeg with `-filter_complex` split + scale + multiple `-hls_segment_filename` outputs.
- Heartbeat job: every 10s, write `camera:health:{id}` to Redis with `last_seen`, `fps`, `bitrate`. WebSocket gateway broadcasts to subscribers.

### Data model (Prisma)

No schema change. Runtime state lives in Redis.

### Infra / DevOps

- Bump FFmpeg container CPU request from 1→2 cores due to extra encode rungs.
- Add Grafana panel: "Camera health (online/degraded/offline)" backed by a new Prometheus metric `camera_health_state{camera_id,state}`.

## Testing strategy

- Unit: `useCameraHealth`, ABR rung selection logic, snapshot rate limiter.
- Integration: spin up FFmpeg against a sample RTSP, assert three variant playlists are produced.
- E2E (Playwright): open grid of 16 cameras, simulate slow-3G, assert grid remains responsive.

## Security

- Snapshot endpoint must validate viewer's camera access list before serving.
- Never include the camera IP or credentials in the snapshot response headers.

## Observability

- Prometheus: `hls_abr_switches_total`, `camera_health_state`, `snapshot_requests_total`.
- Pino log on every ABR downshift with `camera_id`, `from_rung`, `to_rung`.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| FFmpeg CPU spike from 3-rung transcode | High | Major | Gate behind a feature flag; allow per-camera opt-out |
| PiP portal leaks DOM nodes on unmount | Medium | Minor | Add cleanup assertion in test; use `useEffect` cleanup |
| Snapshot endpoint becomes DoS surface | Medium | Major | Per-viewer and per-camera rate limit, LRU cache |

## Rollout

1. Ship behind `feature.abr_hls` flag, enable on staging for 48h.
2. Enable for 10% of production cameras, monitor CPU + viewer complaints.
3. Full rollout once CPU stays below 70% at p95 for 72h.

## Definition of done

- [ ] Acceptance criteria checked
- [ ] Unit + integration + E2E tests green
- [ ] QA agent sign-off
- [ ] Grafana dashboard updated
- [ ] `docs/changelog/<date>-task-013.md` entry added
