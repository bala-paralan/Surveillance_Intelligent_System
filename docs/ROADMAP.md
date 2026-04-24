# SurveillanceOS — Product Roadmap

> Managed by Lead Agent. Updated at start/end of each sprint.
> Last updated: 2026-04-24

---

## 🔥 Phase 0 — Border Surveillance Multi-Sensor Platform (TOP PRIORITY)

**Source:** Product discussion transcribed in `SIS.txt` (2026-04-24).
**Directive:** This phase is the highest-priority work item. Sprint 3 (AI & Alerts) continues in parallel and its alert schema is a shared deliverable with TASK-040. No Phase 1 feature work begins until Phase 0A is QA green.

### Phase 0A — Operator UX foundation ✅ Complete (2026-04-24)

| Task | Title | Owner(s) | Priority | Complexity | Status |
|------|-------|----------|----------|------------|--------|
| TASK-041 | BOP / Site Hierarchy Model — dynamic, GIS-sourced | Backend + DevOps | P0 | M | ✅ Done (2026-04-24) |
| TASK-031 | AOI Drawing Tool — irregular polygon on live map | Frontend + Backend | P0 | M | ✅ Done (2026-04-24) |
| TASK-032 | Sensor & Asset Catalogue with spatial query inside AOI | Backend + Frontend | P0 | M | ✅ Done (2026-04-24) |
| TASK-034 | Role-split UI — Operator vs Engineering views | Frontend + Backend | P0 | M | ✅ Done (2026-04-24) |

### Phase 0B — Multi-sensor ingestion ✅ Complete (2026-04-24)

| Task | Title | Owner(s) | Priority | Complexity | Depends on | Status |
|------|-------|----------|----------|------------|------------|--------|
| TASK-035 | Seismic sensor ingestion + pattern classification (tunnel / footsteps / vehicle) | Analytics + Backend | P0 | L | TASK-032 ✅ | ✅ Done (2026-04-24) |
| TASK-036 | Acoustic sensor ingestion + classification (gunshot / voices / vehicle) | Analytics + Backend | P0 | M | TASK-032 ✅ | ✅ Done (2026-04-24) |
| TASK-037 | Thermal / LIDAR / Pan-image ingestion adapter | Analytics + Backend | P1 | L | TASK-032 ✅ | ✅ Done (2026-04-24) |

### Phase 0C — Fusion, visualization and operator surface ✅ Complete (2026-04-24)

| Task | Title | Owner(s) | Priority | Complexity | Depends on | Status |
|------|-------|----------|----------|------------|------------|--------|
| TASK-039 | Multi-sensor fusion engine — combined confidence scoring | Analytics + Backend | P0 | L | TASK-035 ✅, TASK-036 ✅, TASK-037 ✅ | ✅ Done (2026-04-24) |
| TASK-038 | Use-case visualization layer — tunnel / footstep-radius / direction glyphs | Frontend + Analytics | P0 | L | TASK-035 ✅, TASK-039 ✅ | ✅ Done (2026-04-24) |
| TASK-040 | Human-readable alerts on live map — zone-scoped, actionable | Frontend + Backend | P0 | M | TASK-039 ✅, TASK-041 ✅ | ✅ Done (2026-04-24) |
| TASK-033 | Multi-AOI quadview panel (1 / 2 / 4 split) | Frontend | P1 | M | TASK-031 ✅, TASK-032 ✅ | ✅ Done (2026-04-24) |
| TASK-042 | Engineering & maintenance view — raw waveforms, health, thresholds, diagnostics | Frontend + Backend | P1 | M | TASK-034 ✅, TASK-035 ✅ | ✅ Done (2026-04-24) |

---

## Sprint 1 — Foundation ✅ Complete

**Goal:** Establish agent team configuration and bring existing code in line with CLAUDE.md before any new feature work begins.

| Task | Title | Owner(s) | Complexity | Status |
|------|-------|----------|------------|--------|
| TASK-001 | Audit & fix `dashboard/` and `sse/` against CLAUDE.md conventions | Frontend + Backend + QA + DevOps | **L** | ✅ Done (2026-04-24) |

---

## Sprint 2 — Core Camera Features ✅ Complete

