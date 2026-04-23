# TASK-023 — Audit log & compliance reporting

**Created:** 2026-04-22
**Phase:** 3 (Scale and operations)
**Priority:** P1
**Status:** Proposed
**Complexity:** M
**Primary owner:** Backend Agent
**Collaborators:** Frontend Agent, DevOps Agent, QA Agent
**Depends on:** TASK-005, TASK-015, TASK-021
**Estimate:** 6 sprint days

---

## Summary

Enterprise buyers require an immutable log of every sensitive action: viewer opened stream, operator exported clip, admin changed retention policy, compliance officer toggled face blur. This task delivers that audit log and a signed-PDF export for auditors.

## Goals

- Append-only audit log with hash-chained entries.
- Rich query UI (filter by actor, resource, action, time).
- Exportable compliance report as signed PDF.
- Retention distinct from recordings (default 7 years).

## Non-goals

- SIEM export to third-party (covered later by TASK-026 webhooks).
- Real-time suspicious-activity detection.

## User stories

- As a compliance officer, I want to see every action on camera-12 in the last 90 days.
- As an auditor, I want a signed PDF report that's tamper-evident.
- As an admin, I want to know who changed retention policy and when.

## Acceptance criteria

- [ ] Every mutating API route emits an audit entry via middleware.
- [ ] Entries include `actor`, `action`, `resource_kind`, `resource_id`, `before`, `after`, `context`, `timestamp`, `prev_hash`, `hash`.
- [ ] Hash chain verifiable: CLI `audit:verify` recomputes chain and confirms integrity.
- [ ] PDF export signed with site-level private key; verifiable with public key.
- [ ] Audit log cannot be deleted or modified through any API.

## Technical design

### Backend (`src/backend/`)

- Fastify plugin `auditLog.ts` intercepts mutating routes, emits entry on success.
- Writes to Postgres partitioned by month; append-only enforced by DB role lacking `UPDATE`/`DELETE`.
- Hash chain: `hash = sha256(prev_hash || canonical_json(entry))`; new row includes both.
- PDF generator via `pdfkit`; signed with RSA key stored in KMS.

### Frontend (`src/frontend/`)

- Compliance page with filter bar (actor, action, time-range, resource).
- Export-to-PDF button; progress bar for long reports.

### Data model (Prisma)

```prisma
model AuditEntry {
  id           BigInt   @id @default(autoincrement())
  ts           DateTime @default(now())
  tenantId     String
  actor        String
  actorRole    Role
  action       String
  resourceKind String
  resourceId   String
  before       Json?
  after        Json?
  context      Json?
  prevHash     String
  hash         String
  @@index([tenantId, ts])
  @@index([resourceKind, resourceId, ts])
}
```

### Infra / DevOps

- Separate DB role `audit_writer` with INSERT only on `audit_entry`.
- Daily backup to object storage with object-lock in compliance mode.

## Testing strategy

- Unit: hash chain builder, canonical JSON serialization (stable key order).
- Integration: perform 500 actions, run `audit:verify`, assert chain intact.
- E2E: filter UI returns expected entries.
- Tamper test: manually modify a row (via admin DB access) — `audit:verify` reports the index where the chain breaks.

## Security

- DB writer role cannot update/delete.
- PDF signing key in KMS; only accessed by signing service.
- Audit reads are themselves audit-logged (meta-audit), but at low verbosity.

## Observability

- `audit_entries_written_total{action}`, `audit_verify_failures_total`.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Audit write in request path becomes latency bottleneck | Medium | Major | Async enqueue to local queue with durable WAL; verify chain integrity on flush |
| Hash chain drift on concurrent writes | High | Major | Single writer per tenant partition; serialize via Redis lock |
| PDF sign key compromise | Low | Major | Short-lived key per report; rotation quarterly |

## Rollout

1. Enable write path on all mutating routes (read-only first in staging).
2. Run chain-verify job nightly for 2 weeks.
3. Ship PDF export and compliance UI.

## Definition of done

- [ ] All acceptance criteria checked
- [ ] `audit:verify` in CI against staging DB
- [ ] Signing key rotation runbook in place
- [ ] `docs/changelog/<date>-task-023.md` entry added
