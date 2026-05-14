# TASK-031 — CI revival + production-readiness sprint

**Created:** 2026-05-14
**Phase:** Cross-cutting (infrastructure)
**Priority:** P0
**Status:** Proposed
**Complexity:** L
**Primary owner:** DevOps Agent (Lead) + Backend Agent + Frontend Agent + Analytics Agent + QA Agent
**Depends on:** —
**Estimate:** 8–12 sprint days (see budget breakdown below)
**Tracking issue:** #14

---

## Summary

The CI pipeline (`.github/workflows/ci.yml`) and deploy pipeline (`.github/workflows/deploy.yml`) were scaffolded by TASK-010 but have not been maintained in a working state. Shipping a small SENTRY logout fix (PR #9) revealed that **every gate job is currently red on `main`** for independent, pre-existing reasons, and that **`deploy.yml` itself is a stub** that does not actually push to any production environment.

This task scopes a dedicated sprint to:
1. Bring all three CI gate jobs to green on `main`.
2. Wire real production deploy targets in `deploy.yml`.
3. Re-introduce the quality gates (E2E, lint, coverage) that CLAUDE.md mandates but the workflow currently omits.
4. Add branch protection on `main` so this state of rot cannot recur silently.

## Why a sprint, not one-off PRs

While trying to ship PR #9, four prerequisite PRs were opened (#10, #11, #12, #13). Each addressed one visible failure and exposed the next layer of breakage when CI ran:

- #10 (add frontend lockfile) → `npm ci` passed but unmasked 2 frontend tsc errors
- #11 (fix those 2 frontend tsc errors) → still depends on #10 to even run
- #12 (regen backend lockfile) → `npm ci` passed but unmasked **9 backend tsc errors**, some of which are real type-safety issues (Prisma `InputJsonValue`, Zod tuple cast)
- #13 (analytics pythonpath) → `analytics-check` collection passes, but `npm test` for backend/frontend was never reached

Each layer revealed the next. Continuing this pattern of "one PR per visible failure" is unlikely to converge; the work needs to be scoped, owned, and executed as a coherent piece.

## Goals

- Every push to `main` runs CI with all three gate jobs green.
- Every push to `main` produces a real deploy to a known production environment.
- `npm test`, `pytest`, and **at minimum** type-check pass on every PR before merge.
- Branch protection on `main` enforces the above without relying on agent discipline.
- A documented runbook exists for "what to do when CI is red on `main`" (escalation, rollback, hotfix paths).

## Non-goals

- Migrating between deploy targets (Render ↔ Kubernetes ↔ other) — pick one, ship it, defer migration.
- Re-architecting the workspace structure to use npm/pnpm workspaces (separate task if desired).
- Backfilling test coverage to the levels CLAUDE.md aspires to — get to green first, raise the bar in a follow-up.

## Acceptance criteria

- [ ] `frontend-check` green on `main` (`npm ci` + `tsc --noEmit` + `vitest run`)
- [ ] `backend-check` green on `main` (`npm ci` + `tsc --noEmit` + `npm test` against Postgres+PostGIS service container)
- [ ] `analytics-check` green on `main` (`pip install -r requirements.txt` + `pytest`)
- [ ] `deploy.yml` triggers a real deploy on push to `main`; verified by a no-op commit producing a new revision in the chosen environment
- [ ] Branch protection on `main`: required status checks = all three gate jobs; require linear history; require ≥1 approving review
- [ ] Playwright E2E job added to `ci.yml` (referenced in CLAUDE.md but currently absent)
- [ ] `npm run lint` job added (referenced in CLAUDE.md but currently absent)
- [ ] `docs/runbooks/ci-red-on-main.md` written

## Known scope — what specifically needs to ship

### 1. Frontend gate (estimated 1–2 days)

| Item | Status | PR / location |
|---|---|---|
| Commit `src/frontend/package-lock.json` | Drafted in PR #10 | Ready for review |
| Add `src/frontend/src/vite-env.d.ts` for Vite client types | Drafted in PR #11 | Ready for review |
| Remove unused `DrawSelectionChangeEvent` in `AoiMap.tsx` | Drafted in PR #11 | Ready for review |
| Verify `vitest run` finds and passes all tests | Need green CI run | Test from PR #9 already exists |

### 2. Backend gate (estimated 4–6 days — riskiest)

| Item | Status | Notes |
|---|---|---|
| Regen `src/backend/package-lock.json` | Drafted in PR #12 | Mechanical |
| 4 unused-import errors | Not yet drafted | Trivial: `routes/catalogue.ts:21,60,70`, `routes/fusion.ts:14`, `routes/recordings.ts:15,16` |
| 2 "Cannot find module 'redis'" errors | Not yet drafted | `routes/aoi.ts:123`, `routes/fusion.ts:109` — add `@types/redis` or migrate to typed `ioredis` API |
| Zod tuple cast in `routes/zones.ts:23` | Not yet drafted | `ZodArray<ZodNumber>` cast to `ZodType<[number, number]>` — need a proper `z.tuple([z.number(), z.number()])` |
| **3 Prisma `Record<string, unknown> → InputJsonValue` mismatches** | Not yet drafted | `routes/alerts.ts:216`, `routes/fusion.ts:254`, `services/gis-sync-service.ts:214` — **real type-safety issues, not cosmetic**. These three need actual type design: where the metadata object is constructed, why it's `unknown`, and whether it should be a typed schema or genuinely opaque. **Owner: Backend Agent + review by Lead.** |
| Verify `npm test` passes against Postgres+PostGIS service container | Need green CI run | Unknown failures may surface here |
| Audit unused legacy code surfaced by `noUnusedLocals` | Iterate as discovered | Likely more lurking |

### 3. Analytics gate (estimated 1–2 days)

| Item | Status | Notes |
|---|---|---|
| Add `pythonpath = . ..` to `src/analytics/pytest.ini` | Drafted in PR #13 | Mechanical |
| Verify full pytest run passes with `requirements.txt` deps installed | Need green CI run | Was only verified at the *collection* level locally |
| Decide whether to normalize the dual import style (`analytics.X` vs `detectors.X`) | Defer (separate task) | Working today, ugly tomorrow |

### 4. Deploy wiring (estimated 2–4 days, mostly user-blocked)

| Item | Status | Owner | Blocker |
|---|---|---|---|
| **Decide: Render or Kubernetes** | Not decided | User | Inconsistency: `deploy.yml` says Render, `infra/k8s/` exists. Pick one. |
| Provision target environment(s) | Not done | User (billing) | Cannot delegate to agent |
| Add repo secrets (`RENDER_DEPLOY_HOOK_*` or `KUBECONFIG_PROD`) | Not done | User | Cannot delegate to agent |
| Uncomment / rewrite deploy steps in `deploy.yml` | Not drafted | DevOps Agent | Unblocks once target chosen |
| Smoke-test: push trivial commit to `main`, verify a new revision lands | Not done | DevOps Agent + QA Agent | All of the above first |

### 5. Branch protection + missing gates (estimated 1 day)

| Item | Status | Owner |
|---|---|---|
| Enable branch protection on `main` with required status checks | Not done | DevOps Agent |
| Add Playwright E2E job to `ci.yml` | Not drafted | QA Agent — referenced in CLAUDE.md but no workflow exists |
| Add `npm run lint` job (or jobs, per workspace) | Not drafted | DevOps Agent |
| Decide coverage thresholds and add `vitest --coverage` / `pytest --cov` | Future | QA Agent |

## Budget

Total estimate: **8–12 sprint days** spread across multiple agents.

| Workstream | Days | Owner |
|---|---|---|
| Frontend gate green | 1–2 | Frontend Agent |
| Backend gate green | 4–6 | Backend Agent (with Lead review on the 3 Prisma issues) |
| Analytics gate green | 1–2 | Analytics Agent |
| Deploy wiring (agent side; user-side is separate) | 1 | DevOps Agent |
| Branch protection + missing gates | 1 | DevOps Agent |

User-side blockers (not in the 8–12 day estimate, not delegable):
- Render vs. K8s decision
- Provisioning + secrets

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Backend `npm test` reveals more failures once typecheck passes | High | Major | Treat as part of the backend workstream estimate; don't ship to deploy wiring until tests pass |
| Prisma type fixes change runtime behavior | Medium | Major | Each of the 3 sites needs its own commit + review; add a regression test where feasible |
| Render hooks chosen but team actually wants K8s | Medium | Major | Force the decision before any deploy work starts; document the choice in this task |
| Branch protection blocks legitimate hotfix workflow | Low | Minor | Document the "admin override" path in the runbook |
| Sprint runs over budget | Medium | Minor | Frontend + Analytics first (smaller, higher-confidence), backend last (riskier) — fail-fast structure |

## Testing strategy

- Each workstream's gate is its own green-CI smoke test.
- After all three gates green on `main`, run a manual `gh workflow run` of `deploy.yml` (or push a no-op commit) and verify the chosen environment receives a new revision.
- Final E2E: ship a small visible change end-to-end (e.g. version bump in footer), watch it land in the live environment, watch it appear in browser.

## Security

- Production secrets (`RENDER_DEPLOY_HOOK_*`, `KUBECONFIG_PROD`, observability tokens) MUST be stored as GitHub repo secrets — never committed.
- Branch protection should require linear history to keep `git log main` auditable.
- The deploy job's permissions in workflow YAML should be scoped to the minimum needed.

## Definition of done

- [ ] All acceptance criteria checked
- [ ] PRs #10–#13 either merged (in some consolidated form) or closed with their work absorbed
- [ ] `docs/changelog/<date>-task-031.md` entry written
- [ ] Tracking issue #14 closed
- [ ] User has personally verified one no-op commit deploys to live

## References

- Tracking issue: #14
- Parked prerequisite PRs: #10, #11, #12, #13
- Shipped despite red CI (Path C decision): #9
- Originating CI/CD scaffold: TASK-010
