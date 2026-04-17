# SurveillanceOS — Project Rulebook

## What this system does
A full-stack IP camera surveillance platform:
- Connects and manages IP cameras (RTSP/ONVIF)
- Streams live video via WebRTC / HLS
- Runs motion detection and AI-based video analytics (person, vehicle, intrusion)
- Sends real-time alerts (push, email, SMS)
- Stores recordings with playback and clip export
- Provides a web + mobile dashboard for operators

## Tech stack
- **Frontend**: React 18, TypeScript strict, Tailwind CSS, WebRTC / HLS.js
- **Backend**: Node.js 22, Fastify, TypeScript
- **Video engine**: FFmpeg, GStreamer, RTSP-simple-server
- **AI/Analytics**: Python 3.11, OpenCV, YOLOv8 (via FastAPI microservice)
- **Database**: PostgreSQL 16 + Prisma ORM
- **Cache/Events**: Redis 7 (pub/sub for live alerts)
- **Message queue**: BullMQ (recording jobs, alert dispatch)
- **Auth**: JWT + refresh tokens, RBAC (admin / operator / viewer)
- **DevOps**: Docker Compose (dev), Kubernetes (prod), GitHub Actions CI/CD
- **Monitoring**: Prometheus + Grafana

## Directory structure
```
src/
  frontend/         # React app
    components/     # UI components (CameraGrid, PlayerModal, AlertFeed)
    pages/          # Route pages
    hooks/          # Custom React hooks
    store/          # Zustand state management
  backend/          # Fastify API server
    routes/         # REST endpoints
    services/       # Business logic
    repositories/   # DB access layer
    jobs/           # BullMQ job processors
    middleware/      # Auth, rate-limit, logging
  analytics/        # Python FastAPI — AI detection microservice
    models/         # YOLOv8 inference wrappers
    detectors/      # Motion, person, vehicle, intrusion
    api/            # FastAPI routes
  shared/
    types/          # Shared TypeScript types
    constants/      # Status codes, event names
infra/
  docker/           # Dockerfiles per service
  k8s/              # Kubernetes manifests
  scripts/          # Dev setup, seed, migration helpers
```

## Coding conventions
- Arrow functions only; no default exports (named only)
- camelCase for variables/functions; PascalCase for types/classes/components
- kebab-case for file names
- `@/` path alias for src root
- All async functions wrapped in try/catch with typed custom errors
- No `any` types — use `unknown` and type guards
- No hardcoded secrets — all config via `.env` / K8s secrets
- All API routes must have input validation (Zod schemas)
- All camera credentials encrypted at rest (AES-256)

## Absolute prohibitions
- NEVER store raw video on the application server — always object storage or NAS
- NEVER log PII or camera credentials to console or files
- NEVER expose internal camera IPs directly to the frontend
- NEVER commit `.env` files, certs, or API keys
- NEVER skip or delete existing tests
- NEVER deploy to production without QA agent green on all tests

## Team roles and responsibilities

### Lead agent
- Reads this CLAUDE.md and all SKILL.md files before starting
- Converts product requirements into a task plan
- Spawns frontend, backend, analytics, and QA agents with specific tasks
- Reviews all diffs before merging
- Resolves merge conflicts
- Files enhancement notes for future sprints

### Frontend agent
- Owns `src/frontend/`
- Responsible for camera grid, live player, alert panel, recording browser, settings UI
- Writes component-level Vitest + React Testing Library tests
- Never calls backend directly — always through typed API client in `src/frontend/api/`

### Backend agent
- Owns `src/backend/`
- Responsible for camera CRUD, stream proxy, recording management, alert dispatch, user/RBAC management
- Writes integration tests for every new route
- Validates all inputs with Zod before hitting the DB
- Documents every endpoint in OpenAPI comments

### Analytics agent
- Owns `src/analytics/`
- Responsible for YOLO inference, motion detection, zone-based intrusion logic
- Every detector must have a unit test with a sample frame
- Exposes results only via internal Redis pub/sub — never directly to frontend

### QA agent
- Runs `npm test` and `pytest` after every change
- On failure: files a GitHub issue with failing test name, stack trace, and severity (critical/major/minor)
- Runs E2E smoke tests (Playwright) before any PR merge
- Reports test summary to lead agent after each cycle

### DevOps agent
- Owns `infra/`
- Maintains Dockerfiles, docker-compose.yml, K8s manifests, GitHub Actions workflows
- Ensures health check endpoints exist for all services
- On deployment: verifies Prometheus metrics are reachable and Grafana dashboards load

## Bug fix loop
1. QA agent detects failure → files GitHub issue with label `bug`
2. Lead agent assigns to the responsible agent (frontend/backend/analytics)
3. Worker fixes in a feature branch
4. QA agent re-runs relevant test suite
5. Lead agent reviews diff and merges if green

## Feature workflow
1. You drop a requirement (plain English is fine)
2. Lead agent converts to tasks in `docs/tasks/TASK-XXX.md`
3. Tasks are parallelised across agents where possible (frontend + backend can work simultaneously)
4. Each agent documents what it built in `docs/changelog/`
5. Cowork generates sprint notes from changelog at end of each cycle

## Common commands
- Dev start: `docker compose up -d`
- Backend tests: `npm run test:backend`
- Frontend tests: `npm run test:frontend`
- Analytics tests: `pytest src/analytics/tests/`
- E2E: `npx playwright test`
- Lint: `npm run lint`
- DB migrate: `npx prisma migrate dev`
- Build prod: `npm run build`

## Security rules (always enforced)
- RTSP credentials: stored encrypted, never in logs or API responses
- All API endpoints require JWT auth except `/health` and `/auth/login`
- Rate limiting on all auth endpoints (5 req/min)
- Camera stream proxy: backend validates viewer permission before proxying
- Analytics results: include camera_id but never raw frame data in API responses
- Recording access: check viewer's allowed camera list before serving clips
