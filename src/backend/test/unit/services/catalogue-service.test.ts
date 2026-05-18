import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaStub, resetPrismaStub } from '../../utils/prisma-stub.js';

vi.mock('../../../src/db.js', () => ({ prisma: prismaStub }));

const { listForAoi, toSensorPublic } = await import(
  '../../../src/services/catalogue-service.js'
);

// A simple unit square polygon (closed ring): (0,0) → (10,0) → (10,10) → (0,10) → (0,0)
const squareRing = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
  [0, 0],
];
const geomSquare = JSON.stringify({ type: 'Polygon', coordinates: [squareRing] });

// Polygon with a hole — outer square + inner hole (4..6) on both axes
const ringWithHole = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0], [10, 0], [10, 10], [0, 10], [0, 0],
    ],
    [
      [4, 4], [6, 4], [6, 6], [4, 6], [4, 4],
    ],
  ],
};

describe('services/catalogue-service', () => {
  beforeEach(() => resetPrismaStub());

  it('toSensorPublic maps Date → ISO string and falls back null for missing lastHeartbeat', () => {
    const out = toSensorPublic({
      id: 's1',
      type: 'SEISMIC',
      lat: 1,
      lon: 2,
      bopZoneId: null,
      installedOn: new Date('2024-01-01T00:00:00.000Z'),
      lastHeartbeat: null,
      health: 'HEALTHY',
    });
    expect(out.installedOn).toBe('2024-01-01T00:00:00.000Z');
    expect(out.lastHeartbeat).toBeNull();
  });

  it('toSensorPublic emits lastHeartbeat ISO when set', () => {
    const out = toSensorPublic({
      id: 's1', type: 'SEISMIC', lat: 1, lon: 2, bopZoneId: 'z',
      installedOn: new Date('2024-01-01T00:00:00.000Z'),
      lastHeartbeat: new Date('2024-01-02T00:00:00.000Z'),
      health: 'DEGRADED',
    });
    expect(out.lastHeartbeat).toBe('2024-01-02T00:00:00.000Z');
    expect(out.bopZoneId).toBe('z');
  });

  it('listForAoi throws when AOI not found', async () => {
    prismaStub.aoi.findUnique.mockResolvedValue(null);
    await expect(listForAoi('missing')).rejects.toThrow(/AOI not found/);
  });

  it('listForAoi throws when AOI soft-deleted', async () => {
    prismaStub.aoi.findUnique.mockResolvedValue({
      id: 'a1', deletedAt: new Date(), geometryJson: geomSquare, bopZoneId: null,
    });
    await expect(listForAoi('a1')).rejects.toThrow(/AOI not found/);
  });

  it('listForAoi throws when geometry JSON is invalid', async () => {
    prismaStub.aoi.findUnique.mockResolvedValue({
      id: 'a1', deletedAt: null, geometryJson: 'not-json', bopZoneId: null,
    });
    await expect(listForAoi('a1')).rejects.toThrow(/invalid geometryJson/);
  });

  it('listForAoi filters sensors & assets by polygon (inside/outside)', async () => {
    prismaStub.aoi.findUnique.mockResolvedValue({
      id: 'a1', deletedAt: null, geometryJson: geomSquare, bopZoneId: null,
    });
    prismaStub.sensor.findMany.mockResolvedValue([
      { id: 's_in', type: 'SEISMIC', lat: 5, lon: 5, bopZoneId: null, installedOn: new Date('2024-01-01'), lastHeartbeat: null, health: 'HEALTHY' },
      { id: 's_out', type: 'ACOUSTIC', lat: 20, lon: 20, bopZoneId: null, installedOn: new Date('2024-01-01'), lastHeartbeat: null, health: 'HEALTHY' },
    ]);
    prismaStub.asset.findMany.mockResolvedValue([
      { id: 'a_in', zoneId: null, kind: 'PUMP', lat: 1, lon: 1, createdAt: new Date('2024-02-01') },
      { id: 'a_out', zoneId: null, kind: 'TANK', lat: 99, lon: 99, createdAt: new Date('2024-02-01') },
    ]);
    prismaStub.camera.findMany.mockResolvedValue([
      { id: 'c1', siteId: null, status: 'ONLINE', lastSeenAt: new Date('2024-03-01'), createdAt: new Date('2024-03-01') },
    ]);

    const items = await listForAoi('a1');
    const ids = items.map((i) => i.id).sort();
    expect(ids).toEqual(['a_in', 'c1', 's_in'].sort());
  });

  it('listForAoi excludes points inside a hole ring', async () => {
    prismaStub.aoi.findUnique.mockResolvedValue({
      id: 'a1', deletedAt: null, geometryJson: JSON.stringify(ringWithHole), bopZoneId: null,
    });
    prismaStub.sensor.findMany.mockResolvedValue([
      { id: 's_in_outer', type: 'SEISMIC', lat: 2, lon: 2, bopZoneId: null, installedOn: new Date('2024-01-01'), lastHeartbeat: new Date('2024-01-02'), health: 'OFFLINE' },
      { id: 's_in_hole',  type: 'ACOUSTIC', lat: 5, lon: 5, bopZoneId: 'z1', installedOn: new Date('2024-01-01'), lastHeartbeat: null, health: 'UNKNOWN' },
    ]);
    prismaStub.asset.findMany.mockResolvedValue([]);
    prismaStub.camera.findMany.mockResolvedValue([]);

    const items = await listForAoi('a1');
    expect(items.map((i) => i.id)).toEqual(['s_in_outer']);
    expect(items[0]!.lastHeartbeat).toBe('2024-01-02T00:00:00.000Z');
  });

  it('listForAoi filters cameras by siteId when AOI has a bopZoneId', async () => {
    prismaStub.aoi.findUnique.mockResolvedValue({
      id: 'a1', deletedAt: null, geometryJson: geomSquare, bopZoneId: 'zone-A',
    });
    prismaStub.sensor.findMany.mockResolvedValue([]);
    prismaStub.asset.findMany.mockResolvedValue([]);
    prismaStub.camera.findMany.mockResolvedValue([
      { id: 'c1', siteId: 'zone-A', status: 'ONLINE',   lastSeenAt: new Date(), createdAt: new Date() },
      { id: 'c2', siteId: 'zone-A', status: 'DEGRADED', lastSeenAt: null,        createdAt: new Date() },
      { id: 'c3', siteId: 'zone-A', status: 'OFFLINE',  lastSeenAt: null,        createdAt: new Date() },
      { id: 'c4', siteId: 'zone-A', status: 'MAINTENANCE', lastSeenAt: null,     createdAt: new Date() },
    ]);

    const items = await listForAoi('a1');
    expect(items.map((c) => c.health)).toEqual(['HEALTHY', 'DEGRADED', 'OFFLINE', 'UNKNOWN']);
    expect(prismaStub.camera.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { siteId: 'zone-A' } }),
    );
  });

  it('listForAoi sorts: sensors before cameras before assets, then by type', async () => {
    prismaStub.aoi.findUnique.mockResolvedValue({
      id: 'a1', deletedAt: null, geometryJson: geomSquare, bopZoneId: null,
    });
    prismaStub.sensor.findMany.mockResolvedValue([
      { id: 's1', type: 'THERMAL', lat: 5, lon: 5, bopZoneId: null, installedOn: new Date('2024-01-01'), lastHeartbeat: null, health: 'HEALTHY' },
    ]);
    prismaStub.asset.findMany.mockResolvedValue([
      { id: 'a1', zoneId: null, kind: 'PUMP', lat: 1, lon: 1, createdAt: new Date('2024-02-01') },
    ]);
    prismaStub.camera.findMany.mockResolvedValue([
      { id: 'c1', siteId: null, status: 'ONLINE', lastSeenAt: null, createdAt: new Date('2024-03-01') },
    ]);
    const items = await listForAoi('a1');
    expect(items.map((i) => i.kind)).toEqual(['sensor', 'camera', 'asset']);
  });
});
