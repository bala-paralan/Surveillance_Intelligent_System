import type { Classification, SensorType } from '@shared/types/sensor';
import type { Detection, GeoPoint } from '@shared/types/detection';

// Severity per TASK-043 §8. Color is never the only carrier of meaning —
// always paired with a label and an icon at the UI layer.
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export const SEVERITIES: readonly Severity[] = [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
] as const;

// Per-sensor contribution inside a fused threat. Carries the single-sensor
// confidence and the use-case label that matched, which the Threat Detail
// Drawer renders one row per.
export interface ThreatContribution {
  detection_id: string;
  sensor_id: string;
  sensor_type: SensorType;
  confidence: number;
  use_case_match: string;
  observed_at: string;
}

// A Threat is the fused, operator-facing unit of work. It bundles one or
// more Detections that agree spatially and temporally, and exposes a single
// fused score that is — when sensors agree — higher than any contributing
// single-sensor score (TASK-043 §8).
export interface Threat {
  threat_id: string;
  aoi_id: string;
  classification: Classification;
  severity: Severity;
  fused_score: number;            // 0..1, post-fusion
  contributions: ThreatContribution[];
  geo: GeoPoint;                  // anchor + radius for the fused threat
  observed_at: string;            // first observation
  last_seen_at: string;           // last observation
  duration_s?: number;            // for continuous events
  recommended_action?: string;    // i18n key or playbook string
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_at?: string;
  // RBAC-gated. Operator surfaces never expose raw signals, but the drawer
  // shows a link to `/engineering/signals/...` when the user has the role.
  evidence_refs?: string[];
}

export const isThreatHumanFamily = (t: Pick<Threat, 'classification'>): boolean =>
  t.classification === 'footsteps_single' ||
  t.classification === 'footsteps_group' ||
  t.classification === 'human_presence' ||
  t.classification === 'group_presence' ||
  t.classification === 'voices';

// Helper for fusion debugging / tests.
export const detectionToContribution = (d: Detection): ThreatContribution => ({
  detection_id: d.detection_id,
  sensor_id: d.sensor_id,
  sensor_type: d.sensor_type,
  confidence: d.confidence,
  use_case_match: d.use_case_match,
  observed_at: d.observed_at,
});
