# TASK-036 — Acoustic Sensor Ingestion + Classification

**Created:** 2026-04-24
**Phase:** 0 (Phase 0B)
**Priority:** P0
**Status:** Proposed
**Complexity:** M
**Primary owner:** Analytics Agent
**Collaborators:** Backend Agent, QA Agent
**Depends on:** TASK-032
**Source:** SIS.txt discussion, 2026-04-24
**Estimate:** 5 sprint days

---

## Summary

Acoustic sensors complement seismic with audible-band signals: voices, vehicle engines, gunshots, drone rotors. The pipeline mirrors TASK-035's shape (driver → classifier → publisher → event table) but uses audio-domain models and a different feature extractor.

## Goals

- `AcousticDriver` interface with a reference UDP/Opus implementation.
- Classifier output classes: `voice / vehicle / gunshot / drone / animal / noise`.
- Direction of arrival (DOA) from microphone array geometry where available.
- Events published on `sensor:event:acoustic`.

## Acceptance criteria

- [ ] Classifier F1 ≥ 0.82 on a labelled fixture dataset.
- [ ] Gunshot detection latency (sample → event) p95 < 1.5 s.
- [ ] No raw audio persisted beyond 24 h.
- [ ] PII filter — never persist or publish recognised speech content.

## Technical design

### Analytics (`src/analytics/detectors/acoustic/`)

- Feature extractor: log-mel spectrogram + MFCC.
- Classifier: YAMNet fine-tune (or equivalent) on fixture set.
- DOA estimator only activated when the sensor reports array geometry in its metadata.
- Publisher reuses the Redis client from TASK-035.

### Backend

- `SensorEventType.ACOUSTIC` added; shared `SensorEvent` row shape from TASK-035.

## Security & privacy

- Raw audio treated as sensitive data — AES-256 at rest in the 24 h window.
- **Speech content classification produces only the class label — never transcribed text.**
- Audio retention override requires ADMIN + a logged justification string.

## Testing strategy

- Unit: classifier metrics on fixture; DOA estimator on synthetic array.
- Integration: Opus stream → event within p95 target.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| False-positive gunshots from thunder or vehicle backfire | High | Major | Ensemble with seismic event within ±2 s boosts confidence |
| Speech captured and stored inadvertently | Low | Critical | Retention enforced by nightly purge + audit log |

## Rollout

1. Reference driver on lab hardware.
2. 1 BOP pilot for 14 days, measure false-positive rate.
3. Broader rollout once gunshot FPR < 0.5 / day / sensor.

## Definition of done

- [ ] Acceptance criteria checked
- [ ] Unit + integration tests green
- [ ] Privacy review signed off
- [ ] `docs/changelog/<date>-task-036.md` entry added
