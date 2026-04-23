# TASK-028 — Natural-language search over recordings (CLIP embeddings)

**Created:** 2026-04-22
**Phase:** 5 (Platform polish)
**Priority:** P2
**Status:** Proposed
**Complexity:** L
**Primary owner:** Analytics Agent
**Collaborators:** Backend Agent, Frontend Agent, QA Agent
**Depends on:** TASK-015, TASK-021
**Estimate:** 10 sprint days

---

## Summary

Index sampled frames with CLIP (or similar) image-text embeddings and expose a natural-language search API: "show me all deliveries at the front door last week". Results are ranked clips with thumbnails and matched frame timestamps.

## Goals

- Background indexer: sample 1 frame per 5 seconds, embed, store in a vector DB.
- Search API: text → top-K clips within scope + time filter.
- Results UI with thumbnail, camera name, timestamp, relevance score.
- Cost & storage budget per tenant.

## Non-goals

- Voice search input (future).
- Precise object detection within clip (relies on CLIP coarse match).

## User stories

- As an operator, I want to type "person with a red bag" and find matching clips.
- As an investigator, I want to search across 30 days of footage without scrubbing manually.
- As an admin, I want to know how much storage the index consumes per camera.

## Acceptance criteria

- [ ] Indexer keeps up with real-time (< 1 minute lag) for the target of 500 cameras per worker.
- [ ] Vector DB (pgvector / qdrant) stores 512-dim embeddings with HNSW index.
- [ ] Search p95 latency ≤ 800ms for top-20 across 30 days.
- [ ] Results respect scope (TASK-021) and retention (TASK-015); expired frames are removed from the index.
- [ ] Per-tenant budget cap (embedding calls + storage GB).

## Technical design

### Analytics (`src/analytics/`)

- `indexer.py`: consumes segment-created events; samples frames, runs CLIP, writes vectors.
- Model choice: OpenCLIP ViT-B/32 as default; swappable.
- Supports GPU or CPU (CPU acceptable for pilot, GPU required at scale).

### Backend (`src/backend/`)

- `/search` route: embed query text with the same model; kNN over vector DB; filter by scope + time range.
- Returns grouped results (clusters consecutive frames into a clip).
- Cleanup job: remove embeddings for expired segments.

### Frontend (`src/frontend/`)

- Search bar above recording browser; results as a grid of thumbnails.
- Filters: cameras, date range, confidence threshold.

### Data model

```prisma
model FrameEmbedding {
  id        BigInt   @id @default(autoincrement())
  segmentId String
  frameTs   DateTime
  embedding Unsupported("vector(512)")
  tenantId  String
  @@index([tenantId, frameTs])
}
```

- Postgres + pgvector as default; qdrant as optional plugin for larger tenants.

## Testing strategy

- Unit: cluster consecutive frame hits into clips.
- Quality: labeled query set (50 queries × 10 expected clips); recall@10 ≥ 0.7.
- Load: 1000 queries/min with 50M vectors indexed.

## Security

- Embeddings are derived data — never leak frame pixels in API responses.
- Text queries audit-logged.
- Per-tenant partitions in vector DB prevent cross-tenant recall.

## Observability

- `index_frames_total`, `index_lag_seconds`, `search_latency_ms`, vector DB disk usage.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Model drift on domain-specific scenes | High | Minor | Allow custom fine-tuning per tenant (stretch) |
| Vector DB storage explodes | High | Major | Enforce retention sync; down-sample to 1 frame / 30s option |
| Query quality plateaus | Medium | Minor | A/B alt embedding models; show relevance scores |

## Rollout

1. Internal indexing for 2 weeks to measure cost.
2. Opt-in pilot for 3 customers.
3. GA with storage pricing tier.

## Definition of done

- [ ] All acceptance criteria checked
- [ ] Quality report in `docs/quality/task-028.md`
- [ ] `docs/changelog/<date>-task-028.md` entry added
