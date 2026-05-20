# SurveillanceOS — Product Roadmap

> Managed by Lead Agent. Updated at start/end of each sprint.
> Last updated: 2026-04-24

---

## 🔥 Phase 0 — Border Surveillance Multi-Sensor Platform (NEW TOP PRIORITY)

**Source:** Product discussion transcribed in `SIS.txt` (2026-04-24).
**Directive:** This phase is now the highest-priority work item across the program. Sprint 3 (AI & Alerts) continues in parallel but **must design for the data model established in Phase 0A** (AOI, assets, BOP hierarchy) rather than inventing a parallel one. No Phase 1 feature work begins until Phase 0A is QA green.

### Why this exists

The operator we are building for is not a security-camera viewer — it is a **surveillance officer at a Border Outpost (BOP)** who needs to understand a threat *before* it crosses. The current camera-only model is insufficient. The system must fuse signals from **seismic, acoustic, thermal, LIDAR, pan imagery, and IP cameras** deployed across a BOP's sub-zones (e.g. *BOP-Alpha → Alpha-1, Alpha-2, …*) and present them in terms the officer can act on — not as raw waveforms.

### Requirement themes lifted from the discussion

1. **Area of Interest (AOI) first.** The operator draws an irregular polygon on a live map with the mouse. Everything downstream — sensor catalogue, assets, alerts, analytics — is scoped to that polygon.
2. **Sensor & asset catalogue inside the AOI.** Once an AOI is drawn, the system lists the installed sensors and cameras whose coordinates fall inside it, with their current status and available data streams.
3. **Operator UI vs Engineering UI are separate.** System health, raw waveforms, configuration and diagnostics belong on the engineering screen. The operator sees only human-readable intent: *"3 people moving NW inside Alpha-2, ~2.1 km from sensor SE-14"*.
4. **Use-case visualization, not raw data.** A seismic spike is not shown as a waveform to the operator — it is shown as *"possible tunnel"* or *"continuous footsteps within 5 km radius, direction estimated W→E, pattern suggests human not animal"*.
5. **Multi-sensor fusion is the core intelligence.** A single sensor can be spoofed or noisy. Combined confidence across co-located sensors is the primary threat score.
6. **Multi-AOI quadview.** The operator can divide the barrier screen into 2 or 4 panels, each locked to its own AOI, for simultaneous monitoring.
7. **BOP / site hierarchy is dynamic, not static.** Sensors and assets are populated from the GIS product; the system must not hardcode BOP-Alpha or any specific deployment.

### Phase 0A — Operator UX foundation (blocks 0B and 0C)

| Task | Title | Owner(s) | Priority | Complexity | Depends on | Status |
|------|-------|----------|----------|------------|------------|--------|
| TASK-041 | BOP / Site Hierarchy Model — dynamic, GIS-sourced | Backend + DevOps | P0 | M | TASK-005 ✅ | 🔴 Proposed |
| TASK-031 | AOI Drawing Tool — irregular polygon on live map | Frontend + Backend | P0 | M | TASK-041 | 🔴 Proposed |
| TASK-032 | Sensor & Asset Catalogue with spatial query inside AOI | Backend + Frontend | P0 | M | TASK-031, TASK-041 | 🔴 Proposed |
| TASK-034 | Role-split UI — Operator vs Engineering views | Frontend + Backend | P0 | M | TASK-005 ✅ | 🔴 Proposed |

### Phase 0B — Multi-sensor ingestion (can run in parallel once 0A is merged)

| Task | Title | Owner(s) | Priority | Complexity | Depends on | Status |
|------|-------|----------|----------|------------|------------|--------|
| TASK-035 | Seismic sensor ingestion + pattern classification (tunnel / footsteps / vehicle) | Analytics + Backend | P0 | L | TASK-032 | 🔴 Proposed |
| TASK-036 | Acoustic sensor ingestion + classification (gunshot / voices / vehicle) | Analytics + Backend | P0 | M | TASK-032 | 🔴 Proposed |
| TASK-037 | Thermal / LIDAR / Pan-image ingestion adapter | Analytics + Backend | P1 | L | TASK-032 | 🔴 Proposed |