| Task | Title | Owner(s) | Complexity | Status |
|------|-------|----------|------------|--------|
| TASK-002 | Camera CRUD API — add/edit/delete/test RTSP connection | Backend | M | ✅ Done (commit `be9e850`) |
| TASK-003 | Camera grid UI with live thumbnail snapshots (lazy-load) | Frontend | M | ✅ Done (commit `bbad4db`) |
| TASK-004 | HLS stream proxy (backend signs URL → frontend plays via HLS.js) | Backend + Frontend | L | ✅ Done (commit `be9e850`) |
| TASK-005 | JWT auth + RBAC — admin / operator / viewer roles | Backend | M | ✅ Done (commit `be9e850`) |

---

## Sprint 3 — AI & Alerts ✅ Complete

| Task | Title | Owner(s) | Complexity | Status |
|------|-------|----------|------------|--------|
| TASK-006 | YOLOv8 person detection microservice (FastAPI + Redis pub/sub) | Analytics | L | ✅ Done (2026-04-24) |
| TASK-007 | Zone-based intrusion logic (polygon zones per camera) | Analytics | M | ✅ Done (2026-04-24) |
| TASK-008 | Real-time alert feed — slide-in UI, acknowledge, critical stays | Backend + Frontend | M | ✅ Done (2026-04-24) |

---

## Sprint 4 — DevOps & Observability ✅ Complete (2026-04-24)

| Task | Title | Owner(s) | Complexity | Status |
|------|-------|----------|------------|--------|
| TASK-009 | Docker Compose dev stack (all services + health checks) | DevOps | S | ✅ Done (2026-04-24) |
| TASK-010 | GitHub Actions CI/CD pipeline (lint → test → build → deploy) | DevOps | M | ✅ Done (2026-04-24) |
| TASK-011 | Prometheus metrics + Grafana dashboard (all 3 services) | DevOps | M | ✅ Done (2026-04-24) |
| TASK-012 | Recording scheduler + BullMQ jobs (object storage, not app server) | Backend | M | ✅ Done (2026-04-24) |

---

## Phase 1 — Harden the core (Planned)

> Begins after Phase 0A is QA green ✅ and Sprint 4 closes.

| Task | Title | Owner(s) | Priority | Complexity | Depends on | Status |
|------|-------|----------|----------|------------|------------|--------|
| TASK-013 | Multi-camera live view enhancements | Frontend + Backend | P0 | M | TASK-003 ✅, TASK-004 ✅ | Proposed |
| TASK-014 | Smarter alerting — rules engine, acknowledgement, assignment, resolution | Backend + Frontend | P0 | L | TASK-008 ✅, TASK-013 | Proposed |
| TASK-015 | Recording lifecycle management | Backend + DevOps | P0 | L | TASK-012 | Proposed |

---

## Phase 2 — Advanced analytics (Planned)

> Gated: Phase 1 must be 100% QA green.

| Task | Title | Owner(s) | Priority | Complexity | Depends on | Status |
|------|-------|----------|----------|------------|------------|--------|
| TASK-016 | Advanced zones & line-crossing rules engine | Analytics + Frontend | P1 | L | TASK-007 ✅, TASK-014 | Proposed |
| TASK-017 | License plate recognition (LPR) with watchlist | Analytics + Backend | P1 | L | TASK-006 ✅, TASK-014 | Proposed |
| TASK-018 | Face blur & configurable privacy masks | Analytics + Frontend | P1 | M | TASK-006 ✅ | Proposed |
| TASK-019 | Behavioral analytics — loitering, heatmaps, anomaly scoring | Analytics | P2 | L | TASK-016 | Proposed |

---

## Phase 3 — Scale and operations (Planned)

| Task | Title | Owner(s) | Priority | Complexity | Depends on | Status |
|------|-------|----------|----------|------------|------------|--------|
| TASK-020 | Edge inference agent (Jetson/Coral) | Analytics + DevOps | P1 | XL | TASK-006 ✅, TASK-011 | Proposed |
| TASK-021 | Multi-tenant + site hierarchy with scoped RBAC | Backend + Frontend | P0 | L | TASK-005 ✅ | Proposed |
| TASK-022 | Horizontal scaling for stream proxy | Backend + DevOps | P1 | L | TASK-004 ✅, TASK-011 | Proposed |
| TASK-023 | Audit log & compliance reporting | Backend + Frontend | P1 | M | TASK-005 ✅, TASK-015, TASK-021 | Proposed |

---

## Phase 4 — Operator experience and integrations (Planned)

