import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prismaStub, resetPrismaStub } from '../../utils/prisma-stub.js';

vi.mock('../../../src/db.js', () => ({ prisma: prismaStub }));
// Force redis dynamic import to throw → covers the catch path
vi.mock('redis', () => { throw new Error('no redis'); });

const { fusionRoutes } = await import('../../../src/routes/fusion.js');
const { buildTestApp } = await import('../../utils/test-app.js');
const { bearer } = await import('../../utils/auth-helpers.js');

describe('routes/fusion', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    resetPrismaStub();
    app = await buildTestApp(fusionRoutes);
  });
  afterEach(async () => { await app.close(); });

  it('GET /aoi/:id/outcomes requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/aoi/a1/outcomes' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /aoi/:id/outcomes lists with date range', async () => {
    prismaStub.fusionOutcome.findMany.mockResolvedValue([{
      id: 'o1', aoiId: 'a1', outcomeClass: 'tunnel', confidence: 0.9,
      supportingEventIds: ['e1'], renderHint: { x: 1 }, firstSeen: new Date(), lastSeen: new Date(), createdAt: new Date(),
    }]);
    prismaStub.fusionOutcome.count.mockResolvedValue(1);
    const res = await app.inject({
      method: 'GET',
      url: '/aoi/a1/outcomes?from=2024-01-01T00:00:00Z&to=2024-12-31T00:00:00Z&limit=10&offset=0',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(1);
  });

  it('GET /aoi/:id/outcomes no filters', async () => {
    prismaStub.fusionOutcome.findMany.mockResolvedValue([]);
    prismaStub.fusionOutcome.count.mockResolvedValue(0);
    const res = await app.inject({
      method: 'GET', url: '/aoi/a1/outcomes',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /aoi/:id/outcomes with only from', async () => {
    prismaStub.fusionOutcome.findMany.mockResolvedValue([]);
    prismaStub.fusionOutcome.count.mockResolvedValue(0);
    const res = await app.inject({
      method: 'GET', url: '/aoi/a1/outcomes?from=2024-01-01T00:00:00Z',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /aoi/:id/outcomes with only to', async () => {
    prismaStub.fusionOutcome.findMany.mockResolvedValue([]);
    prismaStub.fusionOutcome.count.mockResolvedValue(0);
    const res = await app.inject({
      method: 'GET', url: '/aoi/a1/outcomes?to=2024-12-31T00:00:00Z',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /aoi/:id/outcomes → 400 on invalid query', async () => {
    const res = await app.inject({
      method: 'GET', url: '/aoi/a1/outcomes?limit=999',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /aoi/:id/outcomes propagates errors → 500', async () => {
    prismaStub.fusionOutcome.findMany.mockRejectedValue(new Error('db'));
    prismaStub.fusionOutcome.count.mockRejectedValue(new Error('db'));
    const res = await app.inject({
      method: 'GET', url: '/aoi/a1/outcomes',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(500);
  });

  it('GET /fusion/weights lists current weights', async () => {
    prismaStub.fusionWeight.findMany.mockResolvedValue([
      { id: 'w1', className: 'tunnel', prior: 0.5, likelihoods: { x: 0.1 }, updatedBy: 'u', updatedAt: new Date() },
    ]);
    const res = await app.inject({
      method: 'GET', url: '/fusion/weights',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().weights[0].className).toBe('tunnel');
  });

  it('GET /fusion/weights propagates errors → 500', async () => {
    prismaStub.fusionWeight.findMany.mockRejectedValue(new Error('db'));
    const res = await app.inject({
      method: 'GET', url: '/fusion/weights',
      headers: { authorization: bearer() },
    });
    expect(res.statusCode).toBe(500);
  });

  it('PUT /fusion/weights upserts (ADMIN)', async () => {
    prismaStub.fusionWeight.upsert.mockResolvedValue({
      id: 'w1', className: 'tunnel', prior: 0.5, likelihoods: { x: 0.1 }, updatedBy: 'admin', updatedAt: new Date(),
    });
    const res = await app.inject({
      method: 'PUT', url: '/fusion/weights',
      headers: { authorization: bearer({ role: 'ADMIN', sub: 'admin' }) },
      payload: { className: 'tunnel', prior: 0.5, likelihoods: { x: 0.1 } },
    });
    expect(res.statusCode).toBe(200);
  });

  it('PUT /fusion/weights → 400 on invalid body', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/fusion/weights',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
      payload: { className: '', prior: 2, likelihoods: { x: -1 } },
    });
    expect(res.statusCode).toBe(400);
  });

  it('PUT /fusion/weights rejected for non-ADMIN', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/fusion/weights',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: { className: 'tunnel', prior: 0.5, likelihoods: {} },
    });
    expect(res.statusCode).toBe(403);
  });

  it('PUT /fusion/weights propagates errors → 500', async () => {
    prismaStub.fusionWeight.upsert.mockRejectedValue(new Error('db'));
    const res = await app.inject({
      method: 'PUT', url: '/fusion/weights',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
      payload: { className: 'tunnel', prior: 0.5, likelihoods: {} },
    });
    expect(res.statusCode).toBe(500);
  });

  it('POST /fusion/outcomes ingests low-confidence outcome (no alert publish)', async () => {
    prismaStub.fusionOutcome.create.mockResolvedValue({
      id: 'o1', aoiId: 'a1', outcomeClass: 'human', confidence: 0.4,
      supportingEventIds: [], renderHint: {}, firstSeen: new Date(), lastSeen: new Date(), createdAt: new Date(),
    });
    const res = await app.inject({
      method: 'POST', url: '/fusion/outcomes',
      headers: { authorization: bearer({ role: 'ENGINEER' }) },
      payload: {
        aoiId: 'a1', outcomeClass: 'human', confidence: 0.4,
        firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(),
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it('POST /fusion/outcomes ingests high-confidence outcome (publishes alert)', async () => {
    prismaStub.fusionOutcome.create.mockResolvedValue({
      id: 'o2', aoiId: 'a1', outcomeClass: 'human', confidence: 0.9,
      supportingEventIds: ['e1'], renderHint: { x: 1 }, firstSeen: new Date(), lastSeen: new Date(), createdAt: new Date(),
    });
    const res = await app.inject({
      method: 'POST', url: '/fusion/outcomes',
      headers: { authorization: bearer({ role: 'ADMIN' }) },
      payload: {
        aoiId: 'a1', outcomeClass: 'human', confidence: 0.9,
        supportingEventIds: ['e1'], renderHint: { x: 1 },
        firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(),
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it('POST /fusion/outcomes → 400 on invalid body', async () => {
    const res = await app.inject({
      method: 'POST', url: '/fusion/outcomes',
      headers: { authorization: bearer({ role: 'ENGINEER' }) },
      payload: { aoiId: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /fusion/outcomes rejected for OPERATOR', async () => {
    const res = await app.inject({
      method: 'POST', url: '/fusion/outcomes',
      headers: { authorization: bearer({ role: 'OPERATOR' }) },
      payload: {
        aoiId: 'a1', outcomeClass: 'x', confidence: 0.5,
        firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(),
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST /fusion/outcomes propagates errors → 500', async () => {
    prismaStub.fusionOutcome.create.mockRejectedValue(new Error('db'));
    const res = await app.inject({
      method: 'POST', url: '/fusion/outcomes',
      headers: { authorization: bearer({ role: 'ENGINEER' }) },
      payload: {
        aoiId: 'a1', outcomeClass: 'x', confidence: 0.1,
        firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(),
      },
    });
    expect(res.statusCode).toBe(500);
  });
});
