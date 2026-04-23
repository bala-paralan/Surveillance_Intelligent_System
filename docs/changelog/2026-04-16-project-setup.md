# Changelog — 2026-04-16 — Project Setup

**Sprint:** 1
**Author:** Lead Agent
**Type:** Configuration / Infrastructure

## What was done

- Placed `CLAUDE.md` (master rulebook) in project root
- Created `.claude/settings.json` with:
  - `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: true`
  - `PostToolUse` hook: ESLint auto-lint on every file edit
  - `PreToolUse` hook: blocks direct edits on `main` branch
  - Permission allowlist: npm, npx, git, docker, pytest, prisma
- Created `.claude/skills/` with SKILL.md for all five agents:
  - `frontend-agent` — React UI, WebRTC/HLS, Zustand, Vitest
  - `backend-agent` — Fastify, Zod, Prisma, BullMQ, stream proxy
  - `analytics-agent` — YOLOv8, OpenCV, Redis pub/sub, FastAPI
  - `qa-agent` — test runner, coverage gates, GitHub issue format, Playwright
  - `devops-agent` — Docker, K8s, GitHub Actions, Prometheus, Grafana
- Scaffolded `docs/` directory:
  - `tasks/` — TASK-XXX.md files (Cowork creates these)
  - `changelog/` — per-sprint change entries (this file)
  - `releases/` — release notes
  - `standups/` — daily standup summaries
  - `bugs/` — triage reports
  - `deployments/` — GO/NO-GO checklists
  - `ROADMAP.md` — product backlog with Sprint 1 tasks
  - `cowork-templates.md` — Cowork prompt templates for product owner

## Existing code noted
- `dashboard/` — React 18 + Vite + Tailwind frontend (existing)
- `sse/` — Node.js SSE/WebSocket server (existing)

## Next steps
1. QA agent: audit `dashboard/` and `sse/` against CLAUDE.md conventions
2. Lead agent: create TASK-001.md for first product feature requirement
3. DevOps agent: create Docker Compose dev stack that includes existing services
