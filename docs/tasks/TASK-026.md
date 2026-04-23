# TASK-026 — Third-party integrations (webhooks, Slack/Teams/PagerDuty, MQTT, public API)

**Created:** 2026-04-22
**Phase:** 4 (Operator experience and integrations)
**Priority:** P1
**Status:** Proposed
**Complexity:** L
**Primary owner:** Backend Agent
**Collaborators:** Frontend Agent, DevOps Agent, QA Agent
**Depends on:** TASK-005, TASK-014, TASK-021
**Estimate:** 10 sprint days

---

## Summary

Customers want to route alerts into their existing systems (Slack, Teams, PagerDuty), publish to MQTT for home-automation setups, and embed live feeds in their own dashboards via a public API. This task delivers outbound webhooks, first-party chatops integrations, an MQTT bridge, and scoped public API tokens.

## Goals

- Outbound webhooks on events with HMAC signing + retry.
- First-class Slack, Teams, PagerDuty destinations (no webhook fiddling).
- MQTT bridge publishing detections and alerts.
- Public API with per-tenant tokens; scopes: `stream:read`, `alerts:read`, `alerts:write`.
- Rate limits: 60 req/min per token, burst 120.

## Non-goals

- Inbound ingest from third parties (future).
- Custom transformation pipelines on outbound events.

## User stories

- As a customer, I want critical alerts to page my on-call via PagerDuty.
- As a home user, I want alerts published to my Home Assistant over MQTT.
- As an integrator, I want a token to embed live feeds in my own dashboard.

## Acceptance criteria

- [ ] Webhooks retry with exponential backoff; give up after 24h; dead-letter to DLQ.
- [ ] HMAC-SHA256 signature header + timestamp; replay window 5 min.
- [ ] Slack/Teams/PagerDuty configured by OAuth (no manual webhook URL).
- [ ] MQTT bridge publishes on `surveillanceos/{tenant}/cameras/{cam}/detections`.
- [ ] Public API documented with OpenAPI; ships with Postman collection.
- [ ] All tokens scoped; server rejects out-of-scope calls with `403`.

## Technical design

### Backend (`src/backend/`)

- `integrationsService.ts` with adapter pattern: `SlackAdapter`, `TeamsAdapter`, `PagerDutyAdapter`, `GenericWebhookAdapter`.
- Delivery via BullMQ `outbound` queue; retry with jitter; DLQ for ops review.
- OAuth handlers for each chatops vendor; tokens stored encrypted.
- `publicApiRoutes.ts` mirrors read-only surfaces with token-scope check middleware.
- MQTT bridge: lightweight worker subscribing to internal channels, publishing to configured MQTT broker.

### Frontend (`src/frontend/`)

- Integrations page with connect buttons per vendor, status indicators, test-event button.
- Token management UI: create/rotate/delete tokens with scopes.

### Data model (Prisma)

```prisma
model Integration {
  id        String  @id @default(cuid())
  tenantId  String
  kind      IntegrationKind
  config    Json    // encrypted per-kind config
  enabled   Boolean @default(true)
}

model ApiToken {
  id        String   @id @default(cuid())
  tenantId  String
  label     String
  scopes    String[]
  hashed    String   @unique
  expiresAt DateTime?
  createdBy String
  createdAt DateTime @default(now())
}

enum IntegrationKind { GENERIC_WEBHOOK SLACK TEAMS PAGERDUTY MQTT }
```

## Testing strategy

- Unit: HMAC signer, retry with backoff, adapter payload shaping.
- Contract tests: mock Slack/Teams/PagerDuty APIs; assert payload shape per vendor.
- Integration: end-to-end through BullMQ + mock receiver; verify retries and DLQ.
- Public API: contract test suite + fuzzing.

## Security

- HMAC secrets rotated per integration.
- Token storage hashed with Argon2; last-4 shown in UI only.
- All third-party credentials encrypted at rest.
- Strict rate limiting on public API + per-tenant usage caps.

## Observability

- `outbound_webhook_delivered_total{kind,status}`, DLQ depth alert, `public_api_requests_total{token_id}`.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Noisy customer webhooks flood our egress | Medium | Major | Per-integration rate limit; circuit-break if 5xx > 50% for 5 min |
| Public API becomes DDoS vector | Medium | Major | Per-token + per-IP rate limits; CAPTCHA on anonymous surfaces |
| PagerDuty spam from rule misconfig | High | Major | Default cap of 10 pages/hour per tenant; admin-configurable |
| MQTT broker outage | Low | Minor | Buffer up to 10k messages; drop oldest first |

## Rollout

1. Generic webhooks + MQTT first (lowest regulatory surface).
2. Slack next (highest demand).
3. Teams + PagerDuty.
4. Public API launches in private beta with hand-picked integrators.

## Definition of done

- [ ] All acceptance criteria checked
- [ ] Public API docs published at `docs.surveillanceos.io` (or equivalent)
- [ ] Vendor OAuth apps created and reviewed
- [ ] `docs/changelog/<date>-task-026.md` entry added
