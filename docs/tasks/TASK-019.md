# TASK-019 — Behavioral analytics (loitering, heatmaps, anomaly scoring)

**Created:** 2026-04-22
**Phase:** 2 (Advanced analytics)
**Priority:** P2
**Status:** Proposed
**Complexity:** L
**Primary owner:** Analytics Agent
**Collaborators:** Backend Agent, Frontend Agent, QA Agent
**Depends on:** TASK-016
**Estimate:** 10 sprint days

---

## Summary

Beyond "person detected" we want to surface higher-order signals: loitering (person stays in an area longer than normal), crowd-density heatmaps (where do people congregate), and anomaly scoring (motion pattern differs from baseline). These power differentiated alerts and analytics dashboards.

## Goals

- Loitering detector: fires when any tracked person dwells > N seconds in a zone.
- Heatmap: per-camera, per-hour pixel density aggregated from detection bboxes.
- Anomaly scoring: autoencoder on 30-day motion histogram; alert on reconstruction error > threshold.
- Left-object / removed-object: bag appears and stays > 5 min, or a known object disappears.

## Non-goals

- Pose estimation or action recognition (slip-and-fall, fighting) — future work.
- Re-identification across cameras.

## User stories

- As a retail manager, I want a heatmap of where customers cluster in the store.
- As a security analyst, I want to be alerted if a bag is left unattended in the lobby.
- As an ops lead, I want the system to flag unusual motion patterns without me authoring a rule.

## Acceptance criteria

- [ ] Loitering fires within 5s of threshold crossing.
- [ ] Heatmap generated daily, retained for 90 days, overlayable on live view snapshot.
- [ ] Anomaly model trained per camera on rolling 30-day window; false-positive rate ≤ 5% on pilot.
- [ ] Left-object detector requires static bbox for >= 300 frames (≈5 min at 1fps sampling) and previous scene absence.

## Technical design

### Analytics (`src/analytics/`)

- `detectors/loitering.py`: builds on TASK-016 dwell tracker.
- `detectors/heatmap.py`: accumulates bbox-center hits into a 64×36 grid; hourly flush to Postgres.
- `detectors/anomaly.py`: small conv-autoencoder on downsampled motion masks; trained by `trainers/anomaly_train.py` nightly.
- `detectors/object_persistence.py`: static-object detection via frame differencing + temporal smoothing.

### Backend (`src/backend/`)

- `GET /cameras/:id/heatmap?from=&to=` returns aggregated heatmap array.
- Pushes loitering / left-object / anomaly events through TASK-014 rule engine.
- Nightly job orchestrates anomaly retraining; stores model artifact in object storage.

### Frontend (`src/frontend/`)

- Heatmap overlay toggle on live view.
- Analytics dashboard: loitering events by hour, anomaly score timeline.

### Data model (Prisma)

```prisma
model Heatmap {
  id        String   @id @default(cuid())
  cameraId  String
  hourStart DateTime
  grid      Bytes    // 64x36 uint8 array
  @@unique([cameraId, hourStart])
}

model AnomalyModel {
  id        String   @id @default(cuid())
  cameraId  String
  version   Int
  modelUrl  String
  trainedAt DateTime
  metrics   Json
}
```

## Testing strategy

- Unit: loitering threshold accuracy with synthetic tracks; heatmap accumulation math; autoencoder inference wrapper.
- Golden set: left-object clips with ground-truth start/stop.
- Model quality gate: anomaly ROC-AUC ≥ 0.85 on holdout before promotion.

## Security

- Heatmap data is aggregated — no individual PII; still camera-scoped by RBAC.
- Anomaly models are per-tenant; never share model weights across sites.

## Observability

- `anomaly_retrain_duration_seconds`, `anomaly_model_version`, `heatmap_bytes_written_total`.
- Dashboard for model metrics over time.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Anomaly model drifts; stale baseline | High | Major | Nightly retrain + alert if metrics degrade |
| Loitering false positives in busy areas | High | Minor | Per-zone threshold tuning; cooldown |
| Heatmap storage grows fast | Medium | Minor | Downsample grid; retain daily summaries beyond 30 days |

## Rollout

1. Heatmap ships first (low-risk).
2. Loitering + left-object with flag; tune thresholds with pilot.
3. Anomaly detection trained on first site; expand after 4 weeks of tuning.

## Definition of done

- [ ] All acceptance criteria checked
- [ ] Pilot site 30-day evaluation report filed
- [ ] Model quality gates enforced in CI
- [ ] `docs/changelog/<date>-task-019.md` entry added
