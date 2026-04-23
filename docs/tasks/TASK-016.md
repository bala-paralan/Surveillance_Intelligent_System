# TASK-016 — Advanced zones & line-crossing rules engine

**Created:** 2026-04-22
**Phase:** 2 (Advanced analytics)
**Priority:** P1
**Status:** Proposed
**Complexity:** L
**Primary owner:** Analytics Agent
**Collaborators:** Frontend Agent, Backend Agent, QA Agent
**Depends on:** TASK-007, TASK-014
**Estimate:** 8 sprint days

---

## Summary

TASK-007 delivers basic polygon zones. This task extends them with directional line-crossing, dwell-time thresholds, per-zone class filters (e.g., "persons only, ignore vehicles"), and a visual zone editor on the frontend. The analytics service emits enriched detection events that include `zone_ids[]`, `crossing_direction`, and `dwell_seconds`.

## Goals

- Polygon zones with per-zone class filter and schedule.
- Directional line-crossing: "east→west" and "west→east" counted separately.
- Dwell-time detector: fires when an object stays in zone > N seconds.
- Visual editor on camera live view: draw polygons and lines, save with camera frame reference.

## Non-goals

- Counting analytics dashboards (in-scope for TASK-019 behavioral analytics).
- Multi-camera object tracking / handoff (Phase 5 candidate).

## User stories

- As a site manager, I want to know when any person crosses the west fence between 22:00 and 06:00.
- As a logistics supervisor, I want to count trucks crossing the gate line east-to-west.
- As a retail operator, I want an alert when a person lingers in front of the safe for more than 90 seconds.

## Acceptance criteria

- [ ] Zone/line definitions stored per-camera with a reference `frame_width × frame_height`.
- [ ] Line-crossing evaluated by intersecting the object's bbox-center trajectory with the line segment; direction determined by the side crossed.
- [ ] Dwell-time implemented via simple tracker (IoU matching) keeping per-object state in Redis with TTL.
- [ ] Editor renders over the live snapshot, supports polygon + line tools, handles up to 20 shapes per camera.
- [ ] Evaluation overhead adds ≤ 5% CPU on the analytics worker for 1080p@15fps.

## Technical design

### Analytics (`src/analytics/`)

- New module `detectors/zones.py`:
  - Accepts detection list + camera shape config.
  - Returns per-detection `zone_ids`, `crossings[]`, `dwell_seconds`.
- Simple tracker (`tracker/iou.py`) to maintain object ids across frames; falls back to `None` if tracker disabled.
- Publishes enriched event to `channel:detections` (consumed by TASK-014 rule engine).

### Frontend (`src/frontend/`)

- `ZoneEditor` component using SVG over a freshly fetched snapshot:
  - Polygon tool: click to add vertices, double-click to close.
  - Line tool: two-click directional arrow.
  - Right panel: class filter multi-select, schedule picker, dwell threshold input.
- Integrates into existing camera settings page.

### Backend (`src/backend/`)

- `POST /cameras/:id/zones` — validated with Zod; stores JSON + frame dimensions.
- Pushes zone updates to `channel:zone_updates`; analytics hot-reloads.

### Data model (Prisma)

```prisma
model CameraZone {
  id          String   @id @default(cuid())
  cameraId    String
  kind        ZoneKind // POLYGON | LINE
  coordinates Json     // [[x,y], ...] or [{from,to,direction}]
  classes     String[] // ["person","vehicle"]
  schedule    Json?    // cron-like or time window
  dwellSec    Int?
  frameW      Int
  frameH      Int
}

enum ZoneKind { POLYGON LINE }
```

## Testing strategy

- Unit (pytest): line-crossing direction, polygon point-in-poly, dwell accrual across frames, tracker identity persistence.
- Golden frames: committed small dataset (10 clips) with expected crossings annotated.
- E2E: operator draws a zone, triggers a person walk-through, asserts alert fires.

## Security

- Zone data stored per camera; no PII risk but covered by camera RBAC.
- Snapshot fetched for editor goes through same permission gate as live view.

## Observability

- Per-zone counters: `zone_crossings_total{camera_id,zone_id,direction}`.
- Grafana panel: top crossings per hour.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tracker identity drift causes duplicate crossings | High | Major | Debounce per object id + direction for 2s |
| Zones drift after PTZ movement | Medium | Major | Invalidate zones on PTZ events until operator re-anchors |
| Schedule timezone bugs | Medium | Minor | Store TZ per site; unit-test DST edges |

## Rollout

1. Ship detector behind `analytics.zones_v2` flag.
2. Migrate existing TASK-007 zones to new schema (additive — old fields remain valid).
3. Enable line-crossing + dwell on pilot sites; collect ROC data.

## Definition of done

- [ ] All acceptance criteria checked
- [ ] Golden-frame test suite in CI
- [ ] Editor UX reviewed with a real operator
- [ ] `docs/changelog/<date>-task-016.md` entry added
