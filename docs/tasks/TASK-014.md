# TASK-014 — Smarter alerting: rules engine, lifecycle, escalation

**Created:** 2026-04-22
**Phase:** 1 (Harden the core)
**Priority:** P0
**Status:** Proposed
**Complexity:** L
**Primary owner:** Backend Agent
**Collaborators:** Frontend Agent, Analytics Agent, QA Agent
**Depends on:** TASK-008, TASK-013
**Estimate:** 8 sprint days

---

## Summary

Today alerts fire one-to-one on raw detections. This leads to alert floods (a swaying tree triggers 40 motion alerts per minute) and no way for a multi-operator team to coordinate who is handling what. This task introduces a composable rules engine, alert states (new → acknowledged → assigned → resolved), and per-user subscription preferences.

## Goals

- Rules engine supporting AND/OR composition across detectors, time-of-day windows, cooldown, and debounce.
- First-class alert lifecycle: `new | acknowledged | assigned | escalated | resolved | false_positive`.
- Per-user subscriptions: channel (push / email / SMS / Slack), severity threshold, quiet hours.
- Escalation ladder: if an alert is not acknowledged within N minutes, notify the next person on the ladder.

## Non-goals

- Machine-learned alert-deduplication (future work under Phase 2 anomaly scoring).
- SLA reporting (covered by TASK-023 audit log).

## User stories

- As an operator, I want to mute known false-positive cameras during a storm without silencing everything.
- As a supervisor, I want unacknowledged critical alerts to escalate to me after 3 minutes.
- As an admin, I want to author a rule like "person AND intrusion-zone AND 22:00–06:00 → critical".

## Acceptance criteria

- [ ] Rules are stored as JSON in the DB and evaluated in-process by the backend on every detection event from the Redis `detections` channel.
- [ ] A rule can reference up to 5 detectors and 3 time windows; evaluation latency ≤ 20ms p95.
- [ ] Alert state transitions emit audit log entries (wired to TASK-023 hooks, even if TASK-023 is not yet live).
- [ ] Escalation ladder is configurable per rule and supports up to 5 tiers.
- [ ] Frontend alert feed shows state, assignee, and elapsed time since `new`.
- [ ] Rule evaluation is idempotent — the same detection never produces two alerts within the debounce window.

## Technical design

### Backend (`src/backend/`)

- New service `src/backend/services/alertRuleEngine.ts`:
  - Subscribes to `channel:detections` (Redis pub/sub).
  - Loads rules on startup + watches `rule_updates` channel for hot reload.
  - Uses a DAG evaluator to short-circuit AND/OR chains.
- New routes under `/rules`: CRUD with Zod schemas; RBAC `admin` only.
- New routes under `/alerts/:id/state`: `POST` transitions with allowed-transition map.
- Escalation worker: BullMQ delayed job scheduled on alert creation; cancelled on acknowledgement.

### Frontend (`src/frontend/`)

- Rule builder UI (`/settings/rules`): visual node editor using React Flow.
- Alert feed: filters by state, assignee, severity; keyboard shortcuts `A` (ack), `R` (resolve), `F` (false positive).
- Subscription preferences page with quiet-hours time-range picker.

### Analytics (`src/analytics/`)

- Detections now publish a typed payload `{camera_id, detector, class, confidence, bbox, frame_ts, zone_ids[]}` to `channel:detections`. No behavior change to detectors themselves.

### Data model (Prisma)

```prisma
model AlertRule {
  id           String   @id @default(cuid())
  name         String
  enabled      Boolean  @default(true)
  severity     Severity
  definition   Json     // compiled AST
  cooldownSec  Int      @default(60)
  escalation   Json?    // ladder config
  createdBy    String
  updatedAt    DateTime @updatedAt
}

model Alert {
  id          String       @id @default(cuid())
  ruleId      String
  cameraId    String
  severity    Severity
  state       AlertState   @default(NEW)
  assignee    String?
  firstSeen   DateTime
  lastSeen    DateTime
  payload     Json
  transitions AlertTransition[]
}

model AlertTransition {
  id        String     @id @default(cuid())
  alertId   String
  from      AlertState
  to        AlertState
  actor     String
  reason    String?
  createdAt DateTime   @default(now())
}

enum Severity { INFO WARNING CRITICAL }
enum AlertState { NEW ACKNOWLEDGED ASSIGNED ESCALATED RESOLVED FALSE_POSITIVE }
```

### API contract (OpenAPI excerpt)

- `POST /rules` — admin only, body `AlertRuleCreate`
- `GET /rules?enabled=true`
- `POST /alerts/:id/state` — body `{to: AlertState, reason?: string}`
- `GET /alerts?state=new&severity=critical&assignee=me`

## Testing strategy

- Unit: rule AST compiler, debounce, time-window evaluator (timezone-aware with DST test cases).
- Integration: publish synthetic detections to Redis, assert alerts created and transitions recorded.
- E2E: operator workflow — receive alert → acknowledge → reassign → resolve.
- Load: 1000 detections/sec for 5 minutes, assert no alert drops and p95 latency ≤ 20ms.

## Security

- Rule creation restricted to `admin` role; viewer/operator cannot edit rules.
- Alert payload must not include raw frame data (only metadata).
- SMS escalation secrets loaded from Vault; never logged.

## Observability

- Prometheus: `alert_rule_eval_duration_ms`, `alerts_created_total{severity,rule_id}`, `alert_escalations_total`.
- Grafana dashboard: top 10 noisiest rules by alerts/hour.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Rule engine becomes single point of failure | Medium | Major | Run 2 replicas, leader-elected via Redis; detections are at-least-once |
| Rule misconfigured → alert flood | High | Major | Hard cap of 1000 alerts/minute/rule; auto-disable rule above threshold and page admin |
| Clock skew across analytics/backend causes window misfires | Low | Minor | Use event-time from frame_ts, not wall-clock |
| BullMQ backlog during storm | Medium | Minor | Separate queue for escalations; priority by severity |

## Rollout

1. Ship rules engine in "dry run" mode — evaluates rules and writes to a shadow table without emitting alerts.
2. Compare shadow output with existing alerts for 1 week.
3. Flip rule engine to authoritative; keep legacy path as fallback for 30 days.

## Definition of done

- [ ] All acceptance criteria checked
- [ ] Shadow-run comparison shows ≤ 2% divergence from legacy (and divergence is explainable)
- [ ] QA agent green on unit + integration + E2E
- [ ] Load test meets latency budget
- [ ] `docs/changelog/<date>-task-014.md` entry added
