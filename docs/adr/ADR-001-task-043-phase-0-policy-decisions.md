# ADR-001: TASK-043 Phase-0 Policy Decisions (Q1, Q4, Q5, Q6)

**Status:** Proposed
**Date:** 2026-04-27
**Deciders:** Product owner, security/operations lead, frontend lead, backend lead
**Related:** [`docs/tasks/TASK-043-multi-sensor-border-ui-requirements.md`](../tasks/TASK-043-multi-sensor-border-ui-requirements.md) §14
**Supersedes:** —

---

## Context

The TASK-043 stakeholder review on 2026-04-27 surfaced six open questions that affect how the operator console behaves at Phase-0 close-out. Two were resolved live during implementation:

- **Q2** — Operators may draw AOIs (no extra RBAC gate).
- **Q3** — Direction is reported only by advanced sensors; seismic glyph defaults to ring-only and renders an arrow only when `direction_deg` is supplied.

The remaining four (Q1, Q4, Q5, Q6) need a single coherent policy call so we can ship Phase 0, avoid scope creep into Phase 1, and unblock the PR currently waiting on review. They share the same forces:

- **Operator-first** mandate from §3 — no engineering surfaces, no hardcoded English strings, no per-environment forks.
- **Phase-0 deadline** — finite engineering capacity. We must distinguish "ship the hook" from "ship the full configuration surface".
- **No production telemetry yet** — we have zero operator-marked-false data, so any threshold or playbook tuning is hypothetical until Phase 1.
- **Per-AOI variation is real** — different border stretches will have different sensor mixes, severities, and SOPs. The contract must accommodate it without forcing it into Phase 0.

Each decision below is independent in implementation but sequenced together so the four landing PRs share one design intent.

---

## Decision summary

| # | Question | Decision (Phase 0) | Forward path |
|---|---|---|---|
| Q1 | Asset-registry source | **Live registry**, polled via React Query (`staleTime` 30 s) | Phase 1: SSE invalidation on engineering CRUD |
| Q4 | Severity thresholds & per-AOI override | **§8 defaults locked globally**; severity computed on the backend | Phase 1: per-AOI override table once ≥30 d of false-positive data exists |
| Q5 | Sound-cue policy | **CRITICAL only, audible, global mute toggle**; per-session persistence | Phase 1: HIGH-tier opt-in. Phase 2: per-AOI mute + DND windows |
| Q6 | Recommended-action playbook | **Hardcoded defaults in [`recommendedAction.ts`](../../src/frontend/src/lib/recommendedAction.ts)**, with `Threat.recommended_action` overriding when set | Phase 1: `RecommendedAction` table keyed by `(aoi_id, classification)` with i18n bundles |

---

## Q1 — Asset-registry source

> *Is the BOP-Alpha asset list provided as a static input for Phase 0, or should AOI Manager pull from a live asset registry from day one?*

The transcript leans live; the current build ([`CataloguePanel`](../../src/frontend/src/components/catalogue/CataloguePanel.tsx)) already polls `/aoi/{id}/catalogue`. The decision is whether to commit to that contract.

### Options considered

#### Option A — Live registry, React Query cache, poll-on-focus *(chosen)*

| Dimension | Assessment |
|---|---|
| Complexity | Low — already implemented |
| Cost | Low — one HTTP request per AOI mount, cached 30 s |
| Scalability | Backend must handle catalogue queries at the AOI session rate (≤ N panes × 1/30 s); easily within Postgres budget |
| Team familiarity | High — TanStack Query is the standing pattern |
| Latency to operator | New sensor visible within ≤ 30 s without redeploy |

**Pros:** Matches the transcript intent. New sensors appear without a release. Engineering view edits (TASK-042) propagate to operator surfaces without coupling.
**Cons:** 30 s window for stale catalogue after engineering CRUD. Without invalidation, an operator can briefly see a sensor that was retired moments ago.

#### Option B — Static seed file with manual reload

**Pros:** Zero-risk cache invalidation. Trivial to test.
**Cons:** Requires a release every time the catalogue changes. Contradicts the transcript.

#### Option C — Live registry + WebSocket invalidation

**Pros:** Sub-second freshness.
**Cons:** New infra (WS broker, reconnection, auth). Disproportionate for Phase 0; we don't have an SLA that requires it.