### Phase 0C — Fusion, visualization and operator surface

| Task | Title | Owner(s) | Priority | Complexity | Depends on | Status |
|------|-------|----------|----------|------------|------------|--------|
| TASK-039 | Multi-sensor fusion engine — combined confidence scoring | Analytics + Backend | P0 | L | TASK-035, TASK-036, TASK-037 | 🔴 Proposed |
| TASK-038 | Use-case visualization layer — tunnel / footstep-radius / direction glyphs | Frontend + Analytics | P0 | L | TASK-035, TASK-039 | 🔴 Proposed |
| TASK-040 | Human-readable alerts on live map — zone-scoped, actionable | Frontend + Backend | P0 | M | TASK-039, TASK-041 | 🔴 Proposed |
| TASK-033 | Multi-AOI quadview panel (1 / 2 / 4 split) | Frontend | P1 | M | TASK-031, TASK-032 | 🔴 Proposed |
| TASK-042 | Engineering & maintenance view — raw waveforms, health, thresholds, diagnostics | Frontend + Backend | P1 | M | TASK-034, TASK-035 | 🔴 Proposed |

### Phase 0 gating rules

- **TASK-041 → TASK-031 → TASK-032** is the critical path. Nothing else in Phase 0 starts until those three are drafted and the data contracts (AOI GeoJSON, sensor/asset schema) are frozen.
- **Sprint 3 (TASK-006/007/008) is not cancelled** — it continues, but alerts emitted by Sprint 3 must be consumable by TASK-040 (human-readable alerts on map) without a rewrite. The alert event schema is a shared deliverable.
- **No Phase 1 (Harden the core) task begins** until Phase 0A is QA green.
- **Engineering-mode features (TASK-042) are gated** behind the engineer role created in TASK-034. Operators must not see raw waveforms by default.
- All GIS and sensor coordinate data must go through the encrypted-at-rest pathway already established for camera credentials — no plaintext lat/long in application logs.

---

## Sprint 1 — Foundation ✅ Complete

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

**Sprint rule:** No new features are merged until TASK-001 is QA green. — **Rule satisfied; Sprint 2 unlocked.**

| Task | Title | Owner(s) | Complexity | Status |
|------|-------|----------|------------|--------|
| TASK-001 | Audit & fix `dashboard/` and `sse/` against CLAUDE.md conventions | Frontend + Backend + QA + DevOps | **L** | ✅ Done (2026-04-24) |

### TASK-001 sub-task tracker

