# TASK-037 — Thermal / LIDAR / Pan-image Ingestion Adapter

**Created:** 2026-04-24
**Phase:** 0 (Phase 0B)
**Priority:** P1
**Status:** Proposed
**Complexity:** L
**Primary owner:** Analytics Agent
**Collaborators:** Backend Agent, QA Agent
**Depends on:** TASK-032
**Source:** SIS.txt discussion, 2026-04-24 — *"We use thermal sensor, LIDAR, pan image. Based on the image, you can tell the image structure."*
**Estimate:** 8 sprint days

---

## Summary

Extend ingestion beyond seismic/acoustic to thermal imagers, LIDAR rangefinders, and pan-tilt camera imagery. These sensors are image-/point-cloud-based, so the pipeline is structurally different from TASK-035/036: frame-rate capture, per-frame inference, spatial overlays.

## Goals

- Three driver implementations behind a shared `ImageryDriver` interface.
- Per-modality detectors: thermal (hot-body detection + silhouette class), LIDAR (point-cloud clustering + range-gated motion), pan (PTZ slew + wide-context YOLO inference).
- Events published on `sensor:event:thermal|lidar|pan` with bounding-box / range-bin / point-cluster payloads.
- Storage: keyframes every 1 s retained 7 days; full streams retained per recording policy in TASK-015.

## Non-goals

- Edge inference on the sensor itself (Phase 3, TASK-020).
- HDR thermal calibration — out of scope for v1.

## Acceptance criteria

- [ ] Each driver reports frame cadence and inference latency to Prometheus.
- [ ] Thermal: detect human silhouette at 500 m with < 5 % false-negative on fixture video.
- [ ] LIDAR: report motion events within ±2 m range accuracy.
- [ ] Pan: reuse YOLOv8 service from TASK-006; extend to multi-class.
- [ ] All events include sensor_id, aoi_ids, occurred_at, confidence, type-specific payload.

## Technical design

### Analytics

- `src/analytics/detectors/imagery/{thermal,lidar,pan}/`.
- Thermal: ONNX model served via ONNX Runtime with CUDA/CPU fallback.
- LIDAR: Open3D for clustering; event emitted on cluster motion delta > 0.5 m.
- Pan: wraps TASK-006 YOLOv8 container, adds a slew-aware stitching buffer.

### Backend

- `SensorEventType.{THERMAL|LIDAR|PAN}`; payload column `Json` already accommodates variance.

### DevOps

- GPU worker pool (2 × T4 or equivalent) provisioned for thermal + pan inference.
- Kubernetes HPA tuned on queue depth, not CPU.

## Testing strategy

- Unit: inference on fixture frames / point clouds.
- Integration: replay a 10-minute fixture stream per modality, assert event count and latency.
- Performance: thermal inference < 100 ms per frame at 10 FPS.

## Security

- Thermal imagery treated as sensitive biometric-adjacent data.
- LIDAR point clouds anonymised — no per-person identifiers stored.
- Pan PTZ control path gated behind TASK-025 (Phase 4) where applicable.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GPU saturation at peak | High | Major | Queue depth autoscaling + frame-skip backpressure |
| Vendor SDK lock-in for LIDAR | Medium | Major | `ImageryDriver` interface; reference driver uses open protocol |

## Rollout

1. Thermal first (largest operator demand), then LIDAR, then pan.
2. Each modality behind its own feature flag.
3. Pilot BOP for 14 days per modality.

## Definition of done

- [ ] Acceptance criteria checked per modality
- [ ] Unit + integration + performance tests green
- [ ] QA agent sign-off per modality
- [ ] `docs/changelog/<date>-task-037.md` entry added per rollout step
