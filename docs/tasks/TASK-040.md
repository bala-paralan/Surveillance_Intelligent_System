# TASK-040 — Human-Readable Alerts on Live Map

**Created:** 2026-04-24
**Phase:** 0 (Phase 0C)
**Priority:** P0
**Status:** Proposed
**Complexity:** M
**Primary owner:** Frontend Agent
**Collaborators:** Backend Agent, Design, QA Agent
**Depends on:** TASK-039, TASK-041
**Source:** SIS.txt discussion, 2026-04-24 — *"Any alert. This is human readable alert. Alert means intuition is in this zone I have to manage."*
**Estimate:** 5 sprint days

---

## Summary

Raw fusion outcomes are still analytical objects. The operator needs them wrapped in a sentence they can read in a second and act on: *"Alpha-2 — 3 people moving NW, ~2.1 km from SE-14, confidence 0.92. First seen 09:14:03. Click to respond."* This task closes the loop from fusion to operator.

## Goals

- Alert banner / ticker on the live map, anchored to the AOI it concerns.
- Natural-language template renderer fed by `FusionOutcome` + AOI + sensor metadata.
- Severity colouring (info / warning / critical) derived from class + confidence + AOI risk tier.
- Acknowledge / assign / resolve actions (shares the rules engine from TASK-014 where possible).
- Alert persistence + history view scoped to an AOI.

## Non-goals

- SMS / push dispatch — shares with TASK-014 (Phase 1). Keep the same event bus.
- Custom operator-authored alert templates.

## User stories

- As an operator, I need to read what happened in under two seconds, not parse a JSON.
- As a supervisor, I want to see the last 50 alerts for Alpha-2 without switching screens.
- As a responder, I need one click to acknowledge and mark who's going.

## Acceptance criteria

- [ ] Natural-language template renders < 100 ms per alert.
- [ ] Alerts pin to their AOI on the map and hover-preview the full narrative.
- [ ] Ack / assign / resolve round-trip to backend and reflect across all connected clients within 2 s.
- [ ] History view loads 50 alerts in < 300 ms.
- [ ] Narrative never exposes sensor-ids of type `CAMERA` with private IP in a viewable form.

## Technical design

### Frontend

- `AlertTicker` + `AlertCard` + `AlertMarker` components.
- Template engine: simple `i18n` keys with interpolation slots.
- Redux-lite store (Zustand) merges WebSocket alerts with REST history.
- Sound cue for `critical` (default on, per-operator mute).

### Backend

- `alert_service.ts` subscribes to `fusion:outcome`, applies severity rules, persists to `alert` table, broadcasts on `alert:new`.
- `PATCH /alerts/:id` → ack / assign / resolve.
- Shared schema with TASK-014 so Sprint 3's alert feed upgrades in place rather than being replaced.

### Template engine

- Template strings like `"{count} {actor} moving {bearing}, ~{distance_km} km from {sensor_label}"`.
- Localisation-ready (en-US v1; hi-IN / ta-IN tracked in Phase 5).

## Testing strategy

- Unit: template rendering for all class/severity combinations.
- E2E: fire a fixture outcome, assert alert appears on the map and in the history.
- Contract: alert payload matches Sprint 3 `alert_event_v1` schema.

## Security

- Operator permissions enforced on every action.
- Ack/assign/resolve writes to `audit_log`.
- Alert narrative may include geographic coordinates — redacted for VIEWER role.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Alert storm overwhelms operator | Medium | Major | Per-AOI rate limit + severity floor |
| Narrative reads awkwardly in edge cases | High | Minor | Template review by design + ux-copy skill |

## Rollout

1. Shadow mode: alerts appear in history only for 48 h.
2. Enable live ticker behind `feature.alert_ticker`.
3. Enable sound cue last; gradual.

## Definition of done

- [ ] Acceptance criteria checked
- [ ] Unit + E2E tests green
- [ ] Design review passed
- [ ] QA agent sign-off
- [ ] `docs/changelog/<date>-task-040.md` entry added
