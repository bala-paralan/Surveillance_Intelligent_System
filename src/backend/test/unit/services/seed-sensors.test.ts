import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaStub, resetPrismaStub } from '../../utils/prisma-stub.js';

vi.mock('../../../src/db.js', () => ({ prisma: prismaStub }));

const { seedSensors } = await import('../../../src/services/seed-sensors.js');

describe('services/seed-sensors', () => {
  beforeEach(() => resetPrismaStub());

  it('skips with no error when no matching zones are found', async () => {
    prismaStub.bopZone.findMany.mockResolvedValue([]);
    await expect(seedSensors()).resolves.toBeUndefined();
    expect(prismaStub.sensor.createMany).not.toHaveBeenCalled();
  });

  it('inserts 30 records when zones exist and maps the zone ids', async () => {
    prismaStub.bopZone.findMany.mockResolvedValue([
      { id: 'z_a1', code: 'ALPHA-1' },
      { id: 'z_a2', code: 'ALPHA-2' },
      { id: 'z_b1', code: 'BETA-1' },
    ]);
    prismaStub.sensor.createMany.mockResolvedValue({ count: 30 });
    await seedSensors();
    expect(prismaStub.sensor.createMany).toHaveBeenCalledOnce();
    const data = prismaStub.sensor.createMany.mock.calls[0]![0].data as Array<Record<string, unknown>>;
    expect(data.length).toBe(30);
    // Each record must have a valid zone id from the map (or null fallback if a code missing)
    const zoneIds = new Set(data.map((d) => d['bopZoneId']));
    expect([...zoneIds].some((id) => id === 'z_a1' || id === 'z_a2' || id === 'z_b1')).toBe(true);
  });

  it('falls back to null bopZoneId for unmatched zone codes', async () => {
    // Return zones missing one of the three expected codes
    prismaStub.bopZone.findMany.mockResolvedValue([{ id: 'z_a1', code: 'ALPHA-1' }]);
    prismaStub.sensor.createMany.mockResolvedValue({ count: 30 });
    await seedSensors();
    const data = prismaStub.sensor.createMany.mock.calls[0]![0].data as Array<Record<string, unknown>>;
    const nulls = data.filter((d) => d['bopZoneId'] === null);
    expect(nulls.length).toBeGreaterThan(0);
  });

  it('swallows errors (does not throw)', async () => {
    prismaStub.bopZone.findMany.mockRejectedValue(new Error('db down'));
    await expect(seedSensors()).resolves.toBeUndefined();
  });
});
