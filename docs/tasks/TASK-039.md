# TASK-039 — Multi-Sensor Fusion Engine (combined confidence scoring)

**Created:** 2026-04-24
**Phase:** 0 (Phase 0C)
**Priority:** P0
**Status:** Proposed
**Complexity:** L
**Primary owner:** Analytics Agent
**Collaborators:** Backend Agent, QA Agent
**Depends on:** TASK-035, TASK-036, TASK-037
**Source:** SIS.txt discussion, 2026-04-24 — *"One sensor could be fake to give one sensor, but if multiple sensor, if the score is high, the third score will be higher. That is also a sense of fruition and outcome."*
**Estimate:** 10 sprint days

---

## Summary

Any single sensor can be noisy, spoofed, or ambiguous. The fusion engine combines events from co-located sensors (inside the same AOI, within a small temporal window) into a **single threat hypothesis with a combined confidence score** and a categorical outcome (`animal | human | group | vehicle | drone | gunshot | tunnel | unknown`). This is the core intelligence of Phase 0C.

## Goals

- Stream processor subscribed to all `sensor:event:*` Redis channels.
- Spatial clustering: events grouped by sensor co-location within an AOI and a time window (default 3 s, configurable per event type).
- Weighted Bayesian fusion of per-sensor probabilities → posterior per-class.
- Outcome stream on `fusion:outcome` with schema `{ aoi_id, class, confidence, supporting_events[], first_seen, last_seen }`.
- Hot-reload of weights so operators/analysts can tune without redeploy.

## Non-goals

- Model-based object tracking across time (Phase 2, TASK-019).
- Reinforcement-learning-based tuning — manual weight tuning only in v1.

## User stories

- As an operator, I never see two events for the same intrusion — I see one fused hypothesis with a supporting-evidence list.
- As an analyst, I can adjust the weight of acoustic gunshot vs seismic vehicle and watch the outcome stream re-label without restarting anything.
- As an engineer, I can replay a past window through the engine to validate a weight change.

## Acceptance criteria

- [ ] Fusion latency (last supporting event → outcome publish) p95 < 1 s.
- [ ] Precision ≥ 0.85, Recall ≥ 0.80 on a labelled fixture of 500 scenarios.
- [ ] Weights editable via an ADMIN-only endpoint and persisted (`fusion_weight` table).
- [ ] Every outcome carries an auditable `supporting_events[]` for forensic replay.
- [ ] Replay mode consumes `sensor_event` history between two timestamps.

## Technical design

### Analytics (`src/analytics/fusion/`)

- `engine.py` — consumes Redis channels via `aioredis`, maintains per-AOI windowed buffers.
- `cluster.py` — DBSCAN-like clustering in (time, space) of supporting events.
- `bayes.py` — posterior computation; priors and likelihoods in `weights.yaml`, live-reloadable.
- `publisher.py` — publishes to `fusion:outcome`.

### Backend

- `fusion_outcome` table mirroring the stream for history queries.
- `GET /aoi/:id/outcomes?from=&to=` — paginated history (RBAC: VIEWER+).
- `PUT /fusion/weights` — ADMIN only; writes to DB and triggers hot-reload.

### Observability

- Prometheus: `fusion_outcomes_total{class}`, `fusion_latency_ms`, `fusion_weight_reloads_total`.
- Structured log per outcome at `info`, with `supporting_event_ids`.

## Testing strategy

- Unit: Bayesian combination on contrived posteriors.
- Fixture scenarios — 500 pre-labelled windows replayed end-to-end.
- Contract: `FusionOutcome` v1 schema frozen; TASK-038 and TASK-040 consume it.

## Security

- Weights-edit audit logged.
- Fusion outcomes never include raw sensor payloads, only supporting event ids + class summary.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Clustering window too narrow → missed correlations | Medium | Major | Per-sensor-type window; tunable via config |
| Weight drift degrades quality over time | High | Major | Weekly auto-eval against pinned fixture set; alert if F1 drops |
| Hot-reload race with in-flight events | Medium | Minor | Double-buffer weights; atomic swap on reload |

## Rollout

1. Shadow mode — engine runs alongside raw events for 2 weeks, operator still sees per-sensor events.
2. Switch operator UI to fusion outcomes behind `feature.fusion_primary`.
3. Deprecate per-sensor display after 30 days of clean operation.

## Definition of done

- [ ] Acceptance criteria checked
- [ ] Unit + fixture-replay tests green
- [ ] Weights editable in staging and hot-reloaded without dropped events
- [ ] QA agent sign-off
- [ ] `docs/changelog/<date>-task-039.md` entry added