| ID | Finding | Agent | Severity | Status |
|----|---------|-------|----------|--------|
| C-1 | Add JWT auth to all SSE REST routes | Backend | 🔴 Critical | ✅ Done — `jwt.verify()` against `SSE_JWT_SECRET`, dev-mode bypass, raw API key pattern replaced |
| C-2 | Remove `global.__wss`, use dependency injection | Backend | 🔴 Critical | ✅ Done — wsServer now injected, no global mutable state |
| M-1 | Convert 31 default exports → named exports (dashboard) | Frontend | 🟠 Major | ✅ Done — dashboard UI overhaul, 273 tests green |
| M-2 | VideoPanel: remove standalone WebSocket, use shared hook | Frontend | 🟠 Major | ✅ Done — shared `useWebSocket` hook adopted |
| M-3 | Replace all `../../` relative imports with `@/` alias | Frontend | 🟠 Major | ✅ Done |
| M-4 | Replace inline `style={{}}` with Tailwind classes | Frontend | 🟠 Major | ✅ Done — Tailwind migration complete; `DeviceConfigPage` refactored to 4-tab layout |
| M-5 | Remove `console.warn` from production frontend code | Frontend | 🟠 Major | ✅ Done |
| M-6 | Add `test:frontend` npm script | DevOps | 🟠 Major | ✅ Done |
| M-7 | Enable `noUnusedLocals` and `noUnusedParameters` in tsconfig | Frontend | 🟠 Major | ✅ Done |
| M-8 | Migrate `sse/src/` from JavaScript to TypeScript | Backend | 🟠 Major | ✅ Done — all 16 `sse/src/**/*.js` converted to `.ts`; private class fields, typed generics, zero `any`, ES2022 + NodeNext, `tsc --noEmit` green |
| M-9 | Add Zod validation to all SSE REST routes | Backend | 🟠 Major | ✅ Done — `AlertsQuery` schema on `/api/alerts`; responses enriched with `total/page/limit` |
| M-10 | Convert all generator default exports → named exports (sse) | Backend | 🟠 Major | ✅ Done |
| M-11 | Replace `console.log` with pino structured logger (sse) | Backend | 🟠 Major | ✅ Done |
| mn-1 | Update `engines.node` to `>=22` in sse/package.json | DevOps | 🟡 Minor | ✅ Done |
| mn-2 | Create `sse/.env.example` | DevOps | 🟡 Minor | ✅ Done |
| mn-3 | Configure vitest coverage thresholds (≥80%/85%) | DevOps | 🟡 Minor | ✅ Done |

**Delivery:** Branch `fix/task-001-conventions` merged across outer + dashboard repos.

---

## Sprint 2 — Core Camera Features ✅ Complete

> Unblocked once TASK-001 went QA green.

| Task | Title | Owner(s) | Complexity | Status |
|------|-------|----------|------------|--------|
| TASK-002 | Camera CRUD API — add/edit/delete/test RTSP connection | Backend | M | ✅ Done (commit `be9e850`) |
| TASK-003 | Camera grid UI with live thumbnail snapshots (lazy-load) | Frontend | M | ✅ Done (commit `bbad4db`) |
| TASK-004 | HLS stream proxy (backend signs URL → frontend plays via HLS.js) | Backend + Frontend | L | ✅ Done (commit `be9e850`) |
| TASK-005 | JWT auth + RBAC — admin / operator / viewer roles | Backend | M | ✅ Done (commit `be9e850`) |

**Sprint 2 highlights**
- `camera-repo.ts` + `camera-service.ts` with AES-256-CBC encryption of RTSP URL/username/password at rest; `toPublic()` strips secrets from every response
- 6-endpoint `cameras.ts` route (list, get, create, update, delete, test) — Zod-validated, RBAC-gated (VIEWER read / ADMIN+OPERATOR write / ADMIN delete)
- Typed dashboard API client (`src/api/client.ts`) with automatic JWT refresh on 401; `cameraStore` Zustand store; CameraStatusBadge → CameraCard → CameraFormModal → CameraPlayer → CameraGrid component stack
- CameraPlayer uses HLS.js with native HLS fallback for Safari; 📷 IP Cameras panel wired into `PanelGrid` + sidebar
- `stream-service.ts` — FFmpeg per-camera transcode (RTSP → HLS), 60 s idle auto-kill, segment cleanup on stop, `stopAllStreams()` on graceful shutdown
- `streams.ts` route — start/stop/list/serve `.m3u8` + `.ts` with correct MIME types, auth-gated
- Full JWT + RBAC stack — Prisma schema (User / RefreshToken / Camera), Zod env validation, AES-256-CBC crypto util, `verifyJwt` + `requireRole(...)` middleware, bcrypt cost-12 login, rotating opaque refresh tokens (bcrypt cost-10 hashed in DB), `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`; rate-limit 5 req/min on auth endpoints
- Fastify hardened: Helmet, CORS, rate-limit, static files, graceful SIGTERM/SIGINT; seed script provisions default ADMIN
- Both repos pushed live: `bala-paralan/Surveillance_Intelligent_System` + `bala-paralan/sis-dashboard`

