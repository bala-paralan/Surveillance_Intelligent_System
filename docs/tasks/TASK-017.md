# TASK-017 — License plate recognition (LPR) with watchlist

**Created:** 2026-04-22
**Phase:** 2 (Advanced analytics)
**Priority:** P1
**Status:** Proposed
**Complexity:** L
**Primary owner:** Analytics Agent
**Collaborators:** Backend Agent, Frontend Agent, QA Agent
**Depends on:** TASK-006, TASK-014
**Estimate:** 10 sprint days

---

## Summary

Add automatic license plate recognition (ALPR) to cameras designated as LPR-capable (covering driveways, gates, parking lots). Detected plates are logged and matched against a configurable watchlist; hits on the watchlist generate alerts through the TASK-014 rules engine.

## Goals

- LPR detector running on per-camera opt-in basis.
- Plate history database with camera, timestamp, cropped image, and confidence.
- Watchlist with categories (`banned`, `vip`, `investigation`) and hit alerts.
- Search UI: "show all sightings of plate ABC-123 in the last 30 days".

## Non-goals

- Cross-jurisdictional plate format validation (best-effort regex per region).
- Integration with DMV / law-enforcement databases.

## User stories

- As a facilities manager, I want to know when a banned vehicle enters our property.
- As a fleet owner, I want a log of when each truck (by plate) entered and exited the yard.
- As a security analyst, I want to search for a plate across 90 days of history.

## Acceptance criteria

- [ ] LPR detector selectable per camera in settings.
- [ ] Plate reads above `confidence >= 0.80` recorded; below threshold dropped.
- [ ] Watchlist supports CSV import/export (max 100k entries).
- [ ] Hit on watchlist produces a `CRITICAL` (banned) or `INFO` (vip) alert via rules engine.
- [ ] Search by plate returns ≤ 100 results in ≤ 500ms on 10M-row plate table (indexed).
- [ ] Plate image thumbnails stored in object storage with TTL matching recording retention.

## Technical design

### Analytics (`src/analytics/`)

- `detectors/lpr.py`: wraps a small OCR model (e.g., `fast-alpr`) + vehicle-bbox filter.
- Runs as a secondary inference pass only when `vehicle` detected and camera has LPR enabled, to save GPU.
- Publishes `{camera_id, plate, confidence, bbox, frame_ts, crop_url}` to `channel:plates`.

### Backend (`src/backend/`)

- `PlateService`: subscribes to `channel:plates`, writes to DB, checks watchlist, emits detection event to TASK-014.
- `POST /plates/watchlist` — CSV upload (multipart); streams parse, bulk insert with `ON CONFLICT` upsert.
- `GET /plates/search?plate=ABC-123&from=&to=` — Postgres full-text + trigram index.
- `GET /plates/:id` — returns signed crop URL.

### Frontend (`src/frontend/`)

- Watchlist page: import/export, category chips, per-entry notes.
- Plate search page with timeline visualization.
- Camera settings: enable LPR toggle + region hint (EU / US / AU plate format).

### Data model (Prisma)

```prisma
model Plate {
  id         String   @id @default(cuid())
  cameraId   String
  plate      String
  confidence Float
  bbox       Json
  cropUrl    String
  seenAt     DateTime
  @@index([plate])
  @@index([cameraId, seenAt])
}

model WatchlistEntry {
  id        String   @id @default(cuid())
  plate     String   @unique
  category  WatchlistCategory
  notes     String?
  addedBy   String
  addedAt   DateTime @default(now())
}

enum WatchlistCategory { BANNED VIP INVESTIGATION }
```

### Indexing

- `GIN (plate gin_trgm_ops)` for partial-match search.
- `BRIN (seen_at)` for time-range filters.

## Testing strategy

- Unit: plate-format regex per region, watchlist match (fuzzy vs exact).
- Golden set: 200 labeled plates in `src/analytics/tests/lpr_golden/`; CI gate `>=0.92 accuracy`.
- Integration: publish synthetic plate events, assert watchlist hits create alerts.
- Load: bulk-insert 100k watchlist entries in ≤ 10s.

## Security

- Plate data is PII in some jurisdictions — storage respects site-level retention policy.
- Watchlist edits restricted to `admin`; audit-logged via TASK-023.
- Crop URLs are signed; raw object storage bucket is private.

## Observability

- `lpr_reads_total{camera}`, `lpr_confidence_histogram`, `watchlist_hits_total{category}`.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| OCR misreads I vs 1, O vs 0 | High | Minor | Fuzzy match with Hamming distance ≤ 1 on watchlist hit |
| GPU saturated running LPR + YOLO | Medium | Major | LPR only runs on vehicle bboxes; batch every 200ms |
| Privacy complaints from bystanders | Medium | Major | Site-level opt-in; retention defaults to 30 days |
| Watchlist CSV upload bogs DB | Low | Minor | Stream parse + bulk insert with COPY |

## Rollout

1. Internal parking lot pilot for 2 weeks.
2. Tune confidence threshold from ROC curve.
3. GA for customers with explicit opt-in checkbox + regional privacy notice.

## Definition of done

- [ ] All acceptance criteria checked
- [ ] Golden-set accuracy gate passing in CI
- [ ] Privacy notice reviewed and stored in `docs/compliance/lpr-notice.md`
- [ ] `docs/changelog/<date>-task-017.md` entry added
