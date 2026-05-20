# TASK-031 — AOI Drawing Tool on Live Map

**Created:** 2026-04-24
**Phase:** 0 (Border Surveillance Multi-Sensor Platform — Phase 0A)
**Priority:** P0
**Status:** Proposed
**Complexity:** M
**Primary owner:** Frontend Agent
**Collaborators:** Backend Agent, QA Agent
**Depends on:** TASK-041
**Source:** SIS.txt discussion, 2026-04-24
**Estimate:** 5 sprint days

---

## Summary

The surveillance officer's first action is to tell the system *where to look*. Today the dashboard assumes one flat camera list. The officer needs to draw an **irregular polygon** on a live map with the mouse, label it (e.g. "Alpha-2 approach"), and pin it as a reusable Area of Interest (AOI). Everything else in Phase 0 — sensor catalogue, fusion, alerts — is scoped to AOIs created here.

## Goals

- MapLibre-GL-based live map with pan/zoom and basemap layer choice (satellite / topographic / hybrid).
- Polygon drawing tool: click-to-add vertex, double-click to close, drag-to-edit. Supports irregular (non-convex) polygons.
- AOI persistence: named, versioned, labelled with optional BOP sub-zone (from TASK-041).
- AOI list sidebar with quick-select and "zoom to AOI" button.
- GeoJSON import/export (`MultiPolygon` supported).

## Non-goals

- Temporal AOIs ("only between 18:00–06:00") — tracked in TASK-040.
- 3D/terrain AOIs — Phase 5 candidate.

## User stories

- As an operator, I want to draw the approach to Alpha-2 on the map so that the system monitors only the sensors inside that polygon.
- As an operator, I want to rename and re-edit an AOI later without losing the alert history scoped to it.
- As a supervisor, I want to import an AOI from the GIS team's GeoJSON file.

## Acceptance criteria

- [ ] Polygon with ≥6 vertices can be drawn on the map in under 10 s by a new operator.
- [ ] AOIs persist to the database and reload on page refresh.
- [ ] Editing an existing AOI preserves its ID and alert history.
- [ ] GeoJSON export round-trips through GeoJSON import with geometry equality.
- [ ] All AOI endpoints Zod-validated, JWT-authenticated, RBAC-gated (ADMIN+OPERATOR create/edit; VIEWER read).

## Technical design

### Frontend (`src/frontend/`)

- New route `/aoi` hosting `AoiMap` component backed by `maplibre-gl` + `@mapbox/mapbox-gl-draw` (or `terra-draw` if license simpler).
- Zustand `aoiStore` with `activeAoiId`, `draft`, `crud` actions; persists nothing client-side beyond view state.
- AOI sidebar: `AoiList`, `AoiCard` (name, vertex count, sub-zone, last-modified).
- Types added to `src/shared/types/aoi.ts` — `Aoi`, `AoiDraft`, `AoiGeoJson`.

### Backend (`src/backend/`)

- New routes under `src/backend/routes/aoi.ts`:
  - `GET /aoi` — list (RBAC: VIEWER+)
  - `POST /aoi` — create (ADMIN+OPERATOR)
  - `PATCH /aoi/:id` — rename / re-geometry (ADMIN+OPERATOR)
  - `DELETE /aoi/:id` — (ADMIN)
- Geometry validated with `zod` + a PostGIS `ST_IsValid` check.
- Emits `aoi:created|updated|deleted` events on Redis pub/sub for downstream services.

### Data model (Prisma + PostGIS)

```prisma
model Aoi {
  id          String   @id @default(cuid())
  name        String
  bopZoneId   String?  // FK → BopZone, nullable
  geometry    Unsupported("geometry(Polygon, 4326)")
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([bopZoneId])
}
```

Migration enables PostGIS (`CREATE EXTENSION IF NOT EXISTS postgis;`).

### DevOps

- Postgres image bumped to `postgis/postgis:16-3.4`.
- Health check validates PostGIS is loaded.

## Testing strategy

- Unit: polygon validity, GeoJSON round-trip, RBAC gate.
- Integration: create → list → edit → delete against PostGIS.
- E2E (Playwright): draw an 8-vertex polygon, save, reload page, confirm geometry identical.

## Security

- Enforce max 1000 vertices per polygon (prevent DoS).
- Never log full geometry (lat/long) at `info` level; only AOI id + vertex count.
- GeoJSON import sanitised for `__proto__` / prototype-pollution payloads.

## Observability

- Prometheus: `aoi_count`, `aoi_edit_latency_ms`, `aoi_validation_failures_total`.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Large polygons slow down the spatial query in TASK-032 | Medium | Major | GiST index + `ST_Simplify` cap at 1000 vertices |
| PostGIS migration fails on managed Postgres | Low | Major | Confirm provider support pre-migration; docker-compose test |
| Operators accidentally delete an AOI | Medium | Minor | Soft-delete with 24 h restore window |

## Rollout

1. Ship behind feature flag `feature.aoi_map`.
2. Enable for internal engineering team for 48 h.
3. Enable for one BOP pilot before broader rollout.

## Definition of done

- [ ] Acceptance criteria checked
- [ ] Unit + integration + E2E tests green
- [ ] QA agent sign-off
- [ ] Feature flag in staging 48 h with zero rollbacks
- [ ] `docs/changelog/<date>-task-031.md` entry added
