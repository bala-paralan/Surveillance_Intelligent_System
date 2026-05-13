import { apiFetch } from '@/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AlertType =
  | 'INTRUSION'
  | 'MOTION'
  | 'PERSON'
  | 'VEHICLE'
  | 'SEISMIC'
  | 'ACOUSTIC'
  | 'SYSTEM';

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface AlertPublic {
  id:             string;
  type:           AlertType;
  severity:       AlertSeverity;
  cameraId:       string | null;
  bopZoneId:      string | null;
  aoiId:          string | null;
  message:        string;
  acknowledged:   boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolvedAt:     string | null;
  createdAt:      string;
}

export interface AlertStats {
  critical: number;
  high:     number;
  medium:   number;
  low:      number;
  total:    number;
}

export interface ListAlertsResponse {
  alerts: AlertPublic[];
  total:  number;
  page:   { limit: number; offset: number };
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export interface ListAlertsParams {
  acknowledged?: boolean;
  severity?:     AlertSeverity;
  bopZoneId?:    string;
  aoiId?:        string;
  limit?:        number;
  offset?:       number;
}

const buildQuery = (params: ListAlertsParams): string => {
  const entries: [string, string][] = [];

  if (params.acknowledged !== undefined) {
    entries.push(['acknowledged', String(params.acknowledged)]);
  }
  if (params.severity  !== undefined) entries.push(['severity',  params.severity]);
  if (params.bopZoneId !== undefined) entries.push(['bopZoneId', params.bopZoneId]);
  if (params.aoiId     !== undefined) entries.push(['aoiId',     params.aoiId]);
  if (params.limit     !== undefined) entries.push(['limit',     String(params.limit)]);
  if (params.offset    !== undefined) entries.push(['offset',    String(params.offset)]);

  if (entries.length === 0) return '';
  const qs = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `?${qs}`;
};

// ── API calls ─────────────────────────────────────────────────────────────────

export const listAlerts = (params: ListAlertsParams = {}): Promise<ListAlertsResponse> =>
  apiFetch<ListAlertsResponse>(`/alerts${buildQuery(params)}`);

export const createAlert = (body: {
  type?:      AlertType;
  severity?:  AlertSeverity;
  cameraId?:  string;
  bopZoneId?: string;
  aoiId?:     string;
  message:    string;
  metadata?:  Record<string, unknown>;
}): Promise<{ alert: AlertPublic }> =>
  apiFetch<{ alert: AlertPublic }>('/alerts', {
    method: 'POST',
    body:   JSON.stringify(body),
  });

export const acknowledgeAlert = (id: string): Promise<{ alert: AlertPublic }> =>
  apiFetch<{ alert: AlertPublic }>(`/alerts/${id}/acknowledge`, { method: 'PATCH' });

export const resolveAlert = (id: string): Promise<{ alert: AlertPublic }> =>
  apiFetch<{ alert: AlertPublic }>(`/alerts/${id}/resolve`, { method: 'PATCH' });

export const escalateAlert = (id: string): Promise<{ alert: AlertPublic }> =>
  apiFetch<{ alert: AlertPublic }>(`/alerts/${id}/escalate`, { method: 'PATCH' });

// Marking an alert as a false positive — the analytics service consumes this
// to refine fusion thresholds (TASK-043 §9). Out of UI scope, but the hook
// must exist.
export const markAlertFalse = (id: string): Promise<{ alert: AlertPublic }> =>
  apiFetch<{ alert: AlertPublic }>(`/alerts/${id}/false-positive`, { method: 'PATCH' });

export const getAlertStats = (): Promise<AlertStats> =>
  apiFetch<AlertStats>('/alerts/stats');
