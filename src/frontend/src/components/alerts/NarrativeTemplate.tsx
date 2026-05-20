import type { AlertPublic, AlertType } from '@/api/alerts';

// ── Templates ─────────────────────────────────────────────────────────────────

const TEMPLATES: Record<AlertType, (zone: string, message: string) => string> = {
  INTRUSION: (zone, message) => `Intrusion detected in ${zone} — ${message}`,
  MOTION:    (_zone, message) => `Motion activity — ${message}`,
  PERSON:    (_zone, message) => `Person detected — ${message}`,
  VEHICLE:   (_zone, message) => `Vehicle spotted — ${message}`,
  SEISMIC:   (_zone, message) => `Seismic activity — ${message}`,
  ACOUSTIC:  (_zone, message) => `Acoustic event — ${message}`,
  SYSTEM:    (_zone, message) => `System: ${message}`,
};

export const narrativeFromAlert = (alert: AlertPublic): string => {
  const zone = alert.bopZoneId ?? alert.aoiId ?? 'zone';
  const template = TEMPLATES[alert.type];
  if (template === undefined) return alert.message;
  return template(zone, alert.message);
};

// ── NarrativeTemplate component ───────────────────────────────────────────────

interface NarrativeTemplateProps {
  alert: AlertPublic;
}

export const NarrativeTemplate = ({ alert }: NarrativeTemplateProps) => (
  <span>{narrativeFromAlert(alert)}</span>
);