### Trade-off analysis

The 30 s stale window is the only meaningful cost of A versus C, and we have no Phase-0 SLA that requires sub-30 s freshness. C is the right Phase-1 destination, not Phase-0 work. B is excluded by the transcript.

### Consequences

- **Easier:** No new contract to ratify; existing code is the answer.
- **Harder:** Engineering CRUD must respect cache-control semantics so React Query revalidation actually happens (current backend should already do this — needs verification).
- **Revisit:** Add SSE-based cache busting in Phase 1 once we measure how often engineering edits happen.

### Action items

- [ ] **Backend** — confirm `/aoi/{id}/catalogue` returns `Cache-Control: no-store` on engineering write paths so React Query refetches on next interaction.
- [ ] **Frontend** — leave [`CataloguePanel`](../../src/frontend/src/components/catalogue/CataloguePanel.tsx) and the AOI Manager flow as-is; document the 30 s freshness in the operator runbook.
- [ ] **Phase 1 ticket** — SSE channel `/events/catalogue` consumed by the operator session to refresh catalogue queries on engineering CRUD.

---

## Q4 — Severity thresholds & per-AOI override

> *Severity thresholds in §8 are first-pass defaults. Need policy sign-off per AOI before Phase 1.*

### Options considered

#### Option A — Lock §8 defaults globally for Phase 0; computation moves backend; per-AOI overrides Phase 1 *(chosen)*

| Dimension | Assessment |
|---|---|
| Complexity | Low — frontend already has [`SeverityPolicy`](../../src/frontend/src/lib/severity.ts); backend mirrors the rules |
| Cost | None |
| Scalability | Pure function — no per-row policy lookup yet |
| Trust | Single source of truth on backend (frontend computation is a fallback for legacy `FusionOutcome`) |

**Pros:** Ships now. Frontend already supports the override shape so Phase 1 is additive. Avoids building a policy editor surface before we know what dimensions to expose.
**Cons:** Operators stuck with one threshold set across all AOIs for ≥30 days. May produce alert-rate skew between AOIs with different baseline noise.

#### Option B — Ship per-AOI policy in Phase 0

**Pros:** Customers can tune immediately.
**Cons:** No tuning data exists yet. Building the policy editor now means building it twice (once on guesses, once on real data). Also: per-AOI policy needs an authoring UI, an audit trail, and a backend resolver — three surfaces we haven't designed.

#### Option C — Env-tunable global thresholds

**Pros:** Allows ops to tune per-environment without code changes.
**Cons:** Env vars are not a UX. The product owner doesn't deploy. Wrong governance model.

### Trade-off analysis

A defers the per-AOI surface to when we have data to ground it. The cost is a 30+ day "one size fits all" period — acceptable because (a) §8 thresholds were chosen conservatively, (b) the frontend already accepts per-AOI overrides, so Phase 1 is just plumbing, (c) any Phase-0 tuning would be guesswork.

The decision also implicitly answers a smaller question: *where* severity is computed. Phase-0 ends with severity computed on the backend (so all consumers — feed, drawer, banner — agree), with [`computeSeverity`](../../src/frontend/src/lib/severity.ts) remaining as a frontend fallback for legacy fusion outcomes that don't yet carry severity.

### Consequences

- **Easier:** No policy schema to design in Phase 0.
- **Harder:** Backend acquires a severity-rules module mirroring [`severity.ts`](../../src/frontend/src/lib/severity.ts). Frontend tests for the rules engine become the contract test.
- **Revisit:** After 30 days of operator marking false-positives, audit which classification × AOI combinations are over- or under-firing. Use that to design the override schema.

### Action items

- [ ] **Backend** — port [`computeSeverity`](../../src/frontend/src/lib/severity.ts) rules into the fusion service; emit `Threat.severity` on every threat.
- [ ] **Frontend** — keep [`computeSeverity`](../../src/frontend/src/lib/severity.ts) as a fallback when `severity` is absent from the payload; this already works through `withComputedSeverity`.
- [ ] **Analytics** — log every operator "Mark false" action with the threat's classification, severity, fused score, and contributing sensors. This becomes the Phase-1 tuning dataset.
- [ ] **Phase 1 ticket** — `severity_policy` table keyed by `aoi_id`, with a JSON column matching the [`SeverityPolicy`](../../src/frontend/src/lib/severity.ts) shape; admin-only editor.

