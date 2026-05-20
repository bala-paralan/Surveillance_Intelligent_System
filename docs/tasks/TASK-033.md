# TASK-033 — Multi-AOI Quadview Panel (1 / 2 / 4 split)

**Created:** 2026-04-24
**Phase:** 0 (Phase 0C)
**Priority:** P1
**Status:** Proposed
**Complexity:** M
**Primary owner:** Frontend Agent
**Collaborators:** QA Agent
**Depends on:** TASK-031, TASK-032
**Source:** SIS.txt discussion, 2026-04-24
**Estimate:** 3 sprint days

---

## Summary

The barrier screen in the control room is a single wall display. The operator must be able to split it into 1, 2 or 4 panels, each bound to its own AOI with its own catalogue, live sensor read-out, and alert feed. This is the operator's *"watch two borders at once"* surface.

## Goals

- Toggle between 1-up, 2-up (horizontal or vertical), 4-up (quadrant) layouts.
- Each pane independently selects an AOI from the TASK-031 list.
- Each pane renders its own map canvas, catalogue summary, and alert ticker — all driven by TASK-032's live catalogue.
- Layout choice persists per-operator.

## Non-goals

- More than 4 panes — video-wall layouts deferred to Phase 5 (TASK-029).
- Cross-pane drag-and-drop of sensors — Phase 0C polish.

## User stories

- As an operator on a single monitor, I want to split the screen 4-ways so I can cover 4 sub-zones at once.
- As a supervisor handing off a shift, I want the incoming operator to see my layout and AOI selection.

## Acceptance criteria

- [ ] Layout switcher in toolbar with 1 / 2H / 2V / 4 options.
- [ ] Each pane shares no state with its siblings except the selected operator identity.
- [ ] Layout + per-pane AOI persists to `user_preferences` and reloads on login.
- [ ] No map canvas initialises more than once per pane (memory profile < 400 MB for 4-up at 1080p).

## Technical design

### Frontend

- `QuadviewLayout` CSS-grid container with `template-areas` per layout.
- Each pane is an `AoiPane` component — composes `AoiMap` + `CataloguePanel` + `AlertsTicker`.
- Zustand `layoutStore` holds `layout`, `paneAois[]`.
- `user_preferences` table (small JSON blob) persisted via existing `/auth/me` extension.

### Backend

- Minimal: `PATCH /users/me/preferences` merges incoming JSON (Zod-validated).

## Testing strategy

- Unit: `layoutStore` transitions.
- E2E: switch layout, assign AOIs, reload — assert same layout and assignments.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| WebGL context limit (~8 per page) exceeded | Medium | Major | Single MapLibre instance shared across panes via `id`-based sources |
| Memory bloat at 4-up | Medium | Major | Virtualise catalogue lists; lazy-mount inactive panes |

## Rollout

1. Feature flag `feature.quadview`.
2. Enable for supervisors only for 1 week.
3. Roll out to all operators.

## Definition of done

- [ ] Acceptance criteria checked
- [ ] E2E green on Chromium + Firefox
- [ ] QA agent sign-off
- [ ] `docs/changelog/<date>-task-033.md` entry added
