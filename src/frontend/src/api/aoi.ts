import { apiFetch } from '@/api/client';

export interface AoiPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface Aoi {
  id: string;
  name: string;
  bopZoneId: string | null;
  geometry: AoiPolygon;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export const listAois = (bopZoneId?: string): Promise<{ aois: Aoi[] }> => {
  const query = bopZoneId !== undefined ? `?bopZoneId=${encodeURIComponent(bopZoneId)}` : '';
  return apiFetch<{ aois: Aoi[] }>(`/aoi${query}`);
};

export const createAoi = (body: {
  name: string;
  bopZoneId?: string;
  geometry: AoiPolygon;
}): Promise<{ aoi: Aoi }> =>
  apiFetch<{ aoi: Aoi }>('/aoi', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const updateAoi = (
  id: string,
  body: Partial<{ name: string; bopZoneId: string | null; geometry: AoiPolygon }>
): Promise<{ aoi: Aoi }> =>
  apiFetch<{ aoi: Aoi }>(`/aoi/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const deleteAoi = (id: string): Promise<void> =>
  apiFetch<void>(`/aoi/${id}`, { method: 'DELETE' });

export const exportAoi = (id: string): Promise<object> =>
  apiFetch<object>(`/aoi/${id}/export`);

export const importAois = (fc: object): Promise<{ created: number; skipped: number }> =>
  apiFetch<{ created: number; skipped: number }>('/aoi/import', {
    method: 'POST',
    body: JSON.stringify(fc),
  });
