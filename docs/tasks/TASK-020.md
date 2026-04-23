# TASK-020 — Edge inference agent (Jetson / Coral)

**Created:** 2026-04-22
**Phase:** 3 (Scale and operations)
**Priority:** P1
**Status:** Proposed
**Complexity:** XL
**Primary owner:** Analytics Agent
**Collaborators:** DevOps Agent, Backend Agent, QA Agent
**Depends on:** TASK-006, TASK-011
**Estimate:** 15 sprint days

---

## Summary

Ship a small edge agent (container + binary) that runs YOLOv8n on a Jetson Orin Nano or Coral TPU at the camera site. Only metadata and clips flow to the cloud; raw frames stay on the LAN. This drops uplink bandwidth by 90%+ and enables deployments at sites with poor connectivity.

## Goals

- Edge agent: connects to cameras via RTSP, runs inference, publishes detections to the cloud over MQTT/WSS.
- Device registration + remote config flow.
- Model rollout with staged canary and auto-rollback on crash.
- Fallback: if cloud unreachable, buffer detections locally and backfill (foreshadows TASK-030).

## Non-goals

- Edge-side recording storage (TASK-030).
- Fully offline operation without ever phoning home.

## User stories

- As a customer with 40Mbps uplink, I want 20 cameras without saturating my link.
- As an ops engineer, I want to push a new YOLO weight file to 100 edge devices with one command.
- As an installer, I want a simple pairing flow to register a new edge device.

## Acceptance criteria

- [ ] Agent runs on Jetson Orin Nano 8GB and a Raspberry Pi 5 + Coral TPU; single container image per arch.
- [ ] Upstream bandwidth per camera ≤ 50 Kbps average at 5 FPS inference.
- [ ] Registration flow: scan QR code → enter pairing token → agent appears in admin UI.
- [ ] Model rollout: stage → 10% canary → 50% → 100%; auto-rollback if crash rate > 2%.
- [ ] When cloud unreachable, agent buffers up to 6h of detections locally and replays in order.

## Technical design

### Analytics (`src/analytics/edge/`)

- `agent/main.py`: orchestrates RTSP pull, inference, MQTT publish.
- `agent/inference.py`: TensorRT (Jetson) or EdgeTPU (Coral) backends behind a common interface.
- `agent/registration.py`: mTLS pairing with short-lived token → obtains device cert.
- `agent/updater.py`: polls for model/version updates; verifies SHA-256 before swap.

### Backend (`src/backend/`)

- New service `edgeRegistry.ts`: device CRUD, pairing tokens, model rollouts.
- MQTT broker (mosquitto) or AWS IoT Core; detections published to `tenants/{t}/edges/{e}/detections`.
- Routes:
  - `POST /edges/pair` → returns short-lived pairing token.
  - `POST /edges/rollouts` → define a rollout.
  - `GET /edges/:id/health` → live status + last-seen.

### Frontend (`src/frontend/`)

- Admin "Edge devices" page: online/offline status, firmware version, model version, CPU/mem, rollout controls.

### Data model (Prisma)

```prisma
model EdgeDevice {
  id             String   @id @default(cuid())
  siteId         String
  arch           EdgeArch
  firmware       String
  modelVersion   String
  lastSeenAt     DateTime?
  state          EdgeState @default(REGISTERED)
}

model ModelRollout {
  id           String   @id @default(cuid())
  modelVersion String
  stages       Json     // [{percent, startedAt, doneAt?}]
  crashCount   Int      @default(0)
  state        RolloutState
}

enum EdgeArch { JETSON_ORIN CORAL_M2 RPI5_CORAL }
enum EdgeState { REGISTERED ONLINE OFFLINE DEGRADED }
enum RolloutState { DRAFT CANARY ROLLING COMPLETED ROLLED_BACK }
```

### Infra / DevOps

- CI builds multi-arch images: `edge-agent:{version}-jetson`, `-coral`, `-rpi`.
- OTA update via MQTT trigger + authenticated download from object storage.
- Fleet-wide Grafana dashboard: online %, avg FPS, crash count by version.

## Testing strategy

- Unit: inference backend interfaces, buffer replay ordering.
- Hardware-in-the-loop: CI job on a real Jetson + Coral in the lab; pytest drives inference on test video.
- Chaos: kill MQTT broker mid-stream; verify local buffer and resume.

## Security

- mTLS end-to-end for all edge → cloud traffic.
- Device certs rotate every 30 days; rotation failure → device marked DEGRADED.
- Model artifacts signed; agent verifies signature before load.

## Observability

- Edge-side Prometheus exporter proxied via cloud: `edge_fps`, `edge_inference_latency_ms`, `edge_buffer_bytes`.
- Alerting: device offline > 15 min → PagerDuty.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Thermal throttling at customer sites | High | Major | Monitor CPU temp; throttle inference to 2 FPS if > 80°C |
| Model update bricks device | Medium | Major | Staged rollout with crash auto-rollback + factory-reset button |
| NAT / firewall blocks MQTT | Medium | Major | Support WSS over 443 as fallback |
| Jetson CUDA version drift across units | High | Minor | Pin CUDA; ship self-contained userspace in container |

## Rollout

1. Lab validation for 2 weeks.
2. Paid pilot at 3 friendly customers.
3. GA with documented hardware BOM.

## Definition of done

- [ ] All acceptance criteria checked
- [ ] Hardware-in-the-loop suite in CI
- [ ] Installation runbook `docs/runbooks/edge-install.md` written
- [ ] `docs/changelog/<date>-task-020.md` entry added
