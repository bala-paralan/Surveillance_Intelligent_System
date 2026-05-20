# TASK-032 — Sensor & Asset Catalogue with Spatial Query inside AOI

**Created:** 2026-04-24
**Phase:** 0 (Phase 0A)
**Priority:** P0
**Status:** Proposed
**Complexity:** M
**Primary owner:** Backend Agent
**Collaborators:** Frontend Agent, DevOps Agent, QA Agent
**Depends on:** TASK-031, TASK-041
**Source:** SIS.txt discussion, 2026-04-24
**Estimate:** 4 sprint days

---

## Summary

Once the operator has drawn an AOI, the system must answer *"what do I have here?"* — a catalogue of every installed sensor, camera, and GIS-sourced asset whose coordinates fall inside that polygon, along with live status and the data streams available on each. This catalogue is the single source of truth for Phase 0B ingestion and Phase 0C fusion.

## Goals

- `GET /aoi/:id/catalogue` returns all sensors + cameras + assets intersecting the AOI polygon.
- Each item reports: type (seismic / acoustic / thermal / LIDAR / pan / camera / asset), id, coords, installed_on, last_heartbeat, health, available streams.
- Live updates — the catalogue view reflects heartbeat changes within 5 s (Redis pub/sub → WebSocket).
- Asset ingestion adapter that imports from the GIS product (TASK-041 supplies the interface).

## Non-goals

- Sensor configuration UI (belongs in TASK-042 engineering view).
- Cross-AOI deduplication — if a sensor sits on the boundary of two AOIs it appears in both catalogues.

## User stories

- As an operator, when I select an AOI I want to see every sensor and asset inside it, colour-coded by health.
- As an engineer, I want the catalogue to surface a sensor whose heartbeat stops within 5 s.
- As an analyst, I want to query the catalogue by type (e.g. "all seismic sensors in Alpha-2") to scope a fusion rule.

## Acceptance criteria

- [ ] `GET /aoi/:id/catalogue` returns correct items for a test AOI containing 20 sensors (verified against fixtures).
- [ ] WebSocket subscription `/ws/aoi/:id/health` pushes heartbeat transitions within 5 s of Redis event.
- [ ] Query latency < 150 ms p95 at 10 000 sensor rows.
- [ ] Catalogue never exposes internal IPs of cameras (re-use `toPublic()` pattern from TASK-002).
- [ ] Zod validation + JWT auth on every endpoint.

## Technical design

### Backend (`src/backend/`)

- New `src/backend/services/catalogue-service.ts` with `listForAoi(aoiId)`.
- PostGIS query:
  ```sql
  SELECT * FROM sensor s
  WHERE ST_Intersects(s.location, (SELECT geometry FROM aoi WHERE id = $1))
  UNION ALL
  SELECT * FROM asset a WHERE ST_Intersects(a.location, ...)
  ```
- Composed via Prisma `$queryRaw` with parameterised AOI id.
- `catalogue-gateway.ts` WebSocket room `aoi:{id}` — subscribes once per AOI, multiplexed to clients.

### Frontend (`src/frontend/`)

- `CataloguePanel` component renders a virtualised list grouped by type.
- `SensorStatusDot` (green / amber / red) reflects `last_heartbeat` age.
- React Query key `['catalogue', aoiId]` with `staleTime: 30 s`, invalidated on WebSocket event.

### Data model

```prisma
model Sensor {
  id            String   @id @default(cuid())
  type          SensorType
  location      Unsupported("geometry(Point, 4326)")
  bopZoneId    String?
  installedOn   DateTime
  lastHeartbeat DateTime?
  health        SensorHealth @default(UNKNOWN)
  encryptedSecrets Bytes?   // credentials at rest, AES-256-CBC
  @@index([bopZoneId])
}

enum SensorType { SEISMIC ACOUSTIC THERMAL LIDAR PAN CAMERA }
enum SensorHealth { HEALTHY DEGRADED OFFLINE UNKNOWN }
```

GiST index on `location` required for spatial query performance.

### DevOps

- Backfill script seeds 500 fixture sensors across the dev AOIs.
- Grafana panel: "Catalogue query p95 latency".

## Testing strategy

- Unit: spatial predicate coverage (inside / outside / on boundary).
- Integration: seed 10 000 fixture sensors, assert p95 latency.
- Contract: WebSocket event schema versioned via `event_version` field.

## Security

- Sensor credentials AES-256-CBC encrypted at rest, never in responses.
- Asset information filtered by viewer's BOP scope (re-use RBAC from TASK-005).

## Observability

- Prometheus: `catalogue_query_latency_ms`, `catalogue_ws_subscribers`, `sensor_health_transitions_total`.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Spatial query slow at scale | Medium | Major | GiST index + benchmarks gate the release |
| Heartbeat flapping spams WebSocket | Medium | Minor | Debounce transitions by 10 s before broadcast |
| GIS asset import has drift | High | Major | Hash-based diffing; drift report surfaced in engineering view |

## Rollout

1. Ship behind `feature.catalogue_spatial`.
2. Load-test with 10 000 synthetic sensors.
3. Enable for pilot BOP, compare catalogue count vs GIS team's expected count.

## Definition of done

- [ ] Acceptance criteria checked
- [ ] Unit + integration + load tests green
- [ ] QA agent sign-off
- [ ] `docs/changelog/<date>-task-032.md` entry added
