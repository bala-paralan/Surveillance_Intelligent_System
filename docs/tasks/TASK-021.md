# TASK-021 — Multi-tenant + site hierarchy with scoped RBAC

**Created:** 2026-04-22
**Phase:** 3 (Scale and operations)
**Priority:** P0 (blocker for multi-customer deployments)
**Status:** Proposed
**Complexity:** L
**Primary owner:** Backend Agent
**Collaborators:** Frontend Agent, DevOps Agent, QA Agent
**Depends on:** TASK-005
**Estimate:** 12 sprint days

---

## Summary

Today RBAC is flat: every user sees every camera in their org. For integrator deployments we need a hierarchy `Tenant → Site → Building → Camera` with RBAC scoped to site membership. Viewers assigned to Site A cannot see any data from Site B. This is also the foundation for per-tenant cost isolation and compliance separation.

## Goals

- Hierarchical scope model with tenant/site/building nodes.
- RBAC bindings scoped to a node; roles inherit down the tree.
- Row-level security: every query filtered by the viewer's scope.
- Admin UI for inviting users into specific scopes.

## Non-goals

- Cross-tenant sharing (future).
- Billing / metering (future).

## User stories

- As an integrator, I want to onboard 20 customers into one instance without any data cross-contamination.
- As an admin, I want to grant a contractor viewer access only to Site B for 30 days.
- As a site manager, I want my operators to see only cameras at my site.

## Acceptance criteria

- [ ] Every camera belongs to exactly one building; every building to one site; every site to one tenant.
- [ ] RBAC binding = `(principal, role, scope_node_id)`; inheritance resolved at query time.
- [ ] Every read API filters rows by resolved scope; attempts to access out-of-scope rows return `404` (not `403`, to avoid leaking existence).
- [ ] Tokens carry tenant id; cross-tenant requests rejected at middleware.
- [ ] Scope tree visualized in admin UI; invites scoped to a subtree.

## Technical design

### Backend (`src/backend/`)

- Middleware `scopeContext.ts` resolves the viewer's effective scope set from JWT + bindings table.
- All repositories take `scope` as a parameter; query builder appends `AND camera_id IN (scope.cameras)`.
- Postgres: add `tenant_id` column to every tenant-scoped table, with a CHECK constraint; enable RLS (row-level security) policies as defense-in-depth.

### Frontend (`src/frontend/`)

- Scope switcher in header (visible to users with access to > 1 scope).
- Admin → Users & Invites with tree-picker for scope assignment.
- Everything respects the currently selected scope.

### Data model (Prisma)

```prisma
model Tenant {
  id     String  @id @default(cuid())
  name   String
  sites  Site[]
}

model Site {
  id        String     @id @default(cuid())
  tenantId  String
  name      String
  buildings Building[]
}

model Building {
  id      String   @id @default(cuid())
  siteId  String
  name    String
  cameras Camera[]
}

model RoleBinding {
  id         String @id @default(cuid())
  principal  String // user or group id
  role       Role
  scopeKind  ScopeKind
  scopeId    String
  expiresAt  DateTime?
}

enum Role { ADMIN OPERATOR VIEWER COMPLIANCE_OFFICER }
enum ScopeKind { TENANT SITE BUILDING CAMERA }
```

### Migration strategy

- Backfill existing rows with a single default tenant/site/building.
- Dual-read during migration: old flat RBAC + new scoped RBAC; switch to new when parity verified.

## Testing strategy

- Unit: scope resolution with nested bindings, expiry handling.
- Integration: cross-tenant request returns 404; RLS blocks even if app code is bypassed.
- E2E: 2 tenants in parallel, assert zero cross-visibility across APIs and WebSocket.
- Fuzz: generate random scope trees + bindings, property-test visibility invariants.

## Security

- Row-level security policies as defense-in-depth.
- Tenant id embedded in JWT claims and verified at every middleware layer.
- Tokens invalidated on role revocation (session store with TTL).

## Observability

- `rbac_denied_total{reason}`, `scope_resolution_duration_ms`.
- Audit log entry on every binding change (hooks into TASK-023).

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Query planner ignores RLS for performance | Low | Major | Validate plan with `EXPLAIN`; review with DBA |
| Scope resolution becomes hot path | High | Major | Cache resolved scope set in Redis keyed on principal version |
| Legacy code paths bypass middleware | High | Major | Lint rule forbidding direct Prisma use outside repo layer |
| Migration corrupts bindings | Medium | Major | Dual-read phase; keep flat table as backup for 30 days |

## Rollout

1. Ship schema + middleware in shadow mode (no enforcement).
2. Migrate internal tenant; verify behavior.
3. Enable enforcement for new tenants only; migrate existing tenants one at a time with customer comms.

## Definition of done

- [ ] All acceptance criteria checked
- [ ] RLS enabled in production
- [ ] Fuzz tests green over 10k iterations
- [ ] `docs/changelog/<date>-task-021.md` entry added
