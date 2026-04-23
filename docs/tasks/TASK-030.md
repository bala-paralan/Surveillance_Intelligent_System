# TASK-030 — Offline-resilient edge recording with backfill

**Created:** 2026-04-22
**Phase:** 5 (Platform polish)
**Priority:** P2
**Status:** Proposed
**Complexity:** M
**Primary owner:** Analytics Agent
**Collaborators:** Backend Agent, DevOps Agent, QA Agent
**Depends on:** TASK-015, TASK-020
**Estimate:** 6 sprint days

---

## Summary

Extend the edge agent (TASK-020) with a local ring-buffer recording capability. When the uplink to cloud is unavailable, the edge device continues to record locally; when connectivity returns, it transparently backfills into the recording service in the cloud so playback and search "just work" across the outage window.

## Goals

- Edge-local ring buffer sized by disk (default 72 hours per camera).
- Detect cloud connectivity loss; continue recording + keep detections buffered.
- On reconnect, backfill segments in chronological order at throttled bandwidth.
- Surface "gap" indicator in playback UI when an edge is still catching up.

## Non-goals

- Edge-served playback (must backfill before playback works).
- Encrypted backfill over custom protocol (use same object storage uploads).

## User stories

- As a customer with flaky LTE, I want confidence that an outage doesn't mean missing footage.
- As an ops engineer, I want to see which edges are backfilling and how much remains.
- As an operator, I want playback to tell me when a window is still pending upload.

## Acceptance criteria

- [ ] Edge agent records to local SSD when uplink down; no frame drops during transition.
- [ ] Ring buffer rotates by oldest-first; configurable size per camera (min 24h, max 30 days).
- [ ] Backfill resumes automatically; bandwidth configurable (default 2 Mbps).
- [ ] Backend merges backfilled segments into timeline by `start_ts`; UI shows a "pending" overlay until uploaded.
- [ ] Integrity: SHA-256 of each segment verified on backend; mismatches quarantined.

## Technical design

### Analytics (`src/analytics/edge/`)

- `recorder.py`: writes HLS segments to local disk, maintains manifest, deletes oldest segment when ring-buffer full.
- `uplink_monitor.py`: pings backend health endpoint; on down, flips recording mode; on up, enqueues backfill worker.
- `backfill.py`: uploads via same multipart flow as TASK-015, with throttle + retry.

### Backend (`src/backend/`)

- `POST /recordings/segments/backfill` — accepts segments with `source=edge`, stores in warm tier directly.
- Segment table already supports `tier` from TASK-015; add `status` column (`pending_upload | uploaded | failed_verify`).

### Frontend (`src/frontend/`)

- Timeline: hashed-pattern overlay for segments with `status=pending_upload`; tooltip "Pending upload from edge".
- Admin edge page: per-edge backfill progress bar + ETA.

### Data model

```prisma
model Segment {
  // ... existing fields ...
  status  SegmentStatus @default(UPLOADED)
  source  SegmentSource @default(CLOUD)
}

enum SegmentStatus { UPLOADED PENDING_UPLOAD FAILED_VERIFY }
enum SegmentSource { CLOUD EDGE }
```

## Testing strategy

- Unit: ring-buffer rotation, uplink state machine, throttle calculation.
- Integration: simulate network partition with toxiproxy; verify buffering and backfill.
- E2E: forced 4h outage, verify timeline shows pending then uploaded; playback works post-backfill.

## Security

- Edge→cloud upload uses mTLS certificate established in TASK-020.
- Local storage encrypted at rest (dm-crypt on LUKS).
- Integrity verified server-side before marking segment authoritative.

## Observability

- `edge_backfill_bytes_pending{edge_id}`, `edge_uplink_state{state}`, `edge_disk_used_ratio`.
- Alert: backfill pending > 24h without progress.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Edge disk fills during extended outage | High | Major | Auto-rotate ring buffer; surface "oldest footage may be lost" banner |
| Backfill floods uplink on reconnect | High | Major | Throttle by default; adaptive to measured bandwidth |
| Segment corruption during crash | Medium | Major | fsync after segment write; hash verified on both ends |
| Clock drift between edge and cloud | Low | Minor | NTP required; record skew in segment metadata |

## Rollout

1. Ships as default with TASK-020 (tightly coupled) once both tested on pilot edges.
2. Customer-comms: banner in admin UI explaining outage behavior.

## Definition of done

- [ ] All acceptance criteria checked
- [ ] Chaos test suite (network partitions, disk-full, mid-upload crash) green
- [ ] Customer docs `docs/customer/outage-behavior.md` written
- [ ] `docs/changelog/<date>-task-030.md` entry added
