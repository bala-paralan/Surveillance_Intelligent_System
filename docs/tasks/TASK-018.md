# TASK-018 — Face blur & configurable privacy masks

**Created:** 2026-04-22
**Phase:** 2 (Advanced analytics)
**Priority:** P1
**Status:** Proposed
**Complexity:** M
**Primary owner:** Analytics Agent
**Collaborators:** Frontend Agent, Backend Agent, QA Agent
**Depends on:** TASK-006, TASK-015, TASK-016
**Estimate:** 6 sprint days

---

## Summary

To comply with GDPR/CCPA and customer-specific privacy requirements, we need (a) automatic face blurring on exported clips and (b) static privacy-mask polygons per camera that are baked in at encode time so no viewer (including admins) can see behind them.

## Goals

- Face detection pass that runs on-demand for exports (not on live view).
- Static privacy masks per camera, applied to both live view and recordings.
- Admin override: a "compliance officer" role can toggle face-blur default per site.
- Auditable: every export records whether blur was applied.

## Non-goals

- Voice / audio redaction.
- Selective "blur everyone except" workflows (future).

## User stories

- As a compliance officer, I want all exports to have faces blurred by default.
- As a site manager, I want to permanently black out the neighboring apartment window on camera-7.
- As an auditor, I want to verify that an exported clip had its faces blurred.

## Acceptance criteria

- [ ] Privacy masks rendered server-side before encode; viewers never receive unmasked frames.
- [ ] Clip export pipeline (TASK-015) accepts `blur_faces: true|false` with policy-controlled default.
- [ ] Face detection runs during export, not live — adds ≤ 10s per minute of clip.
- [ ] Export manifest includes `privacy = {mask_applied, face_blur_applied, policy_version}`.
- [ ] Visual mask editor mirrors TASK-016 zone editor UX.

## Technical design

### Analytics (`src/analytics/`)

- `detectors/face_blur.py`: uses a small face detector (e.g., `yolov8n-face`), applies Gaussian blur with sigma ≥ 15 px on bbox + 20% padding.
- Exposed as a function callable from the backend's export pipeline (FastAPI endpoint `/face_blur`).

### Backend (`src/backend/`)

- Export pipeline: after stitching but before signing the URL, call face-blur service if policy requires.
- Privacy masks: FFmpeg `drawbox` filter with `color=black@1.0` applied in the transcode stage for both HLS and exports.
- Policy: per-site `privacyPolicy.faceBlurDefault` (enum: `always | on_export | never`).

### Frontend (`src/frontend/`)

- Mask editor in camera settings (same component family as TASK-016 zones).
- Export modal: shows default blur state, allows override only for `compliance_officer` role.

### Data model (Prisma)

```prisma
model PrivacyMask {
  id          String @id @default(cuid())
  cameraId    String
  coordinates Json
  frameW      Int
  frameH      Int
}

model SitePrivacyPolicy {
  id               String         @id @default(cuid())
  siteId           String         @unique
  faceBlurDefault  FaceBlurPolicy @default(ON_EXPORT)
  policyVersion    Int            @default(1)
  updatedAt        DateTime       @updatedAt
}

enum FaceBlurPolicy { ALWAYS ON_EXPORT NEVER }
```

## Testing strategy

- Unit: mask coordinate scaling across resolutions, face detector on a 20-image golden set (assert all faces covered by blur bbox).
- Integration: export a clip with known faces, verify output frames have blur via face re-detection (should find 0).
- Visual regression: before/after screenshots on live view with mask applied.

## Security

- Masks are part of the encode pipeline — a bypass requires infra-level access.
- Export records include `policy_version` so tampering is detectable.
- Face detection results are not persisted (only used transiently for blur).

## Observability

- `face_blur_exports_total{applied}`, `privacy_mask_applied_total{camera}`, blur pipeline latency histogram.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Face detector misses profile/occluded faces | High | Major | Use two-model ensemble; if any miss, operator can redact manually pre-export |
| Mask drift after camera PTZ | Medium | Major | Disable PTZ on cameras with masks, or invalidate mask on movement |
| Performance regression on live HLS due to drawbox | Low | Minor | Benchmark FFmpeg with filter; fall back to CPU overlay if GPU filter unsupported |

## Rollout

1. Mask editor ships first (low-risk, no model).
2. Export-time face blur ships behind `feature.face_blur_export` flag.
3. Enable policy default `ON_EXPORT` for customers who opt in.

## Definition of done

- [ ] All acceptance criteria checked
- [ ] Golden-set face-coverage ≥ 98%
- [ ] Compliance review sign-off recorded
- [ ] `docs/changelog/<date>-task-018.md` entry added