---

## Q5 — Sound-cue policy

> *Which alerts are audible by default, and can the operator silence them per AOI?*

§9: *"Critical alerts raise a global banner across all panes, with audio cue (configurable, default on)."*

### Options considered

#### Option A — CRITICAL only, audible, session-wide mute toggle *(chosen)*

| Dimension | Assessment |
|---|---|
| Complexity | Low — already implemented in [`GlobalCriticalBanner`](../../src/frontend/src/components/alerts/GlobalCriticalBanner.tsx) |
| Cost | None |
| Alert fatigue risk | Low — CRITICAL is the highest tier and rarest by construction |
| Operator agency | Mute is one click, persisted in `localStorage` |

**Pros:** §9 is satisfied as written. Ships now. No new surfaces.
**Cons:** No HIGH-tier audibility. No per-AOI silencing.

#### Option B — CRITICAL + HIGH, with per-user severity threshold

**Pros:** More alerts surface. Configurable.
**Cons:** HIGH-tier alerts include "≥2 sensors agreeing on human/group at low score" — a routine occurrence in active sectors. HIGH-tier sound risks acute alert fatigue without first observing the real fire-rate.

#### Option C — Per-AOI mute + DND windows

**Pros:** Full operator control.
**Cons:** Requires a settings model, an admin UI for DND windows, and a per-AOI sound-policy resolver. Phase-2 in scope.

### Trade-off analysis

Alert fatigue is the primary failure mode of audible cues. CRITICAL-only is the conservative default — it reflects §9's "default on" while keeping audibility at the rate stakeholders explicitly approved. HIGH-tier audibility should be a Phase-1 *opt-in* per operator preference, not a default. Per-AOI mute is genuinely Phase-2 work — it requires a `userAlertPolicy` table + admin governance.

### Consequences

- **Easier:** No new schema in Phase 0.
- **Harder:** Operators monitoring a noisy AOI cannot silence its banner without silencing all banners. Acceptable for Phase 0; the global mute is one click away.
- **Revisit:** Sound-fire telemetry. Specifically: median time between CRITICAL pings, mute-toggle frequency, and acknowledge-after-mute rate.

### Action items

- [ ] **Frontend** — keep [`GlobalCriticalBanner`](../../src/frontend/src/components/alerts/GlobalCriticalBanner.tsx) behaviour as is (audio for CRITICAL, single-id deduplication, localStorage mute).
- [ ] **Telemetry** — emit a `banner.mute_toggled` event with timestamp + state to the analytics service; emit `banner.ping_played` per CRITICAL.
- [ ] **Phase 1 ticket** — operator-preferences UI: severity threshold for audio (CRITICAL / HIGH / off).
- [ ] **Phase 2 ticket** — per-AOI mute + DND windows (`userAlertPolicy(user_id, aoi_id, severity_floor, dnd_window)`).

---

## Q6 — Recommended-action playbook authorship

> *Who authors and maintains the playbook strings shown in the Threat Detail Drawer?*

### Options considered

#### Option A — Hardcoded defaults; per-threat override via `Threat.recommended_action`; per-AOI table in Phase 1 *(chosen)*

| Dimension | Assessment |
|---|---|
| Complexity | Low — defaults already in [`recommendedAction.ts`](../../src/frontend/src/lib/recommendedAction.ts), drawer already prefers the threat field |
| Cost | None for Phase 0 |
| Authorship friction | Phase 0: PR review by ops/security lead. Phase 1: in-app editor |
| i18n | Already routed through the i18n module via the dictionary surface; per-AOI overrides become i18n keys |

**Pros:** Ships now. Override path is a contract today, not a future-proofing exercise. The drawer never has to know whether the string came from defaults or DB.
**Cons:** Updating a default requires a code release. Acceptable while the playbook is small (≤17 classifications); breaks down once per-AOI variation lands.

#### Option B — DB-only, seeded via migration

**Pros:** No code-deploy for content changes.
**Cons:** Requires a fallback path anyway (DB connection failure → drawer must still render). Adds a query per drawer-open. We pay this cost in Phase 1; not in Phase 0.

#### Option C — External CMS (Contentful, Strapi)

