# TASK-029 — Digital twin / floor plan view

**Created:** 2026-04-22
**Phase:** 5 (Platform polish)
**Priority:** P2
**Status:** Proposed
**Complexity:** M
**Primary owner:** Frontend Agent
**Collaborators:** Backend Agent, QA Agent
**Depends on:** TASK-021
**Estimate:** 6 sprint days

---

## Summary

Let customers upload a floor plan (image or PDF), drop camera pins, and see live status, alerts, and click-to-view overlays spatially. This adds situational awareness especially for larger sites.

## Goals

- Upload floor plan (PNG / JPG / PDF) per building.
- Drag-drop camera pins with rotation to indicate FOV direction.
- Live status + recent alert badges on pins.
- Click a pin → snapshot + quick link to live view.

## Non-goals

- Automatic 3D reconstruction.
- Real-time object position on map (would require cross-camera tracking).

## User stories

- As a site manager, I want to see at a glance where the offline camera is on the floor plan.
- As an operator, I want to click a pin to jump straight to that camera's live feed.
- As an admin, I want to upload a floor plan for each building in my site.

## Acceptance criteria

- [ ] Floor plan upload supports files up to 25 MB; PDF converted to PNG at import.
- [ ] Pin placement persisted; each pin has x/y, rotation, camera id.
- [ ] Live status updates in real time (uses heartbeat stream from TASK-013).
- [ ] Alert badge on pin blinks when an alert is active.
- [ ] Zoom and pan with keyboard shortcuts (arrows, +/-).

## Technical design

### Frontend (`src/frontend/`)

- `FloorPlan` component using `react-zoom-pan-pinch`.
- SVG overlay for pins; drag with `framer-motion`.
- Real-time state via existing WebSocket subscriptions.

### Backend (`src/backend/`)

- `POST /buildings/:id/floorplan` — multipart upload, PDF-to-PNG via `pdf-poppler`.
- `POST /buildings/:id/pins` — bulk upsert pins.
- `GET /buildings/:id/layout` — returns image URL + pins.

### Data model (Prisma)

```prisma
model FloorPlan {
  id         String  @id @default(cuid())
  buildingId String  @unique
  imageUrl   String
  widthPx    Int
  heightPx   Int
}

model CameraPin {
  id         String @id @default(cuid())
  floorPlanId String
  cameraId   String @unique
  x          Float
  y          Float
  rotationDeg Float
}
```

## Testing strategy

- Unit: pin persistence, status mapping.
- E2E: upload plan, place pin, confirm live status, trigger alert and see badge.

## Security

- Floor plans stored in object storage; signed URLs scoped to viewer.
- Building scope (TASK-021) enforced on all endpoints.

## Observability

- `floorplan_loads_total`, `pin_drags_total` (UX metric).

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| PDF conversion fails on odd files | Medium | Minor | Fallback path: accept image only; display error |
| Large floor plan images slow on mobile | Medium | Minor | Pre-generate tiles; lazy-load |
| Camera added without pin → invisible on map | High | Minor | "Unplaced cameras" tray in editor |

## Rollout

Feature flag `feature.floor_plan`; enable per tenant on request.

## Definition of done

- [ ] All acceptance criteria checked
- [ ] Mobile-web responsive check
- [ ] `docs/changelog/<date>-task-029.md` entry added
