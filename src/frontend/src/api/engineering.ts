import { apiFetch } from '@/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SyncLog {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  added: number;
  updated: number;
  removed: number;
  errorMessage: string | null;
}

export interface FusionWeightBody {
  className: string;
  prior: number;
  likelihoods: Record<string, number>;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const listSyncLogs = (): Promise<{ logs: SyncLog[] }> =>
  apiFetch<{ logs: SyncLog[] }>('/bop/sync/logs');

export const updateFusionWeights = (body: FusionWeightBody): Promise<{ weights: unknown[] }> =>
  apiFetch<{ weights: unknown[] }>('/fusion/weights', {
    method: 'PUT',
    body: JSON.stringify(body),
  });

export const patchSensorHealth = (
  sensorId: string,
  health: string,
): Promise<{ sensor: { id: string; health: string } }> =>
  apiFetch<{ sensor: { id: string; health: string } }>(`/sensors/${sensorId}/health`, {
    method: 'PATCH',
    body: JSON.stringify({ health }),
  });
