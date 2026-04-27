import { apiFetch } from '@/api/client';

// ── Shared types (mirror backend) ────────────────────────────────────────────

export interface CatalogueItem {
  id: string;
  kind: 'sensor' | 'camera' | 'asset';
  type: string;
  lat: number;
  lon: number;
  bopZoneId: string | null;
  installedOn: string | null;
  lastHeartbeat: string | null;
  health: string;
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

// ── API functions ─────────────────────────────────────────────────────────────

export const listCatalogue = (aoiId: string): Promise<{ items: CatalogueItem[]; count: number; aoiId: string }> =>
  apiFetch<{ items: CatalogueItem[]; count: number; aoiId: string }>(`/aoi/${aoiId}/catalogue`);

export const listSensors = (bopZoneId?: string): Promise<{ sensors: SensorPublic[]; total: number }> =>
  apiFetch<{ sensors: SensorPublic[]; total: number }>(
    `/sensors${bopZoneId !== undefined ? `?bopZoneId=${encodeURIComponent(bopZoneId)}` : ''}`
  );
