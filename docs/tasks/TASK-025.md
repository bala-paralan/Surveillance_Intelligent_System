# TASK-025 — Two-way audio & PTZ control

**Created:** 2026-04-22
**Phase:** 4 (Operator experience and integrations)
**Priority:** P2
**Status:** Proposed
**Complexity:** M
**Primary owner:** Backend Agent
**Collaborators:** Frontend Agent, QA Agent
**Depends on:** TASK-004, TASK-005
**Estimate:** 6 sprint days

---

## Summary

Many supported cameras expose ONVIF endpoints for PTZ movement and two-way audio. This task wires those endpoints through the backend and adds an operator UI overlay so that an operator can pan/tilt/zoom a camera, save presets, and talk through the camera's speaker.

## Goals

- PTZ overlay on live view: direction pad, zoom, presets.
- Two-way audio: push-to-talk button, operator mic via WebRTC.
- Saved PTZ presets per camera (up to 16).
- ONVIF capability probe so unsupported cameras hide the controls.

## Non-goals

- Multi-operator simultaneous talk (first-talker-wins).
- Broadcast to multiple cameras at once.

## User stories

- As an operator, I want to pan a camera during an incident to follow a subject.
- As a site manager, I want to define "front gate" and "parking" presets.
- As a receptionist, I want to greet visitors through the door camera speaker.

## Acceptance criteria

- [ ] Backend probes ONVIF on camera add; stores capability flags.
- [ ] PTZ commands delivered with ≤ 200ms latency p95 on LAN.
- [ ] Presets save current position; recall seeks within 2s.
- [ ] Push-to-talk routes operator mic audio to camera speaker via WebRTC + ONVIF backchannel.
- [ ] Only one operator can hold talk at a time; UI shows lock state.

## Technical design

### Backend (`src/backend/`)

- `ptzService.ts`: wraps `node-onvif`; exposes `move`, `stop`, `goToPreset`, `savePreset`.
- WebRTC signaling: new route `/cameras/:id/audio/offer` using `wrtc` or `mediasoup`.
- Per-camera talk lock stored in Redis with 30s TTL; auto-released on socket close.

### Frontend (`src/frontend/`)

- `PtzOverlay` component with direction pad, zoom slider, preset chips.
- `TalkButton` with hold-to-talk; captures mic via `getUserMedia`, encodes OPUS, sends via WebRTC.

### Data model (Prisma)

```prisma
model CameraCapabilities {
  cameraId    String  @id
  hasPtz      Boolean @default(false)
  hasAudioIn  Boolean @default(false)
  hasAudioOut Boolean @default(false)
}

model PtzPreset {
  id         String   @id @default(cuid())
  cameraId   String
  name       String
  position   Json     // {pan,tilt,zoom}
  createdBy  String
  createdAt  DateTime @default(now())
}
```

## Testing strategy

- Unit: ONVIF command serialization, talk-lock state machine.
- Integration: simulated ONVIF server (e.g., `onvif-simulator`) + camera-emulator for audio.
- E2E: PTZ move + preset recall + PTT round trip.

## Security

- Only `operator` and above may PTZ or talk.
- Talk sessions audit-logged (TASK-023).
- Mic permission requires user gesture; no auto-capture.

## Observability

- `ptz_commands_total{camera}`, `ptz_latency_ms`, `talk_sessions_total`, `talk_concurrency`.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ONVIF dialect differences across vendors | High | Major | Per-vendor adapter layer; integration tests against real hardware samples |
| WebRTC TURN required across some NATs | Medium | Major | Operate a coturn server; fall back to relay |
| Mic permission UX confusion | Medium | Minor | Inline explainer; remember-choice per camera |

## Rollout

1. PTZ ships first (no media stack work).
2. Two-way audio behind a feature flag, enabled per customer.

## Definition of done

- [ ] All acceptance criteria checked
- [ ] Integration tests against 3 vendor emulators green
- [ ] `docs/changelog/<date>-task-025.md` entry added
