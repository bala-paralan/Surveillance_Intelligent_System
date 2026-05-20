# TASK-001 — Code Audit: dashboard/ and sse/ against CLAUDE.md conventions

**Created:** 2026-04-16  
**Sprint:** 1  
**Status:** ✅ Done — merged 2026-04-24 on branch `fix/task-001-conventions` (outer + dashboard repos)  
**Complexity:** L  
**Requested by:** Product Owner (via Cowork Template 1)  
**Lead Agent Review:** Complete — all criticals and majors resolved, QA green, Sprint 2 unblocked

---

## Requirement (plain English)

The existing `dashboard/` (React 18 + TypeScript) and `sse/` (Node.js + Fastify) code must be audited and brought in line with CLAUDE.md conventions before any new feature work starts. No new features should be merged until this task is green on all QA checks.

---

## Audit findings (Lead Agent — 2026-04-16)

The Lead Agent has read both codebases in full. Findings are grouped by severity.

---

### 🔴 CRITICAL — Must fix before any PR is merged

| # | File(s) | Finding | Rule violated |
|---|---------|---------|---------------|
| C-1 | `sse/src/restServer.js` | No auth on any REST route — `/api/scenario`, `/api/alerts`, `/api/sensors`, `/api/system-health` all accept unauthenticated requests. Any external actor can change the active scenario or read all alerts. | `All API endpoints require JWT auth except /health and /auth/login` |
| C-2 | `sse/src/index.js:53` | `global.__wss = wsServer` — assigns the WebSocket server to Node.js global scope. This is an unsafe shared-state antipattern that makes the service untestable and non-restartable without process kill. | Coding conventions — no global mutable state |

---

### 🟠 MAJOR — Must fix within Sprint 1

#### Frontend (`dashboard/`)

| # | Files affected | Finding | Rule violated |
|---|---------------|---------|---------------|
| M-1 | 31 component files | **All components use `export default`** — `App.tsx`, every layout, panel, widget, map, and page component. Violates the named-export-only rule across the entire codebase. | `No default exports (named only)` |
| M-2 | `VideoPanel.tsx:284–294` | **VideoPanel creates its own `new WebSocket(url)` connection** (`wsRef`) independently of the shared `useWebSocket` hook. This creates a duplicate connection per mount, bypasses the shared connection-state and reconnect logic, and leaks the socket on fast unmount. | Frontend SKILL.md: "Never call fetch/axios directly inside components — always through typed API client" |
| M-3 | All component files | **All imports use relative paths** (`../../store/sensorStore`, `../widgets/AlertRow`) instead of the configured `@/` alias. `tsconfig.json` already configures `@/*` → `src/*` but it is never used. | `@/ path alias for src root` |
| M-4 | All panel/layout/widget files | **Inline `style={{}}` objects throughout** — virtually every component passes inline style objects instead of Tailwind utility classes. A surveillance UI dark theme is achievable entirely in Tailwind. | Frontend SKILL.md: `"Tailwind utility classes only — no custom CSS unless absolutely necessary"` |
| M-5 | `useWebSocket.ts:134` `ScenarioSelector.tsx:38` | `console.warn(...)` in production code paths. | Frontend SKILL.md: `"No console.log in production code — use the logger utility"` |
| M-6 | `dashboard/package.json` | Missing `test:frontend` script (only `test` and `test:ui` exist). CLAUDE.md common commands reference `npm run test:frontend`. CI pipeline and QA agent depend on this script name. | `Common commands: npm run test:frontend` |
| M-7 | `dashboard/tsconfig.json:15–16` | `"noUnusedLocals": false` and `"noUnusedParameters": false` weaken strict TypeScript. CLAUDE.md specifies TypeScript strict mode. | `TypeScript strict` |

#### Backend SSE (`sse/`)

| # | Files affected | Finding | Rule violated |
|---|---------------|---------|---------------|
| M-8 | All `sse/src/` files | **SSE server is plain JavaScript** — all `.js` files, no TypeScript. CLAUDE.md specifies TypeScript for the backend layer. No type safety, no Prisma types, no Zod inference. | `Backend: Node.js 22, Fastify, TypeScript` |
| M-9 | `restServer.js:156–187` | `POST /api/scenario` uses Fastify's raw JSON schema — not Zod. All other routes have no input validation at all. | `All API routes must have input validation (Zod schemas)` |
| M-10 | All generator files | **All generators use `export default class`** — `SeismicGenerator`, `AcousticGenerator`, `OpticalGenerator`, `RadarGenerator`, `MagneticGenerator`, `ChemicalGenerator`, `FibreGenerator`, `AimlGenerator`, `scenarioManager`, `sensorPayloadSchema`. | `No default exports (named only)` |
| M-11 | `wsServer.js`, `index.js`, `restServer.js`, `correlator.js`, `scenarioManager.js`, `generators/base.js`, `generators/aiml.js` | **14+ `console.log` / `console.error` calls** scattered across 7 files. No structured logger (pino is not installed). | `NEVER log PII or camera credentials` (and SKILL.md: no console in production) |

---

### 🟡 MINOR — Fix within Sprint 2

| # | File(s) | Finding |
|---|---------|---------|
| mn-1 | `sse/package.json` | Requires `node >= 20` but CLAUDE.md stack specifies Node.js 22. |
| mn-2 | `sse/` root | No `.env.example` file (dashboard has one, sse does not). |
| mn-3 | `vitest.config` (missing) | No coverage threshold configuration. QA agent cannot enforce the 80%/85% coverage gates required by qa-agent SKILL.md. |
| mn-4 | `dashboard/tsconfig.json:22` | `"exclude": ["src/test"]` excludes test files from type-checking. Type errors in test files will go undetected. |

