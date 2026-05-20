/**
 * Adapters between the backend API shapes (src/api/*) and the
 * operator-console mock shapes (src/sentry/data.ts).
 *
 * The mocks were designed before the backend existed; rather than mass-rewrite
 * every page to consume the API shape directly, these adapters let pages keep
 * their existing render code while sourcing data from the real backend.
 */
import type { AlertPublic, AlertSeverity } from '@/api/alerts';
import type { IncidentPublic, IncidentStatus } from '@/api/incidents';
import type { AlertRow, AlertStatus, Incident } from '../data';

// ── Severity ─────────────────────────────────────────────────────────────────
// Backend uses CRITICAL/HIGH/MEDIUM/LOW; UI uses 1-5 ordinal (5 = most severe).

const SEVERITY_TO_SEV: Record<AlertSeverity, 1 | 2 | 3 | 4 | 5> = {
  CRITICAL: 5,
  HIGH:     4,
  MEDIUM:   3,
  LOW:      2,
};

export const severityToSev = (s: AlertSeverity): 1 | 2 | 3 | 4 | 5 => SEVERITY_TO_SEV[s];

// ── Alert status ────────────────────────────────────────────────────────────
// Backend stores three orthogonal booleans/timestamps (acknowledged,
// escalated, resolvedAt). UI wants a single discriminated status. Priority:
//   resolvedAt → Resolved
//   escalated  → Escalated
//   acknowledged → Acknowledged
//   else        → Open
// "Investigating" and "Dismissed" aren't represented in the backend yet —
// those will appear once the workflow gains explicit tracking.

const computeAlertStatus = (a: AlertPublic): AlertStatus => {
  if (a.resolvedAt)   return 'Resolved';
  if (a.escalated)    return 'Escalated';
  if (a.acknowledged) return 'Acknowledged';
  return 'Open';
};

// ── Time formatting ─────────────────────────────────────────────────────────

const formatRelativeWhen = (iso: string): string => {
  const ageMs = Date.now() - new Date(iso).getTime();
  const mins  = Math.round(ageMs / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days  = Math.round(hours / 24);
  return `${days} d ago`;
};

const formatTimeOfDay = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// ── Camera label derivation ─────────────────────────────────────────────────

const deriveCameraLabel = (a: AlertPublic): string => {
  if (a.cameraId)  return a.cameraId;
  if (a.bopZoneId) return `${a.bopZoneId}/sensor`;
  return 'system';
};

// ── Alert: backend → UI row ─────────────────────────────────────────────────

export const alertPublicToRow = (a: AlertPublic): AlertRow => ({
  id:      a.id,
  sev:     severityToSev(a.severity),
  type:    a.message,
  sector:  a.bopZoneId ?? '—',
  cam:     deriveCameraLabel(a),
  when:    formatRelativeWhen(a.createdAt),
  whenISO: formatTimeOfDay(a.createdAt),
  status:  computeAlertStatus(a),
  // Backend doesn't carry confidence/persons; show neutral defaults so
  // the UI's confidence bar doesn't render misleading info. Once the
  // analytics service writes those fields onto Alert.metadata we can
  // parse them out here.
  conf:    0.9,
  persons: 0,
});

// ── Incident: backend → UI row ──────────────────────────────────────────────

const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  OPEN:          'Open',
  IN_PROGRESS:   'In Progress',
  INVESTIGATING: 'Investigating',
  ESCALATED:     'Escalated',
  RESOLVED:      'Resolved',
  CLOSED:        'Closed',
};

export const incidentPublicToRow = (i: IncidentPublic): Incident => ({
  id:        i.id,
  title:     i.title,
  sev:       severityToSev(i.severity),
  sector:    i.bopZoneId ?? '—',
  opened:    formatTimeOfDay(i.openedAt),
  status:    INCIDENT_STATUS_LABEL[i.status],
  responder: i.responder ?? '—',
  alerts:    i.alertCount,
});
