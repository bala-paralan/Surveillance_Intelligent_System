# TASK-022 — Horizontal scaling for stream proxy

**Created:** 2026-04-22
**Phase:** 3 (Scale and operations)
**Priority:** P1
**Status:** Proposed
**Complexity:** L
**Primary owner:** Backend Agent
**Collaborators:** DevOps Agent, QA Agent
**Depends on:** TASK-004, TASK-011
**Estimate:** 8 sprint days

---

## Summary

The stream proxy today runs as a single backend pod that pulls RTSP, transcodes, and serves HLS. That pod is the bottleneck: adding a 50-viewer customer immediately saturates it. This task makes the stream proxy horizontally scalable with sticky routing by `camera_id` and Prometheus-based autoscaling.

## Goals

- Consistent-hash routing so a given camera is always served by the same proxy pod.
- Autoscale by CPU and in-flight-streams metric.
- Graceful drain: rolling updates don't kick viewers off.
- Per-stream metrics exported to Prometheus.

## Non-goals

- Multi-region failover (future).
- CDN offload (future).

## User stories

- As ops, I want stream proxy pods to scale out automatically when we onboard a new customer.
- As an operator, I never want my stream to cut because of a deploy.
- As an SRE, I want per-camera bitrate/FPS metrics.

## Acceptance criteria

- [ ] Stream proxy runs with ≥ 2 replicas; adding cameras does not require manual sharding.
- [ ] Ingress uses consistent hashing on the `camera_id` path segment.
- [ ] HPA scales 2→20 based on `stream_proxy_active_streams` and CPU.
- [ ] Rolling update drains connections: viewers reconnect to a new pod with < 2s playback gap.
- [ ] Per-camera metrics emitted: FPS, bitrate, viewers, uptime.

## Technical design

### Backend (`src/backend/`)

- Extract stream-proxy into its own service `src/backend/stream-proxy/` with its own Dockerfile.
- Each pod registers its `pod_id` → Redis set; new pods are discovered on the fly.
- On a request, ingress routes by `hash(camera_id) % N`; the pod pulls RTSP only if not already owning that camera.
- Graceful shutdown: on SIGTERM, stop accepting new streams but continue serving active ones for ≤ 30s.

### Infra / DevOps

- Kubernetes: HPA with custom metric (`stream_proxy_active_streams` via Prometheus Adapter).
- Ingress: NGINX with `ip_hash` → switched to `hash $arg_camera_id consistent;` to get camera-level stickiness.
- PodDisruptionBudget: `maxUnavailable: 1`.
- Rolling update `maxSurge: 25%`, `maxUnavailable: 0`.

### Data model

No schema change. Pod registry and per-camera ownership tracked in Redis.

## Testing strategy

- Unit: consistent-hash selection, camera reassignment on pod loss.
- Integration: simulated viewer load with k6 script; scale up from 2→5 pods, assert zero disconnects on scale event.
- Chaos: kill a random pod during load; viewers reconnect within 2s.

## Security

- No change to existing per-stream auth: signed URL still required.
- Pod registry entries expire after 30s if not refreshed.

## Observability

- `stream_proxy_active_streams{pod}`, `stream_proxy_fps{camera,pod}`, `stream_proxy_reassignments_total`, HPA target metrics dashboard.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Re-hash storm on pod scale event | High | Major | Minimize movement via consistent hashing; cap scale delta per window |
| Two pods racing to claim the same camera | Medium | Minor | Redis SETNX ownership lock with TTL |
| NGINX hash config subtly breaks on upgrade | Low | Major | Gate config behind unit test that replays hash to sample inputs |

## Rollout

1. Deploy as `v2` alongside existing proxy; route 10% of traffic with header match.
2. Monitor for 1 week; expand to 50% then 100%.
3. Decommission v1.

## Definition of done

- [ ] All acceptance criteria checked
- [ ] Load test report in `docs/performance/task-022.md`
- [ ] Chaos test green in CI
- [ ] `docs/changelog/<date>-task-022.md` entry added
