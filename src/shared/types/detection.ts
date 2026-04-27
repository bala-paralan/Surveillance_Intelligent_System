import type { Classification, SensorType } from '@shared/types/sensor';

// Geo-anchored event location reported by a single sensor.
//
// `radius_m` carries the sensor's distance estimate / coverage uncertainty —
// drawn as a ring on the map.
// `direction_deg` is optional. Per Q3 of TASK-043 §14, only advanced sensors
// report direction; the operator UI must default to ring-only when absent.
// 0° = north, clockwise.
export interface GeoPoint {
  lat: number;
  lon: number;
  radius_m: number;
  direction_deg?: number;
}

// A single-sensor detection — the §7.6 data contract. The operator UI never
// receives the raw waveform / radiometric matrix; engineering view fetches
// those separately via `evidence_ref`.
export interface Detection {
  detection_id: string;
  sensor_id: string;
  sensor_type: SensorType;
  aoi_id: string;
  geo: GeoPoint;
  classification: Classification;
  confidence: number;            // 0..1, single-sensor
  use_case_match: string;        // human-readable label, i18n key
  observed_at: string;           // ISO 8601
  duration_s?: number;           // continuous events
  evidence_ref?: string;         // RBAC-gated link to engineering raw signal
}
