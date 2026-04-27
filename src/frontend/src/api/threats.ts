// Threat type bridge — adapts the legacy FusionOutcome / AlertPublic shapes
// into the canonical `Threat` defined in `@shared/types`. Downstream UI
// (headline generator, severity rules, drawer) consumes `Threat` only,
// so the rest of the codebase can migrate incrementally.

import type {
  Classification,
  Detection,
  Severity,
  SensorType,
  Threat,
  ThreatContribution,
} from '@shared/types';
import type { AlertPublic, AlertSeverity, AlertType } from '@/api/alerts';
import type { FusionOutcome, GlyphType, OutcomeClass } from '@/api/fusion';

// Re-export canonical types so consumers can `import { Threat } from '@/api/threats'`
// during the migration.
export type {
  Classification,
  Detection,
  Severity,
  SensorType,
  Threat,
  ThreatContribution,
};

// ── Legacy → canonical mapping tables ────────────────────────────────────────

const OUTCOME_TO_CLASSIFICATION: Record<OutcomeClass, Classification> = {
  animal:   'animal',
  human:    'human_presence',
  group:    'group_presence',
  vehicle:  'vehicle',
  drone:    'drone',
  gunshot:  'gunshot',
  tunnel:   'tunneling',
  unknown:  'object_unknown',
};

const ALERT_TYPE_TO_CLASSIFICATION: Record<AlertType, Classification> = {
  INTRUSION: 'intrusion',
  MOTION:    'human_presence',
  PERSON:    'human_presence',
  VEHICLE:   'vehicle',
  SEISMIC:   'footsteps_single',
  ACOUSTIC:  'voices',
  SYSTEM:    'object_unknown',
};

// AlertType is a coarse grouping; the sensor type is best-effort.
const ALERT_TYPE_TO_SENSOR: Record<AlertType, SensorType> = {
  INTRUSION: 'lidar',
  MOTION:    'camera',
  PERSON:    'camera',
  VEHICLE:   'camera',
  SEISMIC:   'seismic',
  ACOUSTIC:  'acoustic',
  SYSTEM:    'camera',
};

// FusionOutcome glyphs are a per-sensor-modality hint. Used only when no
// per-detection sensor type is available on the legacy outcome.
const GLYPH_TO_SENSOR: Record<GlyphType, SensorType> = {
  footstep_radius: 'seismic',
  tunnel:          'seismic',
  vehicle:         'seismic',
  gunshot:         'acoustic',
  drone:           'acoustic',
  animal:          'seismic',
  unknown:         'seismic',
};

const ALERT_SEVERITY_PASSTHROUGH: Record<AlertSeverity, Severity> = {
  CRITICAL: 'CRITICAL',
  HIGH:     'HIGH',
  MEDIUM:   'MEDIUM',
  LOW:      'LOW',
};

// ── Adapters ──────────────────────────────────────────────────────────────────

export const classificationFromOutcomeClass = (c: OutcomeClass): Classification =>
  OUTCOME_TO_CLASSIFICATION[c];

export const sensorFromGlyph = (g: GlyphType): SensorType => GLYPH_TO_SENSOR[g];

interface FusionOutcomeAdapterOpts {
  // FusionOutcome stores AOI-anchored coordinates outside the type;
  // the caller (e.g. the AOI page) supplies the centroid and per-sensor
  // detections it has on hand.
  centroid?: { lat: number; lon: number };
  detections?: Detection[];           // already in canonical shape
  fallbackSeverity?: Severity;        // when fused score does not yet imply one
}

const severityFromFusedScore = (score: number, fallback: Severity = 'LOW'): Severity => {
  if (score >= 0.85) return 'CRITICAL';
  if (score >= 0.7)  return 'HIGH';
  if (score >= 0.6)  return 'MEDIUM';
  return fallback;
};

export const fusionOutcomeToThreat = (
  outcome: FusionOutcome,
  opts: FusionOutcomeAdapterOpts = {},
): Threat => {
  const classification = classificationFromOutcomeClass(outcome.outcomeClass);
  const sensor = sensorFromGlyph(outcome.renderHint.glyph);
  const detections = opts.detections ?? [];
  const contributions: ThreatContribution[] =
    detections.length > 0
      ? detections.map((d) => ({
          detection_id: d.detection_id,
          sensor_id: d.sensor_id,
          sensor_type: d.sensor_type,
          confidence: d.confidence,
          use_case_match: d.use_case_match,
          observed_at: d.observed_at,
        }))
      : outcome.supportingEventIds.map((eventId) => ({
          // Legacy fusion only carries event ids; surface them as best-effort
          // contributions until detections are wired through end-to-end.
          detection_id: eventId,
          sensor_id: outcome.id,
          sensor_type: sensor,
          confidence: outcome.confidence,
          use_case_match: classification,
          observed_at: outcome.firstSeen,
        }));

  return {
    threat_id: outcome.id,
    aoi_id: outcome.aoiId,
    classification,
    severity: severityFromFusedScore(outcome.confidence, opts.fallbackSeverity),
    fused_score: outcome.confidence,
    contributions,
    geo: {
      lat: opts.centroid?.lat ?? 0,
      lon: opts.centroid?.lon ?? 0,
      radius_m: outcome.renderHint.radius_m ?? 0,
      direction_deg: outcome.renderHint.bearing_deg,
    },
    observed_at: outcome.firstSeen,
    last_seen_at: outcome.lastSeen,
    acknowledged: false,
  };
};

interface AlertAdapterOpts {
  centroid?: { lat: number; lon: number };
  radius_m?: number;
}

export const alertToThreat = (
  alert: AlertPublic,
  opts: AlertAdapterOpts = {},
): Threat => {
  const classification = ALERT_TYPE_TO_CLASSIFICATION[alert.type];
  const sensor = ALERT_TYPE_TO_SENSOR[alert.type];

  return {
    threat_id: alert.id,
    aoi_id: alert.aoiId ?? 'unknown',
    classification,
    severity: ALERT_SEVERITY_PASSTHROUGH[alert.severity],
    fused_score: 0,
    contributions: [
      {
        detection_id: alert.id,
        sensor_id: alert.cameraId ?? alert.bopZoneId ?? alert.id,
        sensor_type: sensor,
        confidence: 0,
        use_case_match: alert.message,
        observed_at: alert.createdAt,
      },
    ],
    geo: {
      lat: opts.centroid?.lat ?? 0,
      lon: opts.centroid?.lon ?? 0,
      radius_m: opts.radius_m ?? 0,
    },
    observed_at: alert.createdAt,
    last_seen_at: alert.createdAt,
    acknowledged: alert.acknowledged,
    acknowledged_by: alert.acknowledgedBy ?? undefined,
    acknowledged_at: alert.acknowledgedAt ?? undefined,
    resolved_at: alert.resolvedAt ?? undefined,
  };
};