| Task | Title | Owner(s) | Priority | Complexity | Depends on | Status |
|------|-------|----------|----------|------------|------------|--------|
| TASK-024 | Mobile app (React Native) | Frontend | P1 | XL | TASK-004 ✅, TASK-005 ✅, TASK-014, TASK-021 | Proposed |
| TASK-025 | Two-way audio & PTZ control | Backend + Frontend | P2 | M | TASK-004 ✅, TASK-005 ✅ | Proposed |
| TASK-026 | Third-party integrations — webhooks, Slack/Teams/PagerDuty, MQTT | Backend | P1 | L | TASK-005 ✅, TASK-014, TASK-021 | Proposed |
| TASK-027 | AI-generated incident summaries | Analytics + Backend | P2 | M | TASK-014, TASK-015, TASK-016 | Proposed |

---

## Phase 5 — Platform polish (Exploratory)

| Task | Title | Owner(s) | Priority | Complexity | Depends on | Status |
|------|-------|----------|----------|------------|------------|--------|
| TASK-028 | Natural-language search over recordings (CLIP embeddings) | Analytics + Backend | P2 | L | TASK-015, TASK-021 | Proposed |
| TASK-029 | Digital twin / floor plan view | Frontend + Backend | P2 | M | TASK-021 | Proposed |
| TASK-030 | Offline-resilient edge recording with backfill | Analytics + Backend | P2 | M | TASK-015, TASK-020 | Proposed |

---

## Completed

*(Items move here once merged to main and QA is green.)*

- ✅ Project scaffold: CLAUDE.md, .claude/settings.json, all 5 SKILL.md files, docs/ structure — 2026-04-16
- ✅ TASK-001 · Code Audit & Convention Fix — 2026-04-24 (branch `fix/task-001-conventions`)
- ✅ TASK-002 · Camera CRUD API — 2026-04-24 (commit `be9e850`)
- ✅ TASK-003 · Camera Grid UI — 2026-04-24 (commit `bbad4db`)
- ✅ TASK-004 · HLS Stream Proxy — 2026-04-24 (commit `be9e850`)
- ✅ TASK-005 · JWT Auth + RBAC — 2026-04-24 (commit `be9e850`)
- ✅ TASK-006 · YOLOv8 Person Detection Microservice — 2026-04-24
- ✅ TASK-007 · Zone-based Intrusion Logic — 2026-04-24
- ✅ TASK-008 · Real-time Alert Feed — 2026-04-24
- ✅ TASK-031 · AOI Drawing Tool — 2026-04-24
- ✅ TASK-032 · Sensor & Asset Catalogue — 2026-04-24
- ✅ TASK-034 · Role-split UI (ENGINEER role + ui_mode) — 2026-04-24
- ✅ TASK-041 · BOP / Site Hierarchy Model — 2026-04-24
- ✅ TASK-035 · Seismic Sensor Ingestion + Pattern Classification — 2026-04-24
- ✅ TASK-036 · Acoustic Sensor Ingestion + Classification — 2026-04-24
- ✅ TASK-037 · Thermal / LIDAR / Pan-image Ingestion Adapter — 2026-04-24
- ✅ TASK-039 · Multi-Sensor Fusion Engine — 2026-04-24
- ✅ TASK-038 · Use-case Visualization Layer (glyphs) — 2026-04-24
- ✅ TASK-040 · Human-Readable Alerts on Live Map — 2026-04-24
- ✅ TASK-033 · Multi-AOI Quadview Panel — 2026-04-24
- ✅ TASK-042 · Engineering & Maintenance View — 2026-04-24
- ✅ TASK-009 · Docker Compose Dev Stack — 2026-04-24
- ✅ TASK-010 · GitHub Actions CI/CD — 2026-04-24
- ✅ TASK-011 · Prometheus + Grafana — 2026-04-24
- ✅ TASK-012 · Recording Scheduler + BullMQ — 2026-04-24

---

*Lead Agent note (2026-04-24): Phase 0A complete — BOP hierarchy, AOI drawing tool, sensor catalogue, and role-split UI all shipped and QA-ready. Sprint 3 (AI & Alerts) also complete: YOLOv8 microservice stub with real cv2 fallback, zone-based intrusion detection, and real-time alert feed with severity badges. Phase 0B (TASK-035/036/037 — seismic, acoustic, thermal ingestion) is now unblocked. Sprint 4 (DevOps & Observability) can start in parallel.*
