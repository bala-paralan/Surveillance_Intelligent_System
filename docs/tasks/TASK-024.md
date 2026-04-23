# TASK-024 — Mobile app (React Native)

**Created:** 2026-04-22
**Phase:** 4 (Operator experience and integrations)
**Priority:** P1
**Status:** Proposed
**Complexity:** XL
**Primary owner:** Frontend Agent
**Collaborators:** Backend Agent, DevOps Agent, QA Agent
**Depends on:** TASK-004, TASK-005, TASK-014, TASK-021
**Estimate:** 20 sprint days

---

## Summary

Operators need eyes on cameras and the ability to acknowledge alerts away from a desk. This task delivers a React Native app (iOS + Android) covering live view, push alerts, clip sharing, and basic alert lifecycle actions. The app reuses the existing typed API client and authentication.

## Goals

- Live view for up to 4 cameras in a 2×2 grid; pinch to zoom / tap to go fullscreen.
- Push notifications for alerts via APNs / FCM.
- Alert acknowledge / resolve from notification action.
- Clip share sheet: download + share MP4.
- Biometric unlock (Face ID / Touch ID / fingerprint).

## Non-goals

- Offline recording access (keep online-only for v1).
- Native PTZ control (web desktop for v1; mobile in v2).

## User stories

- As an operator on call, I want to see the live feed when I receive a push alert.
- As a supervisor, I want to acknowledge alerts from the notification without opening the app.
- As a field tech, I want to share a short clip with a colleague via Messages.

## Acceptance criteria

- [ ] Single codebase builds on iOS 16+ and Android 11+.
- [ ] Live view achieves ≥ 15 FPS at 720p over 4G for each of 4 tiles.
- [ ] Push delivery p95 ≤ 10s from alert creation.
- [ ] Biometric unlock gates every app open and every resume after 5 min background.
- [ ] App passes App Store and Play Store review (privacy labels, data declarations).

## Technical design

### Frontend (React Native)

- Expo-managed workflow where possible; eject if native PTZ module needed.
- HLS playback via `react-native-video` (iOS native AVPlayer; Android ExoPlayer).
- State reuses Zustand stores via extracted shared package.
- Auth: secure-store for refresh token; biometrics via `expo-local-authentication`.
- Push: `expo-notifications` → FCM/APNs via backend push service.

### Backend (`src/backend/`)

- New push service: maintains `DeviceToken` per user, dispatches on alert creation.
- Push payload is minimal (alert id + severity); client fetches details via REST to avoid leaking data in the notification payload.

### Data model (Prisma)

```prisma
model DeviceToken {
  id        String   @id @default(cuid())
  userId    String
  platform  Platform
  token     String   @unique
  lastSeen  DateTime @updatedAt
}

enum Platform { IOS ANDROID }
```

### Infra / DevOps

- Separate CI pipeline for mobile: build → lint → unit test → EAS build for TestFlight / Play Beta.
- Crash reporting via Sentry.
- App config / feature flags via over-the-air remote config (e.g., `expo-updates`).

## Testing strategy

- Unit: shared stores, utilities.
- Component: React Native Testing Library.
- E2E: Detox on iOS simulator + Android emulator, tests login → grid → ack alert.
- Real-device sanity: 3 iPhone + 3 Android models before each release.

## Security

- Tokens stored only in iOS Keychain / Android Keystore.
- Biometric required before any sensitive action.
- Certificate pinning on API endpoints.
- No raw frame / PII stored on device beyond in-memory playback buffer.

## Observability

- `push_delivered_total`, `push_failed_total{platform,reason}`, crash-free session rate.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| HLS stuttering on cellular | High | Major | Aggressive ABR (TASK-013), fall back to snapshot mode |
| App store rejection on privacy labels | Medium | Major | Fill out data declarations early; request pre-submission review |
| Push delivery degrades silently | Medium | Major | Per-device last-delivery timestamp; alert if > 24h stale |
| Expo ejection cost | Medium | Minor | Plan for ejection early if native needs emerge |

## Rollout

1. Internal beta via TestFlight + Play Internal Testing for 4 weeks.
2. Closed beta with 3 pilot customers.
3. Public launch with in-app rating prompt disabled until v1.1.

## Definition of done

- [ ] All acceptance criteria checked
- [ ] Detox suite green in CI
- [ ] App Store + Play Store approvals received
- [ ] `docs/changelog/<date>-task-024.md` entry added
