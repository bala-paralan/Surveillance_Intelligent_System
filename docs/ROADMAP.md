# SurveillanceOS — Product Roadmap

> Managed by Lead Agent. Updated at start/end of each sprint.  
> Last updated: 2026-04-16

---

## Sprint 1 — Foundation (Current)

**Goal:** Establish agent team configuration and bring existing code in line with CLAUDE.md before any new feature work begins.

**Sprint rule:** No new features are merged until TASK-001 is QA green.

| Task | Title | Owner(s) | Complexity | Status |
|------|-------|----------|------------|--------|
| TASK-001 | Audit & fix `dashboard/` and `sse/` against CLAUDE.md conventions | Frontend + Backend + QA + DevOps | **L** | 🔴 Open |

### TASK-001 sub-task tracker

| ID | Finding | Agent | Severity | Status |
|----|---------|-------|----------|--------|
| C-1 | Add JWT auth to all SSE REST routes | Backend | 🔴 Critical | Open |
| C-2 | Remove `global.__wss`, use dependency injection | Backend | 🔴 Critical | Open |
| M-1 | Convert 31 default exports → named exports (dashboard) | Frontend | 🟠 Major | Open |
| M-2 | VideoPanel: remove standalone WebSocket, use shared hook | Frontend | 🟠 Major | Open |
| M-3 | Replace all `../../` relative imports with `@/` alias | Frontend | 🟠 Major | Open |
| M-4 | Replace inline `style={{}}` with Tailwind classes | Frontend | 🟠 Major | Open |
| M-5 | Remove `console.warn` from production frontend code | Frontend | 🟠 Major | Open |
| M-6 | Add `test:frontend` npm script | DevOps | 🟠 Major | Open |
| M-7 | Enable `noUnusedLocals` and `noUnusedParameters` in tsconfig | Frontend | 🟠 Major | Open |
| M-8 | Migrate `sse/src/` from JavaScript to TypeScript | Backend | 🟠 Major | Open |
| M-9 | Add Zod validation to all SSE REST routes | Backend | 🟠 Major | Open |
| M-10 | Convert all generator default exports → named exports (sse) | Backend | 🟠 Major | Open |
| M-11 | Replace `console.log` with pino structured logger (sse) | Backend | 🟠 Major | Open |
| mn-1 | Update `engines.node` to `>=22` in sse/package.json | DevOps | 🟡 Minor | Open |
| mn-2 | Create `sse/.env.example` | DevOps | 🟡 Minor | Open |
| mn-3 | Configure vitest coverage thresholds (≥80%/85%) | DevOps | 🟡 Minor | Open |

---

## Sprint 2 — Core Camera Features (Planned)

> Starts only after TASK-001 is complete and QA is green.

| Task | Title | Owner(s) | Complexity | Status |
|------|-------|----------|------------|--------|
| TASK-002 | Camera CRUD API — add/edit/delete/test RTSP connection | Backend | M | Backlog |
| TASK-003 | Camera grid UI with live thumbnail snapshots (lazy-load) | Frontend | M | Backlog |
| TASK-004 | HLS stream proxy (backend signs URL → frontend plays via HLS.js) | Backend + Frontend | L | Backlog |
| TASK-005 | JWT auth + RBAC — admin / operator / viewer roles | Backend | M | Backlog |

---

## Sprint 3 — AI & Alerts (Planned)

| Task | Title | Owner(s) | Complexity | Status |
|------|-------|----------|------------|--------|
| TASK-006 | YOLOv8 person detection microservice (FastAPI + Redis pub/sub) | Analytics | L | Backlog |
| TASK-007 | Zone-based intrusion logic (polygon zones per camera) | Analytics | M | Backlog |
| TASK-008 | Real-time alert feed — slide-in UI, acknowledge, critical stays | Backend + Frontend | M | Backlog |

---

## Sprint 4 — DevOps & Observability (Planned)

| Task | Title | Owner(s) | Complexity | Status |
|------|-------|----------|------------|--------|
| TASK-009 | Docker Compose dev stack (all services + health checks) | DevOps | S | Backlog |
| TASK-010 | GitHub Actions CI/CD pipeline (lint → test → build → deploy) | DevOps | M | Backlog |
| TASK-011 | Prometheus metrics + Grafana dashboard (all 3 services) | DevOps | M | Backlog |
| TASK-012 | Recording scheduler + BullMQ jobs (object storage, not app server) | Backend | M | Backlog |

---

## Completed

*(Items move here once merged to main and QA is green.)*

- ✅ Project scaffold: CLAUDE.md, .claude/settings.json, all 5 SKILL.md files, docs/ structure — 2026-04-16

---

*Lead Agent note: The audit (TASK-001) revealed 2 Critical and 9 Major violations in existing code. The most significant risk is the missing JWT auth on SSE REST routes (C-1). This must be resolved before any public-facing deployment.*
