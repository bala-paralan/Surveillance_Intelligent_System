# TASK-034 — Role-split UI: Operator vs Engineering Views

**Created:** 2026-04-24
**Phase:** 0 (Phase 0A)
**Priority:** P0
**Status:** Proposed
**Complexity:** M
**Primary owner:** Frontend Agent
**Collaborators:** Backend Agent, QA Agent
**Depends on:** TASK-005 ✅
**Source:** SIS.txt discussion, 2026-04-24 — *"No one can understand this. This is for maintenance. End user will say I am a police officer, I don't even know anything about this."*
**Estimate:** 3 sprint days

---

## Summary

The current dashboard mixes operator-facing content (live view, alerts) with engineering artefacts (waveforms, system health, device config). The officer watching the screen does not and should not see raw seismic waveforms. We introduce two distinct UI modes, gated by a new `ENGINEER` role in addition to the existing ADMIN / OPERATOR / VIEWER roles.

## Goals

- Add `ENGINEER` role to the RBAC enum.
- Introduce `ui_mode` user preference — `operator` (default) or `engineering`.
- Operator mode shows: live map, AOI catalogue summary, human-readable alerts, recordings.
- Engineering mode adds: raw waveform viewer, sensor-health dashboards, threshold config, calibration tools (all deferred to TASK-042 for content; this task ships the mode switch and guards).
- Admin can assign `ENGINEER` role independently of OPERATOR — the two are not hierarchical.

## Non-goals

- The raw-waveform content itself (lives in TASK-042).
- Re-theming; operator and engineering share the same visual system, differ by content surface.

## User stories

- As an operator, I never want to accidentally land on a page with raw sensor waveforms — my UI must be intent-focused.
- As an engineer, I need a one-click toggle to switch into engineering mode to diagnose an issue.
- As an admin, I need to grant engineering access to a maintenance vendor without giving them operator alerting.

## Acceptance criteria

- [ ] Prisma `Role` enum extended with `ENGINEER`; migration tested on a seeded DB.
- [ ] `requireRole('ENGINEER')` middleware gates engineering-only routes (reserved for TASK-042).
- [ ] Routes with `/engineering/*` prefix are 404 for non-engineers even if the operator knows the URL.
- [ ] Toggle in user menu visible only when the user has the ENGINEER role.
- [ ] All audit logs tag which mode a given action was taken in.

## Technical design

### Backend

- Prisma migration adds `ENGINEER` to `Role`.
- `src/backend/middleware/auth.ts` already supports variadic `requireRole(...roles)` — used directly.
- JWT claims include `roles: string[]` — extend `access_token` issuer to include all roles, not just the primary.

### Frontend

- `AuthContext` exposes `hasRole('ENGINEER')`.
- `useUiMode()` hook reads `preferences.ui_mode` and writes through to `/users/me/preferences`.
- Route guard component `EngineeringRoute` renders `<NotFound />` for non-engineers.
- Sidebar conditional — engineering section hidden unless role present + mode active.

### Audit

- Every engineering-mode API call writes to `audit_log` with `mode: 'engineering'`.

## Testing strategy

- Unit: role predicate, route guard.
- Integration: login as operator, assert engineering routes return 404.
- E2E: role-switch flow end-to-end.

## Security

- Role assignment is ADMIN-only.
- Mode toggle does not grant role — it only chooses a view for a user who already has the role.
- Session rotation forced on role grant/revoke to prevent stale JWTs.

## Rollout

1. Behind `feature.engineer_role`.
2. Seed engineering vendor account in staging.
3. Enable in production once audit logging verified.

## Definition of done

- [ ] Acceptance criteria checked
- [ ] Unit + integration + E2E tests green
- [ ] QA agent sign-off
- [ ] `docs/changelog/<date>-task-034.md` entry added
