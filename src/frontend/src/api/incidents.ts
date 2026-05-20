import { apiFetch } from '@/api/client';
import type { AlertSeverity, AlertType } from '@/api/alerts';

// ── Types ─────────────────────────────────────────────────────────────────────

export type IncidentStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'INVESTIGATING'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'CLOSED';

export interface IncidentPublic {
  id:         string;
  title:      string;
  severity:   AlertSeverity;
  status:     IncidentStatus;
  bopZoneId:  string | null;
  responder:  string | null;
  alertCount: number;
  openedAt:   string;
  resolvedAt: string | null;
  createdBy:  string;
  createdAt:  string;
  updatedAt:  string;
}

export interface IncidentAlertSummary {
  id:        string;
  type:      AlertType;
  severity:  AlertSeverity;
  message:   string;
  createdAt: string;
}

export interface ListIncidentsResponse {
  incidents: IncidentPublic[];
  total:     number;
  page:      { limit: number; offset: number };
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export interface ListIncidentsParams {
  status?:    IncidentStatus;
  severity?:  AlertSeverity;
  bopZoneId?: string;
  limit?:     number;
  offset?:    number;
}

const buildQuery = (params: ListIncidentsParams): string => {
  const entries: [string, string][] = [];
  if (params.status    !== undefined) entries.push(['status',    params.status]);
  if (params.severity  !== undefined) entries.push(['severity',  params.severity]);
  if (params.bopZoneId !== undefined) entries.push(['bopZoneId', params.bopZoneId]);
  if (params.limit     !== undefined) entries.push(['limit',     String(params.limit)]);
  if (params.offset    !== undefined) entries.push(['offset',    String(params.offset)]);
  if (entries.length === 0) return '';
  const qs = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `?${qs}`;
};

// ── API calls ─────────────────────────────────────────────────────────────────

export const listIncidents = (params: ListIncidentsParams = {}): Promise<ListIncidentsResponse> =>
  apiFetch<ListIncidentsResponse>(`/incidents${buildQuery(params)}`);

export const getIncident = (
  id: string,
): Promise<{ incident: IncidentPublic; alerts: IncidentAlertSummary[] }> =>
  apiFetch<{ incident: IncidentPublic; alerts: IncidentAlertSummary[] }>(`/incidents/${id}`);

export const createIncident = (body: {
  title:      string;
  severity?:  AlertSeverity;
  status?:    IncidentStatus;
  bopZoneId?: string;
  responder?: string;
  alertIds?:  string[];
}): Promise<{ incident: IncidentPublic }> =>
  apiFetch<{ incident: IncidentPublic }>('/incidents', {
    method: 'POST',
    body:   JSON.stringify(body),
  });

export const updateIncident = (
  id: string,
  body: {
    title?:     string;
    severity?:  AlertSeverity;
    bopZoneId?: string | null;
    responder?: string | null;
  },
): Promise<{ incident: IncidentPublic }> =>
  apiFetch<{ incident: IncidentPublic }>(`/incidents/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify(body),
  });

export const updateIncidentStatus = (
  id: string,
  status: IncidentStatus,
): Promise<{ incident: IncidentPublic }> =>
  apiFetch<{ incident: IncidentPublic }>(`/incidents/${id}/status`, {
    method: 'PATCH',
    body:   JSON.stringify({ status }),
  });

export const deleteIncident = (id: string): Promise<void> =>
  apiFetch<void>(`/incidents/${id}`, { method: 'DELETE' });
