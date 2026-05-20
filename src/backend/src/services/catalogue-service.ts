/**
 * Catalogue service — TASK-032.
 * Provides spatial queries to list sensors, assets, and cameras inside an AOI polygon.
 * Uses ray-casting point-in-polygon (no PostGIS dependency — geometry stored as JSON text).
 */
import { prisma } from '../db.js';
import { logger } from '../logger.js';
import { NotFoundError } from '../errors.js';

// ── Public types ─────────────────────────────────────────────────────────────

export interface CatalogueItem {
  id: string;
  kind: 'sensor' | 'camera' | 'asset';
  type: string;       // SensorType | 'CAMERA' | asset.kind
  lat: number;
  lon: number;
  bopZoneId: string | null;
  installedOn: string | null;
  lastHeartbeat: string | null;
  health: string;     // SensorHealth | 'UNKNOWN'
  availableStreams: string[];
}

export interface SensorPublic {
  id: string;
  type: string;
  lat: number;
  lon: number;
  bopZoneId: string | null;
  installedOn: string | null;
  lastHeartbeat: string | null;
  health: string;
}

// ── Internal GeoJSON type ────────────────────────────────────────────────────

interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

// ── Spatial helpers ──────────────────────────────────────────────────────────

/**
 * Ray-casting point-in-polygon test.
 * @param lat   - point latitude  (y)
 * @param lon   - point longitude (x)
 * @param rings - GeoJSON-style coordinate rings  [ring][vertex][lon, lat]
 */
const pointInPolygon = (lat: number, lon: number, rings: number[][][]): boolean => {
  // Test against each ring; inside outer ring XOR inside any hole
  let inside = false;

  for (const ring of rings) {
    const n = ring.length;
    let j = n - 1;
    for (let i = 0; i < n; i++) {
      const xi = ring[i]?.[0] ?? 0;   // lon
      const yi = ring[i]?.[1] ?? 0;   // lat
      const xj = ring[j]?.[0] ?? 0;
      const yj = ring[j]?.[1] ?? 0;

      const intersects =
        yi > lat !== yj > lat &&
        lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

      if (intersects) inside = !inside;
      j = i;
    }
  }

  return inside;
};

// ── Main exported function ───────────────────────────────────────────────────

export const listForAoi = async (aoiId: string): Promise<CatalogueItem[]> => {
  // Load AOI
  const aoi = await prisma.aoi.findUnique({ where: { id: aoiId } });
  if (aoi === null || aoi.deletedAt !== null) {
    throw new NotFoundError('AOI');
  }

  // Parse geometry
  let geometry: GeoJsonPolygon;
  try {
    geometry = JSON.parse(aoi.geometryJson) as GeoJsonPolygon;
  } catch {
    throw new Error(`AOI ${aoiId} has invalid geometryJson`);
  }
  const rings = geometry.coordinates;

  // ── Sensors ──────────────────────────────────────────────────────────────
  const allSensors = await prisma.sensor.findMany();
  const matchedSensors: CatalogueItem[] = allSensors
    .filter((s) => pointInPolygon(s.lat, s.lon, rings))
    .map((s) => ({
      id:               s.id,
      kind:             'sensor' as const,
      type:             s.type,
      lat:              s.lat,
      lon:              s.lon,
      bopZoneId:        s.bopZoneId,
      installedOn:      s.installedOn.toISOString(),
      lastHeartbeat:    s.lastHeartbeat?.toISOString() ?? null,
      health:           s.health,
      availableStreams:  [],
    }));

  // ── Assets ────────────────────────────────────────────────────────────────
  const allAssets = await prisma.asset.findMany();
  const matchedAssets: CatalogueItem[] = allAssets
    .filter((a) => pointInPolygon(a.lat, a.lon, rings))
    .map((a) => ({
      id:               a.id,
      kind:             'asset' as const,
      type:             a.kind,
      lat:              a.lat,
      lon:              a.lon,
      bopZoneId:        a.zoneId,
      installedOn:      a.createdAt.toISOString(),
      lastHeartbeat:    null,
      health:           'UNKNOWN',
      availableStreams:  [],
    }));

  // ── Cameras (approximate by siteId == bopZoneId) ─────────────────────────
  const cameraFilter = aoi.bopZoneId !== null
    ? { siteId: aoi.bopZoneId }
    : undefined;

  const cameras = await prisma.camera.findMany({
    where: cameraFilter,
    select: {
      id:        true,
      siteId:    true,
      status:    true,
      lastSeenAt: true,
      createdAt: true,
    },
  });

  const matchedCameras: CatalogueItem[] = cameras.map((c) => ({
    id:               c.id,
    kind:             'camera' as const,
    type:             'CAMERA',
    lat:              0,
    lon:              0,
    bopZoneId:        c.siteId,
    installedOn:      c.createdAt.toISOString(),
    lastHeartbeat:    c.lastSeenAt?.toISOString() ?? null,
    health:           c.status === 'ONLINE' ? 'HEALTHY'
                    : c.status === 'DEGRADED' ? 'DEGRADED'
                    : c.status === 'OFFLINE' ? 'OFFLINE'
                    : 'UNKNOWN',
    availableStreams:  ['hls', 'webrtc'],
  }));

  // ── Merge, sort, and return ───────────────────────────────────────────────
  const all = [...matchedSensors, ...matchedCameras, ...matchedAssets];

  all.sort((a, b) => {
    const kindOrder: Record<string, number> = { sensor: 0, camera: 1, asset: 2 };
    const kDiff = (kindOrder[a.kind] ?? 3) - (kindOrder[b.kind] ?? 3);
    if (kDiff !== 0) return kDiff;
    return a.type.localeCompare(b.type);
  });

  logger.info(
    {
      aoiId,
      sensorCount: matchedSensors.length,
      assetCount:  matchedAssets.length,
      cameraCount: matchedCameras.length,
    },
    'catalogue listForAoi complete'
  );

  return all;
};

// ── SensorPublic helper ───────────────────────────────────────────────────────

export const toSensorPublic = (s: {
  id: string;
  type: string;
  lat: number;
  lon: number;
  bopZoneId: string | null;
  installedOn: Date;
  lastHeartbeat: Date | null;
  health: string;
}): SensorPublic => ({
  id:            s.id,
  type:          s.type,
  lat:           s.lat,
  lon:           s.lon,
  bopZoneId:     s.bopZoneId,
  installedOn:   s.installedOn.toISOString(),
  lastHeartbeat: s.lastHeartbeat?.toISOString() ?? null,
  health:        s.health,
});
