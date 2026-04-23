# TASK-015 — Recording lifecycle management

**Created:** 2026-04-22
**Phase:** 1 (Harden the core)
**Priority:** P0
**Status:** Proposed
**Complexity:** L
**Primary owner:** Backend Agent
**Collaborators:** DevOps Agent, Frontend Agent, QA Agent
**Depends on:** TASK-012
**Estimate:** 10 sprint days

---

## Summary

Right now all recordings are written to the SSD attached to the recording host and stay there forever. Storage fills in weeks, and there's no workflow for exporting a clip as legal evidence. This task introduces tiered retention (hot → warm → cold), a bookmark + clip export flow with signed URLs, and a chain-of-custody log for exported evidence.

## Goals

- Hot tier: SSD, 7 days, served via HLS for instant scrub.
- Warm tier: S3-compatible object storage, 30 days, fetched on demand.
- Cold / archive: Glacier-class storage, up to 365 days, retrieval via async job.
- Bookmark + clip export: operator marks a clip window, system produces a signed-URL MP4 with SHA-256 hash + export log.
- Chain-of-custody entries for every export (who, when, why, hash).

## Non-goals

- Automated legal redaction (face blur in exports is covered by TASK-018).
- Customer-managed encryption keys (follow-up in Phase 3 compliance work).

## User stories

- As an operator, I want to mark a 30-second window around an incident and download it as MP4.
- As a supervisor, I want to enforce that any evidence exported by the team has a tamper-evident hash.
- As an admin, I want to configure retention per camera (some cameras 7 days, others 90 days).

## Acceptance criteria

- [ ] Each camera has a `RetentionPolicy` — hot days, warm days, cold days.
- [ ] BullMQ `lifecycle` worker tiers segments daily at 03:00 local per site; failures retried with exponential backoff.
- [ ] Clip export produces an MP4 that plays in QuickTime and VLC; file hash is recorded.
- [ ] Signed URL for export is valid for ≤ 15 minutes, single-use.
- [ ] Cold retrieval returns a job id; the operator is notified when ready (typically ≤ 12h).
- [ ] Export action is blocked for users without `operator` or higher role on the source camera.

## Technical design

### Backend (`src/backend/`)

- `services/recordingLifecycle.ts`: daily job, discovers segments older than hot-TTL, uploads to S3 (multipart for files > 100 MB), updates `Segment.tier` + `Segment.location`.
- `services/clipExport.ts`: takes `{cameraId, startTs, endTs}`, stitches HLS segments with FFmpeg `-c copy` (no re-encode), writes MP4, computes SHA-256, stores export record, returns signed URL.
- `services/coldRestore.ts`: issues S3 `RestoreObject`, polls status, updates `ExportJob.state`.
- New routes:
  - `POST /recordings/exports` — start export
  - `GET /recordings/exports/:id` — poll state + signed URL when ready
  - `GET /recordings/exports` — list (scoped to viewer's cameras)

### Frontend (`src/frontend/`)

- Recording browser: add a scrub-selector overlay; on "Export clip" button open a modal to enter reason/case-id.
- New "Exports" page: list with state column, copy-signed-URL button (disabled after expiry), hash column.

### Data model (Prisma)

```prisma
model Segment {
  id        String   @id
  cameraId  String
  startTs   DateTime
  endTs     DateTime
  tier      Tier     @default(HOT)
  location  String   // local path or s3://bucket/key
  sizeBytes BigInt
}

model RetentionPolicy {
  id          String @id @default(cuid())
  cameraId    String @unique
  hotDays     Int    @default(7)
  warmDays    Int    @default(30)
  coldDays    Int    @default(365)
}

model ExportJob {
  id          String      @id @default(cuid())
  cameraId    String
  startTs     DateTime
  endTs       DateTime
  requestedBy String
  reason      String
  caseId      String?
  state       ExportState @default(PENDING)
  sha256      String?
  signedUrl   String?
  urlExpires  DateTime?
  createdAt   DateTime    @default(now())
}

enum Tier { HOT WARM COLD }
enum ExportState { PENDING RUNNING READY EXPIRED FAILED }
```

### Infra / DevOps

- Provision an S3 bucket per environment with lifecycle policy → Glacier Deep Archive at 30 days.
- IAM role for the recording host: `PutObject`, `GetObject`, `RestoreObject`; no `DeleteObject` (immutability).
- Grafana panel: tiered storage usage GB and cost estimate.

## Testing strategy

- Unit: tier transition logic, signed URL TTL, hash computation.
- Integration: MinIO in docker-compose stands in for S3; verify multipart upload + restore.
- E2E: operator exports a clip, verifies MP4 plays and hash matches.
- Chaos: kill the lifecycle worker mid-run; assert on restart it resumes idempotently.

## Security

- Signed URLs expire in ≤ 15 minutes, single-use, bound to requester IP.
- Export reason required; stored in audit log (TASK-023 hook).
- Cold storage objects encrypted with SSE-KMS.

## Observability

- Prometheus: `recording_tier_bytes{tier}`, `export_jobs_total{state}`, `cold_restore_duration_seconds`.
- Alerting rule: export failures > 5% triggers a PagerDuty incident.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| S3 outage blocks recording | Medium | Major | Local spool buffer for 72h; replay on recovery |
| Cold restore exceeds 12h SLA | Medium | Minor | Document SLA to operators; surface ETA in UI |
| Export MP4 won't play on non-H.264 cameras | Low | Minor | Detect codec on export; re-encode if not H.264 |
| Multipart upload abandoned → orphaned S3 parts | High | Minor | S3 lifecycle rule: abort incomplete multipart after 1 day |

## Rollout

1. Deploy lifecycle worker in read-only mode for 1 week — reports what it would move without moving.
2. Enable tiering for one pilot site; verify playback of warm-tier clips.
3. Roll out to all sites, one per day.

## Definition of done

- [ ] All acceptance criteria checked
- [ ] 1-week read-only run reviewed and approved
- [ ] QA agent green on unit/integration/E2E/chaos
- [ ] Runbook `docs/runbooks/recording-lifecycle.md` written
- [ ] `docs/changelog/<date>-task-015.md` entry added
