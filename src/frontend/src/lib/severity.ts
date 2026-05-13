// Severity rules engine — TASK-043 §8.
//
// Default mapping (first-pass; configurable per AOI policy):
//   Critical : fused_score >= 0.85 AND classification ∈ critical-family
//   High     : fused_score >= 0.7  OR  >=2 sensors agree on human/group
//   Medium   : single-sensor human or vehicle, score >= 0.6
//   Low      : animal, ambient, anything else
//
// Pure function. The policy is overridable so each AOI can carry its own
// thresholds once §14 Q4 is signed off.

import type {
  Classification,
  Severity,
  Threat,
} from '@shared/types';
import {
  CLASSIFICATION_ARMED,
  CLASSIFICATION_HUMAN,
  CLASSIFICATION_TUNNEL,
  CLASSIFICATION_VEHICLE,
} from '@shared/types/sensor';

export interface SeverityPolicy {
  criticalScore: number;
  highScore: number;
  mediumScore: number;
  // Classifications that escalate to Critical when above `criticalScore`.
  criticalClassifications: ReadonlyArray<Classification>;
  // Classifications that count as "human/group" for the high-tier ≥2-sensor rule.
  humanGroupClassifications: ReadonlyArray<Classification>;
  // Classifications that qualify for the medium-tier single-sensor rule.
  vehicleOrHumanClassifications: ReadonlyArray<Classification>;
}

const DEFAULT_CRITICAL_CLASSIFICATIONS: ReadonlyArray<Classification> = [
  ...CLASSIFICATION_TUNNEL,
  ...CLASSIFICATION_VEHICLE,
  ...CLASSIFICATION_ARMED,
];

export const DEFAULT_SEVERITY_POLICY: SeverityPolicy = {
  criticalScore: 0.85,
  highScore: 0.7,
  mediumScore: 0.6,
  criticalClassifications: DEFAULT_CRITICAL_CLASSIFICATIONS,
  humanGroupClassifications: CLASSIFICATION_HUMAN,
  vehicleOrHumanClassifications: [
    ...CLASSIFICATION_HUMAN,
    ...CLASSIFICATION_VEHICLE,
  ],
};

const distinctSensorTypes = (threat: Threat): number => {
  const set = new Set(threat.contributions.map((c) => c.sensor_type));
  return set.size;
};

export const computeSeverity = (
  threat: Threat,
  policy: SeverityPolicy = DEFAULT_SEVERITY_POLICY,
): Severity => {
  const score = threat.fused_score;
  const cls = threat.classification;
  const sensors = distinctSensorTypes(threat);

  // Critical
  if (
    score >= policy.criticalScore &&
    policy.criticalClassifications.includes(cls)
  ) {
    return 'CRITICAL';
  }

  // High — by score, OR by 2+ sensor agreement on human/group
  if (score >= policy.highScore) return 'HIGH';
  if (sensors >= 2 && policy.humanGroupClassifications.includes(cls)) {
    return 'HIGH';
  }

  // Medium — single-sensor human or vehicle at moderate score
  if (
    score >= policy.mediumScore &&
    policy.vehicleOrHumanClassifications.includes(cls)
  ) {
    return 'MEDIUM';
  }

  return 'LOW';
};

// Stamp the computed severity onto a threat. Use when the backend has not
// yet populated severity, or to recompute under a custom AOI policy.
export const withComputedSeverity = (
  threat: Threat,
  policy?: SeverityPolicy,
): Threat => ({
  ...threat,
  severity: computeSeverity(threat, policy),
});
