import { describe, expect, it } from 'vitest';
import { computeSeverity, withComputedSeverity } from '@/lib/severity';
import type { Threat, ThreatContribution } from '@shared/types';

const contribution = (
  sensor: ThreatContribution['sensor_type'],
  conf = 0.6,
): ThreatContribution => ({
  detection_id: `d-${sensor}`,
  sensor_id: `s-${sensor}`,
  sensor_type: sensor,
  confidence: conf,
  use_case_match: 'x',
  observed_at: '2026-04-27T10:00:00Z',
});

const threat = (overrides: Partial<Threat>): Threat => ({
  threat_id: 't-1',
  aoi_id: 'aoi-1',
  classification: 'animal',
  severity: 'LOW',
  fused_score: 0.1,
  contributions: [],
  geo: { lat: 0, lon: 0, radius_m: 0 },
  observed_at: '2026-04-27T10:00:00Z',
  last_seen_at: '2026-04-27T10:00:00Z',
  acknowledged: false,
  ...overrides,
});

describe('computeSeverity — Critical tier', () => {
  it('escalates tunneling at 0.86 to CRITICAL', () => {
    const t = threat({
      classification: 'tunneling',
      fused_score: 0.86,
      contributions: [contribution('seismic'), contribution('acoustic')],
    });
    expect(computeSeverity(t)).toBe('CRITICAL');
  });

  it('escalates vehicle at 0.9 to CRITICAL', () => {
    const t = threat({
      classification: 'vehicle',
      fused_score: 0.9,
      contributions: [contribution('seismic'), contribution('camera')],
    });
    expect(computeSeverity(t)).toBe('CRITICAL');
  });

  it('escalates gunshot (armed family) at >=0.85 to CRITICAL', () => {
    const t = threat({
      classification: 'gunshot',
      fused_score: 0.88,
      contributions: [contribution('acoustic'), contribution('camera')],
    });
    expect(computeSeverity(t)).toBe('CRITICAL');
  });

  it('does NOT escalate human_presence to CRITICAL even at high score', () => {
    const t = threat({
      classification: 'human_presence',
      fused_score: 0.95,
      contributions: [contribution('seismic'), contribution('camera')],
    });
    expect(computeSeverity(t)).toBe('HIGH');
  });
});

describe('computeSeverity — High tier', () => {
  it('returns HIGH when fused score ≥ 0.7', () => {
    const t = threat({
      classification: 'animal',
      fused_score: 0.72,
      contributions: [contribution('seismic')],
    });
    expect(computeSeverity(t)).toBe('HIGH');
  });

  it('returns HIGH when ≥2 sensors agree on human/group, even at lower score', () => {
    const t = threat({
      classification: 'group_presence',
      fused_score: 0.5,
      contributions: [contribution('seismic'), contribution('thermal')],
    });
    expect(computeSeverity(t)).toBe('HIGH');
  });

  it('does NOT return HIGH for 2 sensors when classification is animal', () => {
    const t = threat({
      classification: 'animal',
      fused_score: 0.5,
      contributions: [contribution('seismic'), contribution('thermal')],
    });
    expect(computeSeverity(t)).toBe('LOW');
  });
});

describe('computeSeverity — Medium tier', () => {
  it('returns MEDIUM for single-sensor human at 0.6', () => {
    const t = threat({
      classification: 'human_presence',
      fused_score: 0.6,
      contributions: [contribution('seismic')],
    });
    expect(computeSeverity(t)).toBe('MEDIUM');
  });

  it('returns MEDIUM for single-sensor vehicle at 0.65', () => {
    const t = threat({
      classification: 'vehicle',
      fused_score: 0.65,
      contributions: [contribution('seismic')],
    });
    expect(computeSeverity(t)).toBe('MEDIUM');
  });
});

describe('computeSeverity — Low tier', () => {
  it('returns LOW for animal anywhere below 0.7', () => {
    const t = threat({
      classification: 'animal',
      fused_score: 0.5,
      contributions: [contribution('seismic')],
    });
    expect(computeSeverity(t)).toBe('LOW');
  });

  it('returns LOW for ambient', () => {
    const t = threat({
      classification: 'ambient',
      fused_score: 0.3,
      contributions: [contribution('acoustic')],
    });
    expect(computeSeverity(t)).toBe('LOW');
  });
});

describe('computeSeverity — distinct sensor types', () => {
  it('counts distinct sensor types, not contributions', () => {
    // Two contributions, both seismic — should NOT trigger 2-sensor rule.
    const t = threat({
      classification: 'group_presence',
      fused_score: 0.5,
      contributions: [contribution('seismic'), contribution('seismic')],
    });
    expect(computeSeverity(t)).toBe('LOW');
  });
});

describe('computeSeverity — custom policy', () => {
  it('respects a stricter critical threshold', () => {
    const t = threat({
      classification: 'tunneling',
      fused_score: 0.86,
      contributions: [contribution('seismic'), contribution('acoustic')],
    });
    expect(
      computeSeverity(t, {
        criticalScore: 0.95,
        highScore: 0.7,
        mediumScore: 0.6,
        criticalClassifications: ['tunneling'],
        humanGroupClassifications: [],
        vehicleOrHumanClassifications: [],
      }),
    ).toBe('HIGH');
  });
});

describe('withComputedSeverity', () => {
  it('stamps the computed severity onto the threat', () => {
    const t = threat({
      classification: 'tunneling',
      fused_score: 0.9,
      severity: 'LOW',
      contributions: [contribution('seismic'), contribution('acoustic')],
    });
    const stamped = withComputedSeverity(t);
    expect(stamped.severity).toBe('CRITICAL');
    // Original is not mutated.
    expect(t.severity).toBe('LOW');
  });
});