---

## Agent assignments

| Agent | Sub-tasks | Files touched |
|-------|-----------|---------------|
| **Frontend Agent** | Fix M-1 (named exports), M-2 (VideoPanel WS), M-3 (@/ aliases), M-4 (Tailwind migration), M-5 (console.warn), M-6 (test script), M-7 (tsconfig), mn-3 (coverage config) | All `dashboard/src/**` |
| **Backend Agent** | Fix C-1 (add JWT auth middleware), C-2 (remove global), M-8 (TypeScript migration), M-9 (Zod validation), M-10 (named exports), M-11 (structured logger), mn-1 (Node version), mn-2 (.env.example) | All `sse/src/**` |
| **QA Agent** | Baseline test run → coverage report → re-run after each fix → produce triage doc | Test suite |
| **DevOps Agent** | Update `package.json` scripts to add `test:frontend` / `test:backend`, configure coverage thresholds in CI | `dashboard/package.json`, `sse/package.json`, future `.github/workflows/ci.yml` |

---

## Work breakdown and sequencing

```
Phase 1 — Critical fixes (C-1, C-2) — Backend Agent — unblocks all other work
  └── C-1: Add JWT auth middleware to all SSE REST routes (or scope auth to intranet-only)
  └── C-2: Replace global.__wss with dependency injection (pass wsServer as constructor arg)

Phase 2 — Can run in parallel once Phase 1 is done
  ├── Frontend Agent: M-1 → M-3 → M-5 → M-6 → M-7 (mechanical, low-risk)
  └── Backend Agent:  M-9 → M-10 → M-11 → M-8 (TypeScript migration last — largest change)

Phase 3 — Tailwind migration (M-4)
  └── Frontend Agent: replace inline styles — largest change, do panel-by-panel, one PR per panel

Phase 4 — QA verification
  └── QA Agent: full test run, coverage report, confirm no regressions
```

> **Note on M-8 (TypeScript migration):** This is the largest single change. Recommend adding TypeScript as a devDependency in `sse/`, converting one file at a time starting with `types.ts` (new shared types file), `restServer.ts`, then generators. Do NOT convert all at once — risk of breaking running server.

---

## Dependencies

- None — this task has no upstream dependencies. It is the foundation for all future feature work.
- No new features should be started until at minimum C-1 and C-2 are resolved.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Named export refactor breaks existing test snapshots | High | Minor | Run `npm run test` after each file converted, update snapshots |
| JWT auth on SSE breaks existing dashboard WebSocket connection | Medium | Major | Implement auth on REST only first; WebSocket auth can use query-param token |
| TypeScript migration introduces build errors | High | Major | Convert files one at a time in separate PRs; keep JS files compiling in parallel |
| Tailwind migration changes visual output | Medium | Minor | Screenshot existing panels before and after, compare |
| VideoPanel WS refactor causes PTZ control regression | Low | Major | QA agent must run PTZ manual test after M-2 fix |

---

## Complexity estimate

**L (Large)** — 31+ frontend files affected (named exports + alias + Tailwind), TypeScript backend migration, new auth middleware, structured logging, coverage configuration. Estimated 3–5 sprint days across all agents working in parallel.

---

## Definition of done

- [x] C-1: All REST routes (except `/api/health`) return `401` when called without a valid JWT — `jwt.verify()` against `SSE_JWT_SECRET`, dev-mode bypass, raw API key pattern replaced
- [x] C-2: `global.__wss` removed; `wsServer` passed via function argument or module export
- [x] M-1: Zero `export default` in `dashboard/src/` (excluding `vite-env.d.ts`)
- [x] M-2: `VideoPanel` uses the shared `useWebSocket` hook; no standalone `new WebSocket()` inside component
- [x] M-3: All imports in `dashboard/src/` use `@/` alias; zero `../../` relative paths
- [x] M-4: Inline `style={{}}` replaced with Tailwind classes across all panel components (incl. `DeviceConfigPage` 4-tab layout)
- [x] M-5: Zero `console.warn` / `console.log` in `dashboard/src/` production paths
- [x] M-6: `npm run test:frontend` succeeds
- [x] M-7: `noUnusedLocals: true`, `noUnusedParameters: true` in tsconfig; zero new TS errors
- [x] M-8: All `sse/src/` files converted to `.ts` (16 files); `tsc --noEmit` green, private class fields, typed generics, zero `any`, ES2022 + NodeNext
- [x] M-9: All SSE REST routes validated with Zod schemas — `AlertsQuery` on `/api/alerts`, response enriched with `total/page/limit`
- [x] M-10: Zero `export default` in `sse/src/`
- [x] M-11: All `console.log` in `sse/` replaced with structured pino logger calls
- [x] mn-1: `engines.node` updated to `>=22` in `sse/package.json`
- [x] mn-2: `sse/.env.example` created
- [x] mn-3: Coverage thresholds configured in vitest — frontend ≥80% lines, backend ≥85% lines
- [x] QA Agent green on full test suite — 273 dashboard tests green, no regressions

---

## Output artifacts

- `docs/bugs/triage-2026-04-16.md` — this task's audit findings (summary version for tracking)
- GitHub issues for each Critical and Major finding (C-1 through M-11)
- `docs/changelog/<date>-task-001-fixes.md` — per-agent changelog entries after completion
