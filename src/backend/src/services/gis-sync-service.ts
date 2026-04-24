/**
 * GIS sync service — TASK-041.
 * Upserts BOP / zone / asset data from an external GIS source into the database.
 */
import { prisma } from '../db.js';
import { logger } from '../logger.js';

// ── Input types ───────────────────────────────────────────────────────────────

export interface BopInput {
  code:  string;
  name:  string;
  zones: string[];
  assets: string[];
}

export interface BopZoneInput {
  bopCode:      string;
  code:         string;
  name:         string;
  parentCode?:  string;
  sensors:      string[];
}

export interface AssetInput {
  bopCode:  string;
  zoneCode?: string;
  kind:     string;
  lat:      number;
  lon:      number;
  metadata: Record<string, unknown>;
}

export interface GisData {
  bops:   BopInput[];
  zones:  BopZoneInput[];
  assets: AssetInput[];
}

// ── Source interface ──────────────────────────────────────────────────────────

export interface GisSource {
  fetchAll(): Promise<GisData>;
}

// ── Mock fixture source ───────────────────────────────────────────────────────

const BOP_CODES = ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON'] as const;

const buildFixtureData = (): GisData => {
  const bops: BopInput[] = BOP_CODES.map((code) => ({
    code,
    name: `BOP ${code}`,
    zones: [],
    assets: [],
  }));

  const zones: BopZoneInput[] = BOP_CODES.flatMap((bopCode) =>
    ['Z1', 'Z2', 'Z3', 'Z4'].map((zCode) => ({
      bopCode,
      code:     `${bopCode}-${zCode}`,
      name:     `Zone ${zCode} at ${bopCode}`,
      sensors:  [],
    }))
  );

  const assets: AssetInput[] = BOP_CODES.flatMap((bopCode) =>
    Array.from({ length: 20 }, (_, i) => ({
      bopCode,
      zoneCode: `${bopCode}-Z${(i % 4) + 1}`,
      kind:     ['PUMP', 'VALVE', 'SENSOR', 'TANK', 'COMPRESSOR'][i % 5],
      lat:      51.5 + i * 0.001,
      lon:      -0.1 + i * 0.001,
      metadata: { index: i, source: 'fixture' },
    }))
  );

  return { bops, zones, assets };
};

export class GeoPackageMockSource implements GisSource {
  fetchAll = async (): Promise<GisData> => {
    logger.info('GeoPackageMockSource: returning fixture data');
    return buildFixtureData();
  };
}

// ── Sync runner ───────────────────────────────────────────────────────────────

export const runGisSync = async (source: GisSource): Promise<void> => {
  const syncLog = await prisma.gisSyncLog.create({
    data: { status: 'running' },
  });

  let added   = 0;
  let updated = 0;
  let removed = 0;

  try {
    logger.info({ syncLogId: syncLog.id }, 'GIS sync started');

    const data = await source.fetchAll();

    await prisma.$transaction(async (tx) => {
      // ── BOPs ────────────────────────────────────────────────────────────────
      for (const bopInput of data.bops) {
        const existing = await tx.bop.findUnique({ where: { code: bopInput.code } });

        if (existing) {
          await tx.bop.update({
            where: { code: bopInput.code },
            data: { name: bopInput.name, zones: bopInput.zones, assets: bopInput.assets },
          });
          updated++;
        } else {
          await tx.bop.create({
            data: {
              code:   bopInput.code,
              name:   bopInput.name,
              zones:  bopInput.zones,
              assets: bopInput.assets,
            },
          });
          added++;
        }
      }

      // ── Build bopCode → id lookup ────────────────────────────────────────────
      const bopRecords = await tx.bop.findMany({
        where: { code: { in: data.bops.map((b) => b.code) } },
        select: { id: true, code: true },
      });
      const bopIdByCode = new Map(bopRecords.map((b) => [b.code, b.id]));

      // ── BOP Zones ────────────────────────────────────────────────────────────
      // First pass: create/update zones without parentZoneId
      for (const zoneInput of data.zones) {
        const bopId = bopIdByCode.get(zoneInput.bopCode);
        if (!bopId) {
          logger.warn({ bopCode: zoneInput.bopCode }, 'GIS sync: unknown bopCode for zone, skipping');
          continue;
        }

        const existing = await tx.bopZone.findUnique({
          where: { bopId_code: { bopId, code: zoneInput.code } },
        });

        if (existing) {
          await tx.bopZone.update({
            where: { bopId_code: { bopId, code: zoneInput.code } },
            data:  { name: zoneInput.name, sensors: zoneInput.sensors },
          });
          updated++;
        } else {
          await tx.bopZone.create({
            data: {
              bopId,
              code:    zoneInput.code,
              name:    zoneInput.name,
              sensors: zoneInput.sensors,
            },
          });
          added++;
        }
      }

      // Second pass: resolve parentZoneId references
      for (const zoneInput of data.zones) {
        if (!zoneInput.parentCode) continue;

        const bopId = bopIdByCode.get(zoneInput.bopCode);
        if (!bopId) continue;

        const parent = await tx.bopZone.findUnique({
          where: { bopId_code: { bopId, code: zoneInput.parentCode } },
          select: { id: true },
        });
        if (!parent) continue;

        await tx.bopZone.update({
          where: { bopId_code: { bopId, code: zoneInput.code } },
          data:  { parentZoneId: parent.id },
        });
      }

      // ── Build zoneCode → id lookup ───────────────────────────────────────────
      const zoneRecords = await tx.bopZone.findMany({
        where: { bopId: { in: [...bopIdByCode.values()] } },
        select: { id: true, code: true, bopId: true },
      });
      const zoneIdByBopAndCode = new Map(
        zoneRecords.map((z) => [`${z.bopId}:${z.code}`, z.id])
      );

      // ── Assets ───────────────────────────────────────────────────────────────
      for (const assetInput of data.assets) {
        const bopId = bopIdByCode.get(assetInput.bopCode);
        if (!bopId) {
          logger.warn({ bopCode: assetInput.bopCode }, 'GIS sync: unknown bopCode for asset, skipping');
          continue;
        }

        const zoneId = assetInput.zoneCode
          ? (zoneIdByBopAndCode.get(`${bopId}:${assetInput.zoneCode}`) ?? null)
          : null;

        await tx.asset.create({
          data: {
            bopId,
            zoneId:   zoneId ?? undefined,
            kind:     assetInput.kind,
            lat:      assetInput.lat,
            lon:      assetInput.lon,
            metadata: assetInput.metadata,
          },
        });
        added++;
      }
    });

    await prisma.gisSyncLog.update({
      where: { id: syncLog.id },
      data:  {
        finishedAt: new Date(),
        status:     'done',
        added,
        updated,
        removed,
      },
    });

    logger.info({ syncLogId: syncLog.id, added, updated, removed }, 'GIS sync completed');
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    await prisma.gisSyncLog.update({
      where: { id: syncLog.id },
      data:  {
        finishedAt: new Date(),
        status:     'failed',
        errorMsg,
        added,
        updated,
        removed,
      },
    }).catch((updateErr: unknown) => {
      logger.error({ err: updateErr }, 'GIS sync: failed to update sync log on error');
    });

    logger.error({ syncLogId: syncLog.id, err: errorMsg }, 'GIS sync failed');
    throw err;
  }
};
