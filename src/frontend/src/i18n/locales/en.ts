// English (default) operator-facing dictionary — TASK-043 §12.
//
// Keep this file as the single source of strings. Other locales mirror its
// shape. Headline phrases are split into atoms so translators can reorder
// without code changes.

import type { Classification, SensorType, Severity } from '@shared/types';

export interface Dictionary {
  classification: Record<Classification, string>;
  sensor: Record<SensorType, string>;
  severity: Record<Severity, string>;
  headline: {
    detectedIn: (subject: string, aoi: string) => string;
    anchorWithBearing: (distance: string, bearing: string, anchor: string) => string;
    anchorWithoutBearing: (distance: string, anchor: string) => string;
    anchorNear: (anchor: string) => string;
    duration: (duration: string) => string;
    sensorsConfirmSingular: () => string;
    sensorsConfirmPlural: (n: number) => string;
    fusedAgree: (n: number, score: string) => string;
    fusedSingle: (score: string) => string;
  };
  formatting: {
    distanceMeters: (m: number) => string;
    distanceKmOneDecimal: (km: string) => string;
    distanceKmRound: (km: number) => string;
    durationSec: (s: number) => string;
    durationMin: (m: number) => string;
    durationHour: (h: number) => string;
    durationDay: (d: number) => string;
  };
}

export const en: Dictionary = {
  classification: {
    tunneling:           'Tunneling activity',
    footsteps_single:    'Footsteps of a single person',
    footsteps_group:     'Group of 3+ humans walking',
    vehicle:             'Vehicle movement',
    animal:              'Animal movement',
    voices:              'Voices',
    gunshot:             'Gunshot',
    engine:              'Engine noise',
    generator:           'Generator noise',
    livestock:           'Livestock',
    human_presence:      'Human presence',
    group_presence:      'Group of people',
    hot_spot:            'Heat signature',
    intrusion:           'Perimeter intrusion',
    tripwire_crossing:   'Tripwire crossing',
    drone:               'Drone',
    object_unknown:      'Unclassified object',
    ambient:             'Ambient activity',
  },
  sensor: {
    seismic:  'Seismic',
    acoustic: 'Acoustic',
    thermal:  'Thermal',
    lidar:    'LIDAR',
    camera:   'Camera',
  },
  severity: {
    CRITICAL: 'Critical',
    HIGH:     'High',
    MEDIUM:   'Medium',
    LOW:      'Low',
  },
  headline: {
    detectedIn: (subject, aoi) => `${subject} detected in ${aoi}`,
    anchorWithBearing: (distance, bearing, anchor) =>
      `, ~${distance} ${bearing} of ${anchor}`,
    anchorWithoutBearing: (distance, anchor) =>
      `, ~${distance} of ${anchor}`,
    anchorNear: (anchor) => `, near ${anchor}`,
    duration: (duration) => `, last ${duration}`,
    sensorsConfirmSingular: () => '1 sensor confirms',
    sensorsConfirmPlural: (n) => `${n} sensors confirm`,
    fusedAgree: (n, score) => `${n} sensors agree → ${score}`,
    fusedSingle: (score) => `Single-sensor reading ${score}`,
  },
  formatting: {
    distanceMeters: (m) => `${Math.round(m)} m`,
    distanceKmOneDecimal: (km) => `${km} km`,
    distanceKmRound: (km) => `${km} km`,
    durationSec: (s) => `${s} s`,
    durationMin: (m) => `${m} min`,
    durationHour: (h) => `${h} h`,
    durationDay: (d) => `${d} d`,
  },
};
