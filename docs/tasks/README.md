# SurveillanceOS — Task Index

> Source of truth for all engineering tasks. Managed by the Lead Agent.
> Last updated: 2026-04-24

Tasks are numbered sequentially (`TASK-XXX`). Sprint 1–4 tasks (TASK-001 through TASK-012) are tracked in `ROADMAP.md` and are mandatory foundation work. Phase 1–5 tasks (TASK-013 through TASK-030) are the forward feature roadmap. **Phase 0 (TASK-031 through TASK-042) is the new top priority** — introduced 2026-04-24 following the SIS.txt product discussion — and sits ahead of Phase 1. **Sprint 1 and Sprint 2 are complete.**

---

## 🔥 Phase 0 — Border Surveillance Multi-Sensor Platform (Top priority)

**Source:** SIS.txt (2026-04-24). See `ROADMAP.md` for the full narrative.

### Phase 0A — Operator UX foundation (critical path: 041 → 031 → 032, 034 in parallel)

| ID | Title | Primary owner | Complexity |
|----|-------|---------------|------------|
| TASK-041 | BOP / Site Hierarchy Model (dynamic, GIS-sourced) | Backend + DevOps | M |
| TASK-031 | AOI Drawing Tool — irregular polygon on live map | Frontend + Backend | M |
| TASK-032 | Sensor & Asset Catalogue with spatial query inside AOI | Backend + Frontend | M |
| TASK-034 | Role-split UI — Operator vs Engineering views | Frontend + Backend | M |

### Phase 0B — Multi-sensor ingestion (parallelisable once 0A is merged)

| ID | Title | Primary owner | Complexity |
|----|-------|---------------|------------|
| TASK-035 | Seismic sensor ingestion + pattern classification | Analytics + Backend | L |
| TASK-036 | Acoustic sensor ingestion + classification | Analytics + Backend | M |
| TASK-037 | Thermal / LIDAR / Pan-image ingestion adapter | Analytics + Backend | L |

### Phase 0C — Fusion, visualization and operator surface

| ID | Title | Primary owner | Complexity |
|----|-------|---------------|------------|
| TASK-039 | Multi-sensor fusion engine — combined confidence scoring | Analytics + Backend | L |
| TASK-038 | Use-case visualization layer — tunnel / footstep-radius / direction glyphs | Frontend + Analytics | L |
| TASK-040 | Human-readable alerts on live map | Frontend + Backend | M |
| TASK-033 | Multi-AOI quadview panel (1 / 2 / 4 split) | Frontend | M |
| TASK-042 | Engineering & maintenance view — raw waveforms, health, thresholds | Frontend + Backend | M |

---

## Foundation (Sprint 1–4)

| ID | Title | Sprint | Status |
|----|-------|--------|--------|
| TASK-001 | Audit & fix `dashboard/` and `sse/` against CLAUDE.md | 1 | ✅ Done (2026-04-24) |
| TASK-002 | Camera CRUD API | 2 | ✅ Done (commit `be9e850`) |
| TASK-003 | Camera grid UI with live thumbnails | 2 | ✅ Done (commit `bbad4db`) |
| TASK-004 | HLS stream proxy | 2 | ✅ Done (commit `be9e850`) |
| TASK-005 | JWT auth + RBAC | 2 | ✅ Done (commit `be9e850`) |
| TASK-006 | YOLOv8 person detection microservice | 3 | 🔴 Open |
| TASK-007 | Zone-based intrusion logic (basic polygon zones) | 3 | 🔴 Open |
| TASK-008 | Real-time alert feed | 3 | 🔴 Open |
| TASK-009 | Docker Compose dev stack | 4 | Backlog |
| TASK-010 | GitHub Actions CI/CD | 4 | Backlog |
| TASK-011 | Prometheus metrics + Grafana | 4 | Backlog |
| TASK-012 | Recording scheduler + BullMQ | 4 | Backlog |

---

## Phase 1 — Harden the core

| ID | Title | Primary owner | Complexity |
|----|-------|---------------|------------|
| TASK-013 | Multi-camera live view enhancements (ABR, low-bandwidth mode, PiP, health heartbeats) | Frontend + Backend | M |
| TASK-014 | Smarter alerting — rules engine, acknowledgement, assignment, resolution | Backend + Frontend | L |
| TASK-015 | Recording lifecycle management — hot/warm/cold tiers, clip export, chain-of-custody | Backend + DevOps | L |

## Phase 2 — Advanced analytics

| ID | Title | Primary owner | Complexity |
|----|-------|---------------|------------|
| TASK-016 | Advanced zones & line-crossing rules engine | Analytics + Frontend | L |
| TASK-017 | License plate recognition (LPR) with watchlist | Analytics + Backend | L |
| TASK-018 | Face blur & configurable privacy masks | Analytics + Frontend | M |
| TASK-019 | Behavioral analytics — loitering, heatmaps, anomaly scoring | Analytics | L |

## Phase 3 — Scale and operations

| ID | Title | Primary owner | Complexity |
|----|-------|---------------|------------|
| TASK-020 | Edge inference agent (Jetson/Coral) | Analytics + DevOps | XL |
| TASK-021 | Multi-tenant + site hierarchy with scoped RBAC | Backend + Frontend | L |
| TASK-022 | Horizontal scaling for stream proxy | Backend + DevOps | L |
| TASK-023 | Audit log & compliance reporting | Backend + Frontend | M |

## Phase 4 — Operator experience and integrations

| ID | Title | Primary owner | Complexity |
|----|-------|---------------|------------|
| TASK-024 | Mobile app (React Native) | Frontend | XL |
| TASK-025 | Two-way audio & PTZ control | Backend + Frontend | M |
| TASK-026 | Third-party integrations (webhooks, Slack/Teams/PagerDuty, MQTT, public API) | Backend | L |
| TASK-027 | AI-generated incident summaries | Analytics + Backend | M |

## Phase 5 — Platform polish

| ID | Title | Primary owner | Complexity |
|----|-------|---------------|------------|
| TASK-028 | Natural-language search over recordings (CLIP embeddings) | Analytics + Backend | L |
| TASK-029 | Digital twin / floor plan view | Frontend + Backend | M |
| TASK-030 | Offline-resilient edge recording with backfill | Analytics + Backend | M |

---

## Phase gating rules

- **Phase 0A is the program's new top priority.** Critical path: TASK-041 → TASK-031 → TASK-032; TASK-034 runs in parallel. No Phase 1 feature work begins until Phase 0A is QA green.
- Sprint 3 (TASK-006/007/008) continues in parallel with Phase 0 but must emit alerts consumable by TASK-040 without a rewrite — the alert event schema is a shared deliverable.
- Phase 1 must be 100% QA green before Phase 2 begins.
- Phase 3 requires TASK-021 (multi-tenant) merged before any customer pilot exceeds 2 sites.
- Phase 4 mobile app (TASK-024) depends on TASK-005 (RBAC) and TASK-004 (HLS proxy).
- Phase 5 items are exploratory; they may be re-scoped based on Phase 2–4 learnings.

## Conventions

Every task file follows the template established in TASK-001:

1. Metadata header (phase, priority, owner, estimate, depends on)
2. Summary + goals/non-goals
3. User stories
4. Acceptance criteria
5. Technical design per agent (frontend / backend / analytics / devops)
6. Data model + API contract changes
7. Testing strategy
8. Security considerations
9. Observability
10. Risks and mitigations
11. Rollout plan
12. Definition of done (checkboxes)

All tasks must pass QA agent green before merge. No feature flag is considered "done" until it has been toggled on in a staging environment with no regressions for 24 hours.