Sprint summary: `docs/changelog/SPRINT-2.md`

---

## Sprint 3 — AI & Alerts (Current)

| Task | Title | Owner(s) | Complexity | Status |
|------|-------|----------|------------|--------|
| TASK-006 | YOLOv8 person detection microservice (FastAPI + Redis pub/sub) | Analytics | L | 🔴 Open |
| TASK-007 | Zone-based intrusion logic (polygon zones per camera) | Analytics | M | 🔴 Open |
| TASK-008 | Real-time alert feed — slide-in UI, acknowledge, critical stays | Backend + Frontend | M | 🔴 Open |

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

## Phase 1 — Harden the core (Planned)

> Begins after Sprint 3 + Sprint 4 close QA green. Tightens everything the foundation shipped: live view, alerting, and recording.

| Task | Title | Owner(s) | Priority | Complexity | Depends on | Status |
|------|-------|----------|----------|------------|------------|--------|
| TASK-013 | Multi-camera live view enhancements — ABR, low-bandwidth snapshot mode, PiP, health heartbeats | Frontend + Backend | P0 | M | TASK-003 ✅, TASK-004 ✅ | Proposed |
| TASK-014 | Smarter alerting — rules engine, acknowledgement, assignment, resolution | Backend + Frontend | P0 | L | TASK-008, TASK-013 | Proposed |
| TASK-015 | Recording lifecycle management — hot/warm/cold tiers, clip export, chain-of-custody | Backend + DevOps | P0 | L | TASK-012 | Proposed |

---

## Phase 2 — Advanced analytics (Planned)

> Gated: Phase 1 must be 100% QA green before Phase 2 begins.

| Task | Title | Owner(s) | Priority | Complexity | Depends on | Status |
|------|-------|----------|----------|------------|------------|--------|
| TASK-016 | Advanced zones & line-crossing rules engine | Analytics + Frontend | P1 | L | TASK-007, TASK-014 | Proposed |
| TASK-017 | License plate recognition (LPR) with watchlist | Analytics + Backend | P1 | L | TASK-006, TASK-014 | Proposed |
| TASK-018 | Face blur & configurable privacy masks | Analytics + Frontend | P1 | M | TASK-006, TASK-015, TASK-016 | Proposed |
| TASK-019 | Behavioral analytics — loitering, heatmaps, anomaly scoring | Analytics | P2 | L | TASK-016 | Proposed |

---

## Phase 3 — Scale and operations (Planned)

> Gated: TASK-021 (multi-tenant) must merge before any customer pilot exceeds 2 sites.

| Task | Title | Owner(s) | Priority | Complexity | Depends on | Status |
|------|-------|----------|----------|------------|------------|--------|
| TASK-020 | Edge inference agent (Jetson/Coral) | Analytics + DevOps | P1 | XL | TASK-006, TASK-011 | Proposed |
| TASK-021 | Multi-tenant + site hierarchy with scoped RBAC | Backend + Frontend | P0 (blocker for multi-customer) | L | TASK-005 ✅ | Proposed |
| TASK-022 | Horizontal scaling for stream proxy | Backend + DevOps | P1 | L | TASK-004 ✅, TASK-011 | Proposed |
| TASK-023 | Audit log & compliance reporting | Backend + Frontend | P1 | M | TASK-005 ✅, TASK-015, TASK-021 | Proposed |

---

## Phase 4 — Operator experience and integrations (Planned)

