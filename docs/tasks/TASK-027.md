# TASK-027 — AI-generated incident summaries

**Created:** 2026-04-22
**Phase:** 4 (Operator experience and integrations)
**Priority:** P2
**Status:** Proposed
**Complexity:** M
**Primary owner:** Analytics Agent
**Collaborators:** Backend Agent, Frontend Agent, QA Agent
**Depends on:** TASK-014, TASK-015, TASK-016
**Estimate:** 6 sprint days

---

## Summary

When an alert cluster resolves (series of detections from the same rule within a time window), generate a short human-readable summary using a vision-language model: "At 02:14 a person in a dark hoodie entered the rear parking zone and left eastward at 02:17." The summary is attached to the incident record for review and export.

## Goals

- Incident grouping: alerts on same rule+camera within cooldown window become one incident.
- Sample 5–10 key frames per incident (entry, peak activity, exit).
- VLM call returns a one-paragraph summary plus structured tags (subjects, directions, durations).
- Summary editable by operator; edits audit-logged.

## Non-goals

- Real-time narration of live streams.
- Identification of named individuals.

## User stories

- As an operator reviewing overnight alerts, I want a 2-line summary per incident so I can scan quickly.
- As a compliance officer, I want summaries attached to exported clips.
- As a manager, I want weekly reports with top incidents and their summaries.

## Acceptance criteria

- [ ] Incidents created server-side by grouping alerts.
- [ ] VLM summary delivered within 30s of incident resolution.
- [ ] Summary + tags stored with incident; hash of the set of frames recorded.
- [ ] Operator can edit; previous version preserved.
- [ ] Cost guardrail: max VLM calls per tenant per day configurable (default 500).

## Technical design

### Analytics (`src/analytics/`)

- `summarizer.py`: selects key frames (first, peak detection count, last), calls VLM (pluggable — Claude / Gemini / local VLM) with structured prompt.
- Returns `{summary, subjects[], directions[], confidence}`; writes to `channel:summaries`.

### Backend (`src/backend/`)

- `incidentService.ts`: consumes `channel:alerts`, groups by rule+camera+window, emits `incident.resolved` event.
- Subscribes to `channel:summaries`, attaches to incident.
- Budget guard before VLM call.

### Frontend (`src/frontend/`)

- Incident detail page: clip preview, alert timeline, editable summary, tag chips.
- Alert feed shows incident group with summary preview.

### Data model (Prisma)

```prisma
model Incident {
  id         String   @id @default(cuid())
  cameraId   String
  ruleId     String
  startTs    DateTime
  endTs      DateTime
  alertIds   String[]
  summary    String?
  tags       Json?
  version    Int      @default(1)
  updatedAt  DateTime @updatedAt
}

model IncidentSummaryVersion {
  id         String   @id @default(cuid())
  incidentId String
  version    Int
  summary    String
  tags       Json
  editedBy   String
  editedAt   DateTime @default(now())
}
```

## Testing strategy

- Unit: incident grouping logic (window edges, overlapping alerts).
- Golden set: 50 labeled incidents; assert summary semantically matches (BLEU or human eval).
- Integration: end-to-end across detections → alerts → incidents → summaries.

## Security

- Frames sent to external VLM only if tenant has opted in to external inference.
- Image redaction: privacy masks (TASK-018) applied before VLM call.
- Summaries never contain PII — prompt explicitly forbids identifying individuals.

## Observability

- `vlm_calls_total{vendor,status}`, `vlm_latency_ms`, `vlm_cost_usd_total{tenant}`.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| VLM hallucination about events not present | High | Major | Structured output + cross-check with detection tags; operator review before publish |
| VLM cost spikes | Medium | Major | Per-tenant budget caps with hard cutoff |
| PII in summaries | Medium | Major | Prompt hardening + post-processing filter |

## Rollout

1. Shadow mode: generate but don't display for 2 weeks.
2. Human-review gate before publish for 2 weeks.
3. Auto-publish with operator edit path.

## Definition of done

- [ ] All acceptance criteria checked
- [ ] Human eval report in `docs/quality/task-027.md`
- [ ] Cost dashboard in Grafana
- [ ] `docs/changelog/<date>-task-027.md` entry added
