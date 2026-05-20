/**
 * Seed helper — TASK-032.
 * Inserts 30 fixture sensors across 3 BOP zones (ALPHA-1, ALPHA-2, BETA-1).
 * Skips gracefully if the zones don't exist.
 * Call from `npx prisma db seed` or standalone.
 */
import { prisma } from '../db.js';
import { logger } from '../logger.js';
import type { SensorType } from '@prisma/client';

const ZONE_CODES = ['ALPHA-1', 'ALPHA-2', 'BETA-1'] as const;

const SENSOR_TYPES: SensorType[] = ['SEISMIC', 'ACOUSTIC', 'THERMAL', 'LIDAR'];

/** Return a random float in [min, max) */
const randomInRange = (min: number, max: number): number =>
  Math.random() * (max - min) + min;

/** Random lat within 0.1-degree square of 88.17 */
const randomLat = (): number => randomInRange(88.17, 88.27);

/** Random lon within 0.1-degree square of 21.96 */
const randomLon = (): number => randomInRange(21.96, 22.06);

export const seedSensors = async (): Promise<void> => {
  try {
    // Resolve zone ids for the three codes
    const zones = await prisma.bopZone.findMany({
      where: { code: { in: [...ZONE_CODES] } },
      select: { id: true, code: true },
    });

    if (zones.length === 0) {
      logger.info('seedSensors: no matching BOP zones found — skipping sensor seed');
      return;
    }

    const zoneMap = new Map<string, string>(zones.map((z) => [z.code, z.id]));

    const records: {
      type:        SensorType;
      lat:         number;
      lon:         number;
      bopZoneId:   string | null;
      installedOn: Date;
      health:      'UNKNOWN';
    }[] = [];

    // 30 sensors — cycle through zones and types
    for (let i = 0; i < 30; i++) {
      const zoneCode = ZONE_CODES[i % ZONE_CODES.length]!;
      const sensorType = SENSOR_TYPES[i % SENSOR_TYPES.length]!;
      const zoneId = zoneMap.get(zoneCode) ?? null;

      records.push({
        type:        sensorType,
        lat:         randomLat(),
        lon:         randomLon(),
        bopZoneId:   zoneId,
        installedOn: new Date(2024, 0, 1 + i),   // Jan 1 – Jan 30 2024
        health:      'UNKNOWN',
      });
    }

    const { count } = await prisma.sensor.createMany({
      data:           records,
      skipDuplicates: true,
    });

    logger.info({ count, zones: zones.map((z) => z.code) }, 'seedSensors: inserted sensor fixtures');
  } catch (err: unknown) {
    // Non-fatal — seed errors must not crash the caller
    logger.warn({ err }, 'seedSensors: skipped due to error');
  }
};