| Task | Title | Owner(s) | Priority | Complexity | Depends on | Status |
|------|-------|----------|----------|------------|------------|--------|
| TASK-024 | Mobile app (React Native) | Frontend | P1 | XL | TASK-004 ✅, TASK-005 ✅, TASK-014, TASK-021 | Proposed |
| TASK-025 | Two-way audio & PTZ control | Backend + Frontend | P2 | M | TASK-004 ✅, TASK-005 ✅ | Proposed |
| TASK-026 | Third-party integrations — webhooks, Slack/Teams/PagerDuty, MQTT, public API | Backend | P1 | L | TASK-005 ✅, TASK-014, TASK-021 | Proposed |
| TASK-027 | AI-generated incident summaries | Analytics + Backend | P2 | M | TASK-014, TASK-015, TASK-016 | Proposed |

---

## Phase 5 — Platform polish (Exploratory)

> May be re-scoped based on Phase 2–4 learnings.

| Task | Title | Owner(s) | Priority | Complexity | Depends on | Status |
|------|-------|----------|----------|------------|------------|--------|
| TASK-028 | Natural-language search over recordings (CLIP embeddings) | Analytics + Backend | P2 | L | TASK-015, TASK-021 | Proposed |
| TASK-029 | Digital twin / floor plan view | Frontend + Backend | P2 | M | TASK-021 | Proposed |
| TASK-030 | Offline-resilient edge recording with backfill | Analytics + Backend | P2 | M | TASK-015, TASK-020 | Proposed |

---

## Phase gating rules

- Phase 1 must be 100% QA green before Phase 2 begins.
- Phase 3 requires TASK-021 (multi-tenant) merged before any customer pilot exceeds 2 sites.
- Phase 4 mobile app (TASK-024) depends on TASK-005 ✅ (RBAC) and TASK-004 ✅ (HLS proxy) — both delivered.
- Phase 5 items are exploratory; they may be re-scoped based on Phase 2–4 learnings.

---

## Completed

*(Items move here once merged to main and QA is green.)*

- ✅ Project scaffold: CLAUDE.md, .claude/settings.json, all 5 SKILL.md files, docs/ structure — 2026-04-16
- ✅ TASK-001 · Code Audit & Convention Fix — 2026-04-24 (branch `fix/task-001-conventions`)
- ✅ TASK-002 · Camera CRUD API — 2026-04-24 (commit `be9e850`)
- ✅ TASK-003 · Camera Grid UI — 2026-04-24 (commit `bbad4db`)
- ✅ TASK-004 · HLS Stream Proxy — 2026-04-24 (commit `be9e850`)
- ✅ TASK-005 · JWT Auth + RBAC — 2026-04-24 (commit `be9e850`)

---

*Lead Agent note (2026-04-24): Sprint 1 and Sprint 2 are closed. Foundation is now QA green — TypeScript end-to-end, JWT + RBAC enforced on every REST route, camera stack live with encrypted credentials, HLS proxy operational, dashboard shipping. Sprint 3 (AI & Alerts) is cleared to start: YOLOv8 microservice, polygon intrusion zones, and the real-time alert feed are next up. The forward feature ladder (Phase 1 → Phase 5, TASK-013 through TASK-030) is fully laid out above with owners, complexity, and dependency links — Phase 1 unlocks as soon as Sprint 3 + 4 close.*

*Lead Agent addendum (2026-04-24, post-SIS.txt review): Product scope has been materially expanded. The system we are building is no longer an IP-camera platform with AI bolted on — it is a **multi-sensor border surveillance platform** where cameras are one sensor class among several (seismic, acoustic, thermal, LIDAR, pan). The new Phase 0 (TASK-031 through TASK-042) is now the program's top priority and sits ahead of Phase 1. Sprint 3 continues in parallel but its alert event schema becomes a shared deliverable with TASK-040. Frontend and Backend agents should begin Phase 0A (TASK-041 → TASK-031 → TASK-032 → TASK-034) immediately on dependency unblock; Analytics agent should pre-read TASK-035/036/037 and flag any sensor-SDK gaps. CLAUDE.md will need a follow-up revision to reflect the expanded sensor scope, and new directories (`src/sensors/`, `src/fusion/`) will be proposed in TASK-041's technical design.*
