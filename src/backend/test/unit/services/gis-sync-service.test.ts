import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaStub, resetPrismaStub } from '../../utils/prisma-stub.js';

vi.mock('../../../src/db.js', () => ({ prisma: prismaStub }));

const { runGisSync, GeoPackageMockSource } = await import('../../../src/services/gis-sync-service.js');

describe('services/gis-sync-service', () => {
  beforeEach(() => resetPrismaStub());

  it('GeoPackageMockSource.fetchAll returns deterministic fixture data', async () => {
    const data = await new GeoPackageMockSource().fetchAll();
    expect(data.bops.length).toBe(5);
    expect(data.zones.length).toBe(20);
    expect(data.assets.length).toBe(100);
  });

  it('runGisSync inserts new BOPs, updates existing, resolves parent zones, creates assets', async () => {
    prismaStub.gisSyncLog.create.mockResolvedValue({ id: 'log_1' });
    prismaStub.gisSyncLog.update.mockResolvedValue({});

    // First BOP exists, second BOP does not
    prismaStub.bop.findUnique.mockImplementation(async ({ where }: { where: { code: string } }) =>
      where.code === 'ALPHA' ? { id: 'bop_alpha', code: 'ALPHA' } : null
    );
    prismaStub.bop.create.mockResolvedValue({});
    prismaStub.bop.update.mockResolvedValue({});

    // After the bop pass, return id lookup
    prismaStub.bop.findMany.mockResolvedValue([
      { id: 'bop_alpha', code: 'ALPHA' },
      { id: 'bop_beta',  code: 'BETA'  },
    ]);

    // Zones: first zone (Z1) exists, parent will exist; others don't
    prismaStub.bopZone.findUnique.mockImplementation(
      async ({ where }: { where: { bopId_code: { bopId: string; code: string } } }) => {
        if (where.bopId_code.code === 'ALPHA-Z1') return { id: 'zone_alpha_z1' };
        if (where.bopId_code.code === 'ALPHA-ROOT') return { id: 'zone_alpha_root' };
        return null;
      }
    );
    prismaStub.bopZone.create.mockResolvedValue({});
    prismaStub.bopZone.update.mockResolvedValue({});
    prismaStub.bopZone.findMany.mockResolvedValue([
      { id: 'zone_alpha_z1', bopId: 'bop_alpha', code: 'ALPHA-Z1' },
      { id: 'zone_beta_z2',  bopId: 'bop_beta',  code: 'BETA-Z2'  },
    ]);

    prismaStub.asset.create.mockResolvedValue({});

    await runGisSync({
      fetchAll: async () => ({
        bops: [
          { code: 'ALPHA', name: 'Alpha', zones: [], assets: [] },
          { code: 'BETA',  name: 'Beta',  zones: [], assets: [] },
        ],
        zones: [
          { bopCode: 'ALPHA', code: 'ALPHA-Z1',   name: 'Z1', sensors: [] },
          { bopCode: 'ALPHA', code: 'ALPHA-Z2',   name: 'Z2', sensors: ['s1'], parentCode: 'ALPHA-ROOT' },
          { bopCode: 'BETA',  code: 'BETA-Z2',    name: 'B-Z2', sensors: [] },
          // unknown bopCode → warn + skip
          { bopCode: 'NOPE',  code: 'X-Z1',       name: 'X',  sensors: [] },
          // parent reference where parent does NOT exist (second pass continues)
          { bopCode: 'BETA',  code: 'BETA-Z2',    name: 'B-Z2', sensors: [], parentCode: 'BETA-MISSING' },
          // parent code reference where bopId is missing
          { bopCode: 'NOPE',  code: 'X-Z1',       name: 'X',  sensors: [], parentCode: 'X-PARENT' },
        ],
        assets: [
          { bopCode: 'ALPHA', zoneCode: 'ALPHA-Z1', kind: 'PUMP', lat: 1, lon: 2, metadata: {} },
          // asset with zoneCode that doesn't map → zoneId resolved to null
          { bopCode: 'ALPHA', zoneCode: 'UNKNOWN',  kind: 'TANK', lat: 0, lon: 0, metadata: { tag: 't' } },
          // asset without zoneCode
          { bopCode: 'BETA',  kind: 'VALVE', lat: 9, lon: 9, metadata: {} },
          // asset with unknown bopCode → skip
          { bopCode: 'GHOST', kind: 'X',     lat: 0, lon: 0, metadata: {} },
        ],
      }),
    });

    expect(prismaStub.bop.create).toHaveBeenCalledTimes(1);
    expect(prismaStub.bop.update).toHaveBeenCalledTimes(1);
    expect(prismaStub.gisSyncLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'log_1' }, data: expect.objectContaining({ status: 'done' }) })
    );
    expect(prismaStub.asset.create).toHaveBeenCalledTimes(3);
  });

  it('runGisSync marks the sync log as failed and rethrows when transaction fails', async () => {
    prismaStub.gisSyncLog.create.mockResolvedValue({ id: 'log_2' });
    prismaStub.gisSyncLog.update.mockResolvedValue({});
    prismaStub.$transaction.mockReset();
    prismaStub.$transaction.mockRejectedValueOnce(new Error('boom'));

    await expect(
      runGisSync({
        fetchAll: async () => ({ bops: [], zones: [], assets: [] }),
      })
    ).rejects.toThrow('boom');

    expect(prismaStub.gisSyncLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed', errorMsg: 'boom' }) })
    );
  });

  it('runGisSync handles non-Error rejections by stringifying', async () => {
    prismaStub.gisSyncLog.create.mockResolvedValue({ id: 'log_3' });
    prismaStub.gisSyncLog.update.mockResolvedValue({});
    prismaStub.$transaction.mockReset();
    prismaStub.$transaction.mockRejectedValueOnce('not-an-error');

    await expect(
      runGisSync({
        fetchAll: async () => ({ bops: [], zones: [], assets: [] }),
      })
    ).rejects.toBe('not-an-error');

    expect(prismaStub.gisSyncLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ errorMsg: 'not-an-error' }) })
    );
  });

  it('runGisSync swallows secondary error from the failure log update', async () => {
    prismaStub.gisSyncLog.create.mockResolvedValue({ id: 'log_4' });
    prismaStub.gisSyncLog.update.mockRejectedValue(new Error('cannot reach DB to log error'));
    prismaStub.$transaction.mockReset();
    prismaStub.$transaction.mockRejectedValueOnce(new Error('primary'));

    await expect(
      runGisSync({ fetchAll: async () => ({ bops: [], zones: [], assets: [] }) })
    ).rejects.toThrow('primary');
  });
});
