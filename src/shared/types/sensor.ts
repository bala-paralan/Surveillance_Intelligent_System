// Canonical sensor taxonomy shared between frontend, backend, and analytics.
// Operator-facing labels — never expose ports, families, RTSP, or RAW signal
// names through these types. Engineering-only fields live elsewhere.

export type SensorType =
  | 'seismic'
  | 'acoustic'
  | 'thermal'
  | 'lidar'
  | 'camera';

export const SENSOR_TYPES: readonly SensorType[] = [
  'seismic',
  'acoustic',
  'thermal',
  'lidar',
  'camera',
] as const;

// Operator-facing classification labels. Keep stable — used in headline
// templates, severity rules, and i18n keys.
export type Classification =
  | 'tunneling'
  | 'footsteps_single'
  | 'footsteps_group'
  | 'vehicle'
  | 'animal'
  | 'voices'
  | 'gunshot'
  | 'engine'
  | 'generator'
  | 'livestock'
  | 'human_presence'
  | 'group_presence'
  | 'hot_spot'
  | 'intrusion'
  | 'tripwire_crossing'
  | 'drone'
  | 'object_unknown'
  | 'ambient';

export const CLASSIFICATION_HUMAN: ReadonlyArray<Classification> = [
  'footsteps_single',
  'footsteps_group',
  'human_presence',
  'group_presence',
  'voices',
];

export const CLASSIFICATION_VEHICLE: ReadonlyArray<Classification> = [
  'vehicle',
  'engine',
];

export const CLASSIFICATION_ARMED: ReadonlyArray<Classification> = ['gunshot'];

export const CLASSIFICATION_TUNNEL: ReadonlyArray<Classification> = ['tunneling'];

// Subset of classifications that, given enough confidence and corroboration,
// represent the highest-priority threats per TASK-043 §8.
export const CLASSIFICATION_CRITICAL_FAMILY: ReadonlyArray<Classification> = [
  'tunneling',
  'vehicle',
  'gunshot',
];
