import { describe, expect, it } from 'vitest';
import {
  buildHeadline,
  classificationLabel,
  formatBearing,
  formatDistance,
  formatDuration,
  fusedScoreExplanation,
  sensorsConfirmPhrase,
} from '@/lib/headline';
import type { Threat } from '@shared/types';

const baseThreat = (overrides: Partial<Threat> = {}): Threat => ({
  threat_id: 't-1',
  aoi_id: 'aoi-1',
  classification: 'group_presence',
  severity: 'HIGH',
  fused_score: 0.83,
  contributions: [
    {
      detection_id: 'd-1',
      sensor_id: 's-07',
      sensor_type: 'seismic',
      confidence: 0.6,
      use_case_match: 'footsteps_group',
      observed_at: '2026-04-27T10:00:00Z',
    },
    {
      detection_id: 'd-2',
      sensor_id: 's-08',
      sensor_type: 'acoustic',
      confidence: 0.55,
      use_case_match: 'voices',
      observed_at: '2026-04-27T10:00:30Z',
    },
    {
      detection_id: 'd-3',
      sensor_id: 's-09',
      sensor_type: 'thermal',
      confidence: 0.7,
      use_case_match: 'group_presence',
      observed_at: '2026-04-27T10:01:00Z',
    },
  ],
  geo: { lat: 12.345, lon: 67.89, radius_m: 200 },
  observed_at: '2026-04-27T10:00:00Z',
  last_seen_at: '2026-04-27T10:04:00Z',
  duration_s: 240,
  acknowledged: false,
  ...overrides,
});

describe('formatDistance', () => {
  it('returns metres under 1 km', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(450)).toBe('450 m');
    expect(formatDistance(999.4)).toBe('999 m');
  });
  it('returns one-decimal km between 1 and 10 km', () => {
    expect(formatDistance(1200)).toBe('1.2 km');
    expect(formatDistance(9499)).toBe('9.5 km');
  });
  it('returns rounded km beyond 10 km', () => {
    expect(formatDistance(10500)).toBe('11 km');
  });
  it('clamps invalid values', () => {
    expect(formatDistance(-1)).toBe('0 m');
    expect(formatDistance(Number.NaN)).toBe('0 m');
  });
});

describe('formatBearing', () => {
  it('maps to 8 cardinals', () => {
    expect(formatBearing(0)).toBe('N');
    expect(formatBearing(45)).toBe('NE');
    expect(formatBearing(90)).toBe('E');
    expect(formatBearing(180)).toBe('S');
    expect(formatBearing(270)).toBe('W');
    expect(formatBearing(315)).toBe('NW');
    expect(formatBearing(359.9)).toBe('N');
  });
  it('normalises out-of-range angles', () => {
    expect(formatBearing(720)).toBe('N');
    expect(formatBearing(-45)).toBe('NW');
  });
  it('returns null for absent or invalid', () => {
    expect(formatBearing(undefined)).toBeNull();
    expect(formatBearing(Number.NaN)).toBeNull();
  });
});

describe('formatDuration', () => {
  it('handles seconds, minutes, hours, days', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(240)).toBe('4 min');
    expect(formatDuration(3600 * 2)).toBe('2 h');
    expect(formatDuration(3600 * 50)).toBe('2 d');
  });
  it('returns null for absent or non-positive', () => {
    expect(formatDuration(undefined)).toBeNull();
    expect(formatDuration(0)).toBeNull();
  });
});

describe('sensorsConfirmPhrase', () => {
  it('uses singular form for 1', () => {
    expect(sensorsConfirmPhrase(1)).toBe('1 sensor confirms');
  });
  it('uses plural form for >1', () => {
    expect(sensorsConfirmPhrase(3)).toBe('3 sensors confirm');
  });
  it('returns empty for 0', () => {
    expect(sensorsConfirmPhrase(0)).toBe('');
  });
});

describe('classificationLabel', () => {
  it('maps known classifications to operator labels', () => {
    expect(classificationLabel('tunneling')).toBe('Tunneling activity');
    expect(classificationLabel('footsteps_group')).toBe('Group of 3+ humans walking');
  });
});

describe('buildHeadline', () => {
  it('produces the §8 example sentence (footsteps_group)', () => {
    const threat = baseThreat({ classification: 'footsteps_group' });
    const headline = buildHeadline(threat, {
      aoiLabel: 'Sector A-2',
      anchorLabel: 'Sensor S-07',
      anchorDistanceM: 1200,
      anchorBearingDeg: 45,
    });
    expect(headline).toBe(
      'Group of 3+ humans walking detected in Sector A-2, ~1.2 km NE of Sensor S-07, last 4 min. 3 sensors confirm.',
    );
  });

  it('handles group_presence classification', () => {
    const threat = baseThreat();
    const headline = buildHeadline(threat, {
      aoiLabel: 'Sector A-2',
      anchorLabel: 'Sensor S-07',
      anchorDistanceM: 1200,
      anchorBearingDeg: 45,
    });
    expect(headline).toBe(
      'Group of people detected in Sector A-2, ~1.2 km NE of Sensor S-07, last 4 min. 3 sensors confirm.',
    );
  });

  it('omits direction when bearing is unavailable (Q3 default for non-advanced sensors)', () => {
    const threat = baseThreat();
    const headline = buildHeadline(threat, {
      aoiLabel: 'Sector A-2',
      anchorLabel: 'Sensor S-07',
      anchorDistanceM: 1200,
    });
    expect(headline).toBe(
      'Group of people detected in Sector A-2, ~1.2 km of Sensor S-07, last 4 min. 3 sensors confirm.',
    );
  });

  it('omits anchor clause when no anchor is supplied', () => {
    const threat = baseThreat({ duration_s: undefined, contributions: [] });
    const headline = buildHeadline(threat, { aoiLabel: 'Sector A-2' });
    expect(headline).toBe('Group of people detected in Sector A-2.');
  });

  it('uses singular sensor phrase when only one contribution', () => {
    const threat = baseThreat({
      contributions: [
        {
          detection_id: 'd-1',
          sensor_id: 's-07',
          sensor_type: 'seismic',
          confidence: 0.6,
          use_case_match: 'footsteps_single',
          observed_at: '2026-04-27T10:00:00Z',
        },
      ],
      classification: 'footsteps_single',
      duration_s: 90,
    });
    const headline = buildHeadline(threat, {
      aoiLabel: 'Sector A-2',
      anchorLabel: 'Sensor S-12',
      anchorDistanceM: 1400,
    });
    expect(headline).toBe(
      'Footsteps of a single person detected in Sector A-2, ~1.4 km of Sensor S-12, last 2 min. 1 sensor confirms.',
    );
  });
});

describe('fusedScoreExplanation', () => {
  it('explains agreement when multiple sensors contribute', () => {
    const threat = baseThreat({ fused_score: 0.91 });
    expect(fusedScoreExplanation(threat)).toBe('3 sensors agree → 0.91');
  });
  it('shows single-sensor framing for one contribution', () => {
    const threat = baseThreat({
      contributions: [
        {
          detection_id: 'd-1',
          sensor_id: 's-07',
          sensor_type: 'seismic',
          confidence: 0.62,
          use_case_match: 'footsteps_single',
          observed_at: '2026-04-27T10:00:00Z',
        },
      ],
      fused_score: 0.62,
    });
    expect(fusedScoreExplanation(threat)).toBe('Single-sensor reading 0.62');
  });
});
