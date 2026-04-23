# SurveillanceOS — Task Index

> Source of truth for all engineering tasks. Managed by the Lead Agent.
> Last updated: 2026-04-22

Tasks are numbered sequentially (`TASK-XXX`). Sprint 1–4 tasks (TASK-001 through TASK-012) are tracked in `ROADMAP.md` and are mandatory foundation work. Phase 1–5 tasks (TASK-013 through TASK-030) are the forward feature roadmap and **must not start until TASK-001 is QA green**.

---

## Foundation (Sprint 1–4)

| ID | Title | Sprint | Status |
|----|-------|--------|--------|
| TASK-001 | Audit & fix `dashboard/` and `sse/` against CLAUDE.md | 1 | 🔴 Open |
| TASK-002 | Camera CRUD API | 2 | Backlog |
| TASK-003 | Camera grid UI with live thumbnails | 2 | Backlog |
| TASK-004 | HLS stream proxy | 2 | Backlog |
| TASK-005 | JWT auth + RBAC | 2 | Backlog |
| TASK-006 | YOLOv8 person detection microservice | 3 | Backlog |
| TASK-007 | Zone-based intrusion logic (basic polygon zones) | 3 | Backlog |
| TASK-008 | Real-time alert feed | 3 | Backlog |
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
