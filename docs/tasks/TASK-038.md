# TASK-038 — Use-case Visualization Layer (tunnel / footstep-radius / direction glyphs)

**Created:** 2026-04-24
**Phase:** 0 (Phase 0C)
**Priority:** P0
**Status:** Proposed
**Complexity:** L
**Primary owner:** Frontend Agent
**Collaborators:** Analytics Agent, Design
**Depends on:** TASK-035, TASK-039
**Source:** SIS.txt discussion, 2026-04-24 — *"You can't show it as a waveform. You need to put some geolocation. Like they show the flight. At a distance, within this radius, people movement is there, whether it is a people movement or a human movement or a continuous."*
**Estimate:** 7 sprint days

---

## Summary

This task is the **difference between a sensor readout and an operational picture**. Instead of waveforms and confidence numbers, the operator sees the scene: a pulsing radius where footsteps are detected, a direction arrow, a tunnel icon where subsurface vibration is sustained, an animal-vs-human glyph, a vehicle lozenge. Think flight-tracker, not oscilloscope.

## Goals

- Map overlay renderer with a composable glyph system:
  - **Footstep radius** — pulsing ring around the sensor, radius = estimated distance, sector = estimated direction ±15°, colour = confidence.
  - **Tunnel indicator** — downward-pointing icon animating under the sensor, surfaces when subtype=`tunnel` sustains for > N seconds.
  - **Animal vs human glyphs** — distinct iconography; multiple entities aggregated into a group glyph above N=3.
  - **Vehicle lozenge** — oriented rectangle along estimated direction.
- All glyphs are live — they update as new events stream in via TASK-039.
- Fade-out on stale events (configurable `decay_s`, default 20 s).

## Non-goals

- 3D rendering (Phase 5).
- Per-operator custom glyph authoring.

## User stories

- As an operator, I see a pulsing ring around a sensor and I know instantly that there are people moving ~2 km away, direction NW.
- As an operator, I see a tunnel icon appearing under SE-14 and I know to alert the response team.

## Acceptance criteria

- [ ] Glyph library covers: footstep-radius, tunnel, animal, human, group, vehicle, drone, gunshot.
- [ ] Event → glyph render latency p95 < 500 ms from WebSocket receipt.
- [ ] Glyphs decay per-type on a configurable timer.
- [ ] Accessibility: every glyph has a textual label read out by screen reader (WCAG 2.1 AA).
- [ ] Colour-blind palette verified (Deuteranopia + Protanopia simulation).

## Technical design

### Frontend

- `GlyphLayer` component mounted inside `AoiMap` as a MapLibre canvas overlay.
- Each glyph is a React component driven by a `glyphStore` (Zustand) keyed by sensor_id + event_id.
- WebSocket subscription `/ws/fusion/events/:aoiId` feeds the store.
- Motion via Framer Motion / CSS keyframes — never CPU-expensive requestAnimationFrame loops.

### Analytics / Backend

- Backend guarantees event payload includes `render_hint` — a structured object the frontend can rely on (`{ glyph: 'footstep_radius', radius_m, bearing_deg, arc_deg, decay_s, confidence }`).
- Contract versioned; breaking changes require a frontend/backend coordinated release.

### Design

- Design Agent produces an SVG glyph set and a light-mode / dark-mode palette in `design/glyphs/`.
- Use-case library documented in `docs/design/glyphs.md`.

## Testing strategy

- Storybook story per glyph with live-reload.
- E2E: replay a fixture event stream and snapshot the map at 1-second intervals.
- Accessibility: automated axe run + manual screen-reader check.

## Security

- No raw sensor data reaches the frontend — only the `render_hint` payload.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Glyph soup in dense AOI | High | Major | Clustering at zoom-out; max N visible per sensor |
| Operator misreads confidence colour | Medium | Major | Colour + shape + label triple-encoding |

## Rollout

1. Behind `feature.glyph_layer`.
2. Enable for supervisors; collect feedback for 1 week.
3. Full rollout.

## Definition of done

- [ ] Acceptance criteria checked
- [ ] Storybook + E2E green
- [ ] Accessibility audit passed
- [ ] QA agent sign-off
- [ ] `docs/changelog/<date>-task-038.md` entry added
