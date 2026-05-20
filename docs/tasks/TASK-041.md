# TASK-041 — BOP / Site Hierarchy Model (dynamic, GIS-sourced)

**Created:** 2026-04-24
**Phase:** 0 (Phase 0A — **FOUNDATIONAL**, critical-path)
**Priority:** P0
**Status:** Proposed
**Complexity:** M
**Primary owner:** Backend Agent
**Collaborators:** DevOps Agent, QA Agent
**Depends on:** TASK-005 ✅
**Source:** SIS.txt discussion, 2026-04-24 — *"I assumed this is static. But we are not developing the product for just that. You have to use a state. In the area of interest, there is asset information of the GEO product. Then you populate the asset."*
**Estimate:** 4 sprint days

---

## Summary

The product must not hardcode *BOP-Alpha / Alpha-1 / Alpha-2*. Border Outposts and their sub-zones must be dynamic entities populated from a GIS product. Every downstream Phase 0 concept (AOI, sensor catalogue, alert scope, RBAC) hangs off this hierarchy. This task ships the data model, ingestion pathway from the GIS product, and the scoping primitives the rest of Phase 0 relies on.

## Goals

- Prisma models for `Bop` and `BopZone` (self-referencing parent/child for sub-zones).
- Ingestion adapter pulls BOP/zone/asset metadata from the GIS product (HTTP / GeoPackage / PostGIS — adapter per source).
- Diff-based sync: hash last-known state, surface drift to engineers.
- Scope primitives: users and roles can be pinned to a BOP or zone (extends TASK-005 RBAC).
- No lat/long, boundary polygon, or asset name is treated as PII, but all are encrypted at rest given export-control sensitivity.

## Non-goals

- GIS product is not authored inside SurveillanceOS — we consume.
- Manual BOP creation UI — engineering view only in v1 (TASK-042).

## User stories

- As an engineer, I want new BOPs to appear without code change when the GIS team adds them.
- As an admin, I want to scope an operator to *just* BOP-Alpha so they only see its AOIs/alerts/catalogue.
- As an analyst, I want to query fusion outcomes by BOP or by zone.

## Acceptance criteria

- [ ] Data model migration lands with GiST indices and FKs.
- [ ] Ingestion adapter pulls a sample GeoPackage and populates 5 BOPs / 20 zones / 100 assets.
- [ ] Sync job runs on a cron (default every 30 min) and records diffs in `gis_sync_log`.
- [ ] RBAC scope honoured by existing routes (camera, auth) — no data leaks across BOP.
- [ ] Zero plaintext boundary geometry in application logs.

## Technical design

### Backend

```prisma
model Bop {
  id         String    @id @default(cuid())
  code       String    @unique // e.g. "ALPHA"
  name       String
  boundary   Unsupported("geometry(MultiPolygon, 4326)")
  zones      BopZone[]
  assets     Asset[]
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
}

model BopZone {
  id         String   @id @default(cuid())
  bopId      String
  code       String   // e.g. "ALPHA-2"
  name       String
  boundary   Unsupported("geometry(Polygon, 4326)")
  parentZoneId String?
  bop        Bop      @relation(fields: [bopId], references: [id])
  @@unique([bopId, code])
}

model Asset {
  id         String   @id @default(cuid())
  bopId      String
  zoneId     String?
  kind       String   // checkpoint / watchtower / road / fence / etc.
  location   Unsupported("geometry(Point, 4326)")
  metadata   Json
}
```

- `src/backend/services/gis-sync-service.ts` with a `GisSource` interface.
- Reference implementation reads a GeoPackage file; HTTP/PostGIS adapters deferred until a target is confirmed.
- `gis_sync_log` table records `started_at`, `finished_at`, `added`, `updated`, `removed`, `source_hash`.

### DevOps

- Cron job container `gis-sync` with a backoff policy.
- Alert on `gis_sync_failed_total`.

### RBAC

- Extend JWT claims with `scope: { bop_ids: [...], zone_ids: [...] }`.
- `requireScope(bopId | zoneId)` middleware.
- Scope inheritance: a BOP scope implies all its zones.

## Testing strategy

- Unit: geometry parsing, scope predicate.
- Integration: sync a GeoPackage fixture → DB round-trip → diff detection.
- Security: request a camera outside scope → 403.

## Security

- GIS source credentials encrypted (reuse TASK-002 AES-256 utility).
- Boundary polygons not logged at `info`.
- Drift detection alerts ADMIN on suspicious mass-deletes.

## Observability

- Prometheus: `gis_sync_duration_ms`, `gis_sync_failed_total`, `bop_count`, `zone_count`, `asset_count`.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GIS product schema change | High | Major | Adapter interface + versioned fixtures; fail fast with human-readable error |
| Accidental mass-delete from upstream | Low | Critical | Sync requires `--allow-deletes` flag or ADMIN approval when delta > 10% |

## Rollout

1. Ship data model + reference GeoPackage adapter.
2. Populate staging from a sanitised fixture.
3. Enable cron sync in production pointing at the real GIS source, read-only mode for 7 days.
4. Enable write path once diffs look clean.

## Definition of done

- [ ] Acceptance criteria checked
- [ ] Unit + integration tests green
- [ ] RBAC scope enforced across all existing routes (camera, auth, AOI when TASK-031 lands)
- [ ] QA agent sign-off
- [ ] `docs/changelog/<date>-task-041.md` entry added
