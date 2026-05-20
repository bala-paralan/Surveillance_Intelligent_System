# TASK-042 — Engineering & Maintenance View (raw waveforms, health, thresholds, diagnostics)

**Created:** 2026-04-24
**Phase:** 0 (Phase 0C)
**Priority:** P1
**Status:** Proposed
**Complexity:** M
**Primary owner:** Frontend Agent
**Collaborators:** Backend Agent, Analytics Agent, QA Agent
**Depends on:** TASK-034, TASK-035
**Source:** SIS.txt discussion, 2026-04-24 — *"If you show this as a waveform, there are engineers sitting there. Yes sir, I have to feed the data. Understood. But this is not — as an end user I don't understand this."*
**Estimate:** 5 sprint days

---

## Summary

The engineering view is the counterpart to the operator view (TASK-034): it surfaces exactly the things the operator must *not* see. Waveforms, health history, threshold configuration, per-sensor diagnostics, manual calibration, and driver logs. It is gated to the `ENGINEER` role.

## Goals

- Route `/engineering` (gated) hosting a tabbed layout per sensor:
  1. **Live waveform** — seismic/acoustic signal; 10 s rolling + historical replay from the 24 h raw window.
  2. **Health history** — last 7 days of heartbeats, uptime %, latency distribution.
  3. **Thresholds** — ADMIN+ENGINEER can adjust classifier thresholds per BOP.
  4. **Diagnostics** — driver version, firmware version, last error, last calibration.
- Waveform export (CSV / WAV) gated by ADMIN approval for audit.
- Kill-switch to put a sensor into "maintenance" mode (excluded from fusion).

## Non-goals

- Remote firmware flash (requires separate vendor contract review).
- Vendor-specific config wizards — per-sensor docs only.

## User stories

- As an engineer, I need a waveform oscilloscope to validate a new sensor's install.
- As an admin, I need to put SE-14 into maintenance mode without deleting it.
- As an analyst, I need to export a 10 s waveform window for offline analysis after an incident.

## Acceptance criteria

- [ ] Waveform rendering smooth at 1 kHz sample rate on a mid-range laptop.
- [ ] Threshold edit round-trips through to TASK-035 classifier hot-reload.
- [ ] Maintenance-mode flag flows into TASK-039 fusion engine (excluded sensor, attested in outcome metadata).
- [ ] Export requires ADMIN approval + reason string; both logged.

## Technical design

### Frontend

- `EngineeringLayout` mounted under `/engineering` with `EngineeringRoute` guard.
- `WaveformCanvas` component — WebGL-backed (via `regl` or similar) for smooth 1 kHz traces.
- `HealthHistoryChart` reuses Recharts already in the bundle.
- `ThresholdsForm` — Zod-validated client-side mirror of the server schema.

### Backend

- `GET /engineering/sensors/:id/waveform?from=&to=` streams Float32 samples, protected by `ENGINEER`.
- `PATCH /engineering/sensors/:id/thresholds` triggers classifier hot-reload event.
- `POST /engineering/sensors/:id/maintenance` toggles `maintenance_mode` flag.

### Analytics

- Exposes a waveform-buffer read endpoint that the backend proxies; raw samples never hit the operator path.

## Testing strategy

- Unit: waveform down-sampling, threshold validation.
- Integration: threshold edit → classifier picks up new weight within 5 s.
- E2E: operator role denied `/engineering` (404); engineer role passes.

## Security

- Export actions dual-audited (request + approval rows).
- Waveform data transported over TLS only; no cross-origin exposure.
- All engineering-view actions tagged in `audit_log`.

## Observability

- Prometheus: `engineering_waveform_bytes_served_total`, `engineering_threshold_edits_total`, `engineering_maintenance_toggles_total`.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Accidental classifier retraining from bad threshold | Medium | Major | Diff preview before apply + rollback |
| Waveform streaming saturates network | Medium | Minor | Server-side decimation to client's viewport |
| Engineer forgets to un-set maintenance mode | High | Major | 24 h auto-expire with engineer reminder |

## Rollout

1. Ship waveform + health tabs first (read-only).
2. Thresholds tab second, behind `feature.threshold_edit`.
3. Maintenance mode last, after TASK-039 fusion consumer is confirmed.

## Definition of done

- [ ] Acceptance criteria checked
- [ ] Unit + integration + E2E green
- [ ] Auditing verified for every write path
- [ ] QA agent sign-off
- [ ] `docs/changelog/<date>-task-042.md` entry added
