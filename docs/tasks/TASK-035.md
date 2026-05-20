# TASK-035 — Seismic Sensor Ingestion + Pattern Classification

**Created:** 2026-04-24
**Phase:** 0 (Phase 0B)
**Priority:** P0
**Status:** Proposed
**Complexity:** L
**Primary owner:** Analytics Agent
**Collaborators:** Backend Agent, DevOps Agent, QA Agent
**Depends on:** TASK-032
**Source:** SIS.txt discussion, 2026-04-24 — *"Works day and night, fog, rain, no visibility needed. Can estimate direction and approximate distance. Advanced systems classify patterns."*
**Estimate:** 8 sprint days

---

## Summary

Seismic sensors are the BOP's all-weather tripwire — they work in fog, rain, and at night where cameras fail. Raw vibration is noisy, so the ingestion pipeline must classify events into **tunnel / footsteps / vehicle / animal / noise** and estimate direction and approximate distance before handing the result to the fusion engine.

## Goals

- Ingestion adapter reads from the vendor SDK (push or poll; abstract behind a `SeismicDriver` interface).
- Raw samples are never persisted beyond a 24-hour rolling window — only events.
- Classifier output: `{ type, direction_deg, distance_m, confidence, pattern_window_ms }`.
- Events published on Redis channel `sensor:event:seismic` with `sensor_id`, `aoi_ids`, `timestamp`.
- Classifier ships with a baseline model and a retraining hook for per-BOP tuning.

## Non-goals

- Vendor-specific SDK drivers (only one reference driver ships; additional drivers tracked separately).
- Raw waveform viewer UI — TASK-042.

## User stories

- As an operator, I never see a waveform — I see *"continuous footsteps, ~2.1 km NW of sensor SE-14, pattern: human"*.
- As an analyst, I want to retrain the classifier on false positives captured from my BOP's terrain.
- As an engineer, I want the raw 24-hour window available in the engineering view for incident review.

## Acceptance criteria

- [ ] Driver interface defined with at least one reference implementation.
- [ ] Classifier F1 ≥ 0.80 on a labelled fixture dataset (tunnel / footstep / vehicle / animal / noise).
- [ ] Event latency (sample → Redis) p95 < 2 s.
- [ ] Raw samples beyond 24 h are purged by a scheduled job.
- [ ] Direction accurate to ±15°; distance within ±30% on the fixture set.

## Technical design

### Analytics (`src/analytics/`)

- New `src/analytics/detectors/seismic/` module with:
  - `driver.py` — abstract `SeismicDriver`; `driver_reference.py` — reference driver against a UDP waveform stream.
  - `classifier.py` — 1-D CNN trained on `datasets/seismic_v1/`.
  - `estimator.py` — direction via phase difference across a sensor triad; distance via magnitude decay model.
  - `publisher.py` — wraps Redis client.
- Exposes `GET /analytics/seismic/health` for DevOps.

### Backend

- Persists events to `sensor_event` table:
  ```prisma
  model SensorEvent {
    id           String   @id @default(cuid())
    sensorId     String
    aoiIds       String[]
    type         SensorEventType
    subtype      String?   // tunnel/footstep/vehicle/animal/noise
    directionDeg Float?
    distanceM    Float?
    confidence   Float
    occurredAt   DateTime
    payload      Json
    @@index([sensorId, occurredAt])
  }
  ```
- Subscribes to `sensor:event:seismic` and inserts.

### DevOps

- New `analytics-seismic` container in `docker-compose.yml`.
- Prometheus: `seismic_events_total`, `seismic_classifier_latency_ms`, `seismic_raw_window_bytes`.
- Grafana panel for event rates per BOP.

## Testing strategy

- Unit: classifier on fixture dataset; direction estimator with synthetic phase-shifted triad.
- Integration: UDP waveform stream → driver → classifier → Redis → Postgres roundtrip.
- Contract: `SensorEvent` schema versioned; breaking changes require a minor-version bump consumed by TASK-039.

## Security

- Driver transport encrypted (DTLS) where supported; otherwise restricted to VPN.
- Raw samples never leave the analytics container; purge verified in a nightly job.
- No raw lat/long in classifier logs.

## Observability

- Prometheus metrics above.
- Pino/Python-log line per event at `debug`; `info` for transitions to `tunnel` classifier output.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Classifier overfits to reference terrain | High | Major | Retraining hook + per-BOP model versioning |
| Raw-window storage bloats disk | Medium | Major | 24 h rolling delete verified by nightly job |
| Driver SDK licence restrictions | Medium | Major | Interface abstraction so drivers are swappable |

## Rollout

1. Reference driver on a lab sensor triad in staging for 7 days.
2. Side-by-side with existing manual log for 1 BOP pilot.
3. Full rollout once F1 ≥ 0.80 holds on pilot data.

## Definition of done

- [ ] Acceptance criteria checked
- [ ] Unit + integration tests green with `pytest`
- [ ] Classifier model versioned and committed
- [ ] QA agent sign-off
- [ ] `docs/changelog/<date>-task-035.md` entry added
