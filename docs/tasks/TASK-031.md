# TASK-031 — CI revival + production-readiness sprint

**Created:** 2026-05-14
**Phase:** Cross-cutting (infrastructure)
**Priority:** P0
**Status:** Proposed
**Complexity:** L
**Primary owner:** Repo owner (single-owner project — no separate DRI assignment)
**Depends on:** —
**Estimate:** 15–25 sprint days (was 8–12 when Render was a candidate; K8s with no existing manifests is materially larger — see updated budget below)
**Tracking issue:** #14
**Deploy target:** Kubernetes (decided 2026-05-14). `infra/k8s/` currently exists as an empty directory; manifests need to be authored from scratch.

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

### 4. Deploy wiring — Kubernetes (estimated 6–10 days; `infra/k8s/` is currently empty)

| Item | Status | Owner | Notes |
|---|---|---|---|
| **Decide: managed K8s provider** (EKS / GKE / AKS / DOKS / self-host) | Not decided | User | Cost + ops familiarity tradeoff |
| Provision cluster (control plane + workers + VPC + IAM) | Not done | User | Cannot delegate; pick provider first |
| Provision managed Postgres (CloudSQL / RDS / AlloyDB / DO managed PG) | Not done | User | Strongly recommend managed for prod |
| Provision managed Redis (or run via operator) | Not done | User | Same |
| Pick manifest tooling: raw YAML + Kustomize vs. Helm | Not decided | Repo owner | Influences all subsequent author work |
| Author Deployment / Service / Ingress for frontend, backend, analytics | Not drafted | Agent | Tooling decision first |
| Author ConfigMap + Secret ref structure (12-factor: no `.env` files in prod) | Not drafted | Agent | Tooling decision first |
| Install ingress-nginx + cert-manager; configure TLS | Not done | Agent | Cluster up first |
| Add image-build jobs to CI: build → tag (commit SHA) → push to GHCR | Not drafted | Agent | GHCR is free for this repo |
| Rewrite `deploy.yml` to `kubectl apply -k infra/k8s/overlays/prod` (or Helm install/upgrade), with rollout status check + rollback | Not drafted | Agent | Manifests + KUBECONFIG_PROD first |
| Add `KUBECONFIG_PROD` to repo secrets (or set up OIDC federation, preferred) | Not done | User | Cannot delegate |
| Smoke-test: push trivial commit to `main`, watch pods roll over, verify the new revision serves traffic | Not done | Agent + User | All of the above first |

### 5. Branch protection + missing gates (estimated 1 day)

| Item | Status | Owner |
|---|---|---|
| Enable branch protection on `main` with required status checks | Not done | DevOps Agent |
| Add Playwright E2E job to `ci.yml` | Not drafted | QA Agent — referenced in CLAUDE.md but no workflow exists |
| Add `npm run lint` job (or jobs, per workspace) | Not drafted | DevOps Agent |
| Decide coverage thresholds and add `vitest --coverage` / `pytest --cov` | Future | QA Agent |

## Budget

Total estimate: **15–25 sprint days** of agent-driven work, single-owner project. Up from the original 8–12 because K8s deploy requires authoring manifests from scratch in a currently-empty `infra/k8s/`, plus image-build pipeline that wasn't needed for Render.

| Workstream | Days | Notes |
|---|---|---|
| Frontend gate green | 1–2 | PRs #10, #11 cover most of it |
| Backend gate green | 4–6 | The 3 Prisma `Record<string, unknown> → InputJsonValue` mismatches need real type design |
| Analytics gate green | 1–2 | PR #13 covers the obvious fix; need full run verification |
| K8s manifests + image registry + deploy.yml rewrite | 6–10 | Was 1 day with Render. Pace depends on Kustomize vs. Helm choice. |
| Branch protection + missing gates (E2E, lint) | 1 | |
| Smoke-test the end-to-end deploy path | 1–2 | Inevitable iteration on K8s config |

User-blocked items (not in the day estimate above, but block the K8s workstream):
- Managed K8s provider decision
- Cloud account + billing
- Managed Postgres + Redis decisions
- Provisioning + `KUBECONFIG_PROD` secret (or OIDC setup)

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Backend `npm test` reveals more failures once typecheck passes | High | Major | Treat as part of the backend workstream estimate; don't ship to deploy wiring until tests pass |
| Prisma type fixes change runtime behavior | Medium | Major | Each of the 3 sites needs its own commit + review; add a regression test where feasible |
| K8s cluster cost outruns budget before the system ships | Medium | Major | Start on cheapest viable tier (DOKS small node or GKE Autopilot); scale up only after staging works end-to-end |
| Stateful workloads (Postgres, Redis) in-cluster done badly → data loss | Medium | **Critical** | **Strongly recommend managed DB services** over in-cluster operators for a security product. Treat as a hard preference, not a suggestion. |
| Branch protection blocks legitimate hotfix workflow | Low | Minor | Document the "admin override" path in the runbook |
| Single-owner sprint stalls when owner is interrupted | High | Major | No separate DRI was assigned by choice (single-owner project). Mitigation: keep PR sizes small so each one is a viable resumption point if context is lost |
| Sprint runs over budget | Medium | Minor | Frontend + Analytics first (smaller, higher-confidence), backend + K8s last (riskier) — fail-fast structure |

## Testing strategy

- Each workstream's gate is its own green-CI smoke test.
- After all three gates green on `main`, run a manual `gh workflow run` of `deploy.yml` (or push a no-op commit) and verify the chosen environment receives a new revision.
- Final E2E: ship a small visible change end-to-end (e.g. version bump in footer), watch it land in the live environment, watch it appear in browser.

## Security

- Production secrets (`KUBECONFIG_PROD`, registry tokens, DB connection strings, JWT/encryption keys, observability tokens) MUST be stored as GitHub repo secrets — never committed.
- In-cluster: all sensitive config goes via K8s Secret resources, never ConfigMaps or env literals in manifests. Consider Sealed Secrets, External Secrets Operator, or cloud-provider secret managers (AWS/GCP Secret Manager) to keep even encrypted secret material out of git.
- Branch protection should require linear history to keep `git log main` auditable.
- The deploy workflow's cloud permissions should be scoped to the minimum needed. **OIDC federation is strongly preferred over committing a long-lived `KUBECONFIG_PROD`** — fewer secrets to rotate, less blast radius if leaked.
- Camera credentials encryption (CLAUDE.md AES-256 rule) means the backend needs `ENCRYPTION_KEY` injected from a K8s Secret at pod start — design the manifest so this is enforced at startup, not optional.

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