**Pros:** Editorial workflow, versioning.
**Cons:** Net-new third-party dependency. Cost. Authentication. The playbook is bounded (≤ classifications × AOIs); CMS overhead is misaligned with the volume.

### Trade-off analysis

A is the lowest-cost path that keeps Phase 1 cheap. The runtime contract — drawer reads `threat.recommended_action`, falls back to defaults — is identical in Phase 0 and Phase 1. Only the *source* of the string changes. C is over-engineered for a content surface measured in dozens, not thousands.

Authorship: ops/security lead authors via PR review on [`recommendedAction.ts`](../../src/frontend/src/lib/recommendedAction.ts) for Phase 0. This makes the playbook a code artifact with a review trail — appropriate while volume is small. Phase 1 adds a `recommended_action` table seeded from these defaults, and the operator drawer continues to call the same fallback function.

### Consequences

- **Easier:** No schema, no editor UI, no permissions model in Phase 0.
- **Harder:** Adding a new classification to the playbook requires a frontend release. Acceptable while the taxonomy is closed.
- **Revisit:** When per-AOI playbook variation is requested by an operator. That demand triggers the Phase 1 table.

### Action items

- [ ] **Frontend** — leave [`recommendedAction.ts`](../../src/frontend/src/lib/recommendedAction.ts) as the authoritative source for Phase 0; CODEOWNER it to ops/security.
- [ ] **Backend** — emit `Threat.recommended_action` only when an override exists; otherwise leave undefined (the frontend falls back).
- [ ] **i18n** — fold playbook strings into the dictionary in Phase 1 (they currently live next to the React tree; for one locale this is fine).
- [ ] **Phase 1 ticket** — `recommended_action(aoi_id, classification, locale, body, updated_by, updated_at)` table; admin editor scoped to ops/security role.

---

## Cross-cutting consequences

- **Backend** picks up two new responsibilities at Phase-0 close: server-side severity computation (Q4) and `Threat.recommended_action` resolution (Q6). Both are pure functions over existing data.
- **Telemetry** picks up three new events: `alert.marked_false` (Q4 dataset), `banner.mute_toggled` and `banner.ping_played` (Q5 dataset). All three feed the Phase-1 tuning work.
- **Phase 1 scope** crystallises: SSE catalogue invalidation (Q1), per-AOI severity overrides (Q4), HIGH-tier audio opt-in (Q5), `recommended_action` DB-backed playbook (Q6). Plus the geo-anchored MapLibre layer work that was deferred from this PR.
- **No new dependencies introduced.** Every decision relies on tools already in the stack (React Query, Zustand, Postgres, Tailwind, MapLibre).

## Action items — Phase-0 close-out (consolidated)

- [ ] Backend — port [`computeSeverity`](../../src/frontend/src/lib/severity.ts) into the fusion service; emit `Threat.severity` on every threat.
- [ ] Backend — emit `Threat.recommended_action` only when an override exists.
- [ ] Backend — add `Cache-Control: no-store` to write paths under `/aoi/{id}/catalogue`.
- [ ] Frontend — keep current behaviour for catalogue, banner, and drawer.
- [ ] Frontend — CODEOWNER [`recommendedAction.ts`](../../src/frontend/src/lib/recommendedAction.ts) to ops/security.
- [ ] Analytics — log `alert.marked_false`, `banner.mute_toggled`, `banner.ping_played`.
- [ ] Update [`docs/tasks/TASK-043-multi-sensor-border-ui-requirements.md`](../tasks/TASK-043-multi-sensor-border-ui-requirements.md) §14 — strike Q1, Q4, Q5, Q6 and link to this ADR.

## Phase-1 follow-up tickets to file

- [ ] **TASK-PHASE1-01** — SSE catalogue invalidation channel.
- [ ] **TASK-PHASE1-02** — `severity_policy` table + admin editor; consume tuning dataset.
- [ ] **TASK-PHASE1-03** — Operator-preferences UI: HIGH-tier audio opt-in.
- [ ] **TASK-PHASE1-04** — `recommended_action` table + admin editor + i18n bundle migration.
- [ ] **TASK-PHASE1-05** — Geo-anchored MapLibre layers (Polygon/LineString) for cones, fences, FOVs (deferred from TASK-043).
