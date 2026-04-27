// Illustrative SVG icons for the operator drawer / mini-map.
// Per TASK-043 §7: "Show, don't waveform." Sensor outputs are translated
// into illustrative geo-anchored visuals — never raw waveforms in the
// operator path.

import type { Classification, SensorType } from '@shared/types';
import { t } from '@/i18n';

interface IconProps {
  size?: number;
  color?: string;
}

const Tunnel = ({ size = 24, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M3 20 L3 14 A9 9 0 0 1 21 14 L21 20"
      stroke={color}
      strokeWidth="1.5"
      fill="none"
    />
    <path d="M3 20 L21 20" stroke={color} strokeWidth="1.5" />
    <circle cx="12" cy="17" r="1.5" fill={color} />
  </svg>
);

const Footsteps = ({ size = 24, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <ellipse cx="8" cy="8" rx="2.5" ry="3.5" fill={color} />
    <ellipse cx="9" cy="13.5" rx="1.2" ry="1.5" fill={color} />
    <ellipse cx="15" cy="14" rx="2.5" ry="3.5" fill={color} />
    <ellipse cx="14" cy="19.5" rx="1.2" ry="1.5" fill={color} />
  </svg>
);

const FootstepsGroup = ({ size = 24, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <ellipse cx="6" cy="9" rx="2" ry="3" fill={color} />
    <ellipse cx="11" cy="9" rx="2" ry="3" fill={color} />
    <ellipse cx="16" cy="9" rx="2" ry="3" fill={color} />
    <ellipse cx="9" cy="16" rx="2" ry="3" fill={color} opacity="0.7" />
    <ellipse cx="14" cy="16" rx="2" ry="3" fill={color} opacity="0.7" />
  </svg>
);

const Vehicle = ({ size = 24, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M3 14 L3 11 L6 6 L18 6 L21 11 L21 14"
      fill={color}
      opacity="0.9"
    />
    <rect x="2" y="14" width="20" height="3" fill={color} />
    <circle cx="7" cy="18" r="1.8" fill={color} />
    <circle cx="17" cy="18" r="1.8" fill={color} />
  </svg>
);

const Animal = ({ size = 24, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M5 14 L5 11 L8 8 L8 5 L10 5 L10 8 L14 8 L14 5 L16 5 L16 8 L19 11 L19 14 L17 17 L7 17 L5 14 Z"
      fill={color}
      opacity="0.9"
    />
    <circle cx="9" cy="11" r="0.8" fill="white" />
    <circle cx="15" cy="11" r="0.8" fill="white" />
  </svg>
);

const Human = ({ size = 24, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="6" r="3" fill={color} />
    <path d="M6 22 L6 14 A6 6 0 0 1 18 14 L18 22 Z" fill={color} />
  </svg>
);

const Voice = ({ size = 24, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 8 L4 14 L8 14 L13 18 L13 4 L8 8 Z"
      fill={color}
    />
    <path
      d="M16 9 A4 4 0 0 1 16 15"
      stroke={color}
      strokeWidth="1.5"
      fill="none"
    />
  </svg>
);

const Gunshot = ({ size = 24, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="3" fill={color} />
    <path
      d="M12 2 L12 6 M12 18 L12 22 M2 12 L6 12 M18 12 L22 12 M5 5 L8 8 M16 16 L19 19 M5 19 L8 16 M16 8 L19 5"
      stroke={color}
      strokeWidth="1.5"
    />
  </svg>
);

const Drone = ({ size = 24, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="6" cy="6" r="2.5" fill={color} opacity="0.7" />
    <circle cx="18" cy="6" r="2.5" fill={color} opacity="0.7" />
    <circle cx="6" cy="18" r="2.5" fill={color} opacity="0.7" />
    <circle cx="18" cy="18" r="2.5" fill={color} opacity="0.7" />
    <rect x="9" y="9" width="6" height="6" rx="1" fill={color} />
  </svg>
);

const HotSpot = ({ size = 24, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 3 C8 8 7 11 7 14 A5 5 0 0 0 17 14 C17 11 16 8 12 3 Z"
      fill={color}
    />
  </svg>
);

const Unknown = ({ size = 24, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" fill="none" />
    <text x="12" y="16" textAnchor="middle" fill={color} fontSize="12" fontFamily="monospace">?</text>
  </svg>
);

// ── Lookup ─────────────────────────────────────────────────────────────────

const ICON_BY_CLASSIFICATION: Record<Classification, (p: IconProps) => JSX.Element> = {
  tunneling:         Tunnel,
  footsteps_single:  Footsteps,
  footsteps_group:   FootstepsGroup,
  vehicle:           Vehicle,
  animal:            Animal,
  voices:            Voice,
  gunshot:           Gunshot,
  engine:            Vehicle,
  generator:         Voice,
  livestock:         Animal,
  human_presence:    Human,
  group_presence:    FootstepsGroup,
  hot_spot:          HotSpot,
  intrusion:         Human,
  tripwire_crossing: Human,
  drone:             Drone,
  object_unknown:    Unknown,
  ambient:           Unknown,
};

interface IllustrativeIconProps {
  classification: Classification;
  size?: number;
  color?: string;
  className?: string;
}

export const IllustrativeIcon = ({
  classification,
  size,
  color,
  className,
}: IllustrativeIconProps) => {
  const Component = ICON_BY_CLASSIFICATION[classification];
  return (
    <span className={className} aria-hidden="true">
      <Component size={size} color={color} />
    </span>
  );
};

// Sensor-type indicator — used in the contributing-sensors list. Compact
// glyph + label. Sensor labels resolve through the i18n dictionary.

const SensorSeismic = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M2 10 L5 10 L7 4 L9 16 L11 6 L13 14 L15 10 L18 10" stroke={color} strokeWidth="1.5" fill="none" />
  </svg>
);

const SensorAcoustic = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M3 7 L3 13 L7 13 L11 17 L11 3 L7 7 Z" fill={color} />
    <path d="M14 8 A3 3 0 0 1 14 12" stroke={color} strokeWidth="1.5" fill="none" />
  </svg>
);

const SensorThermal = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 2 C7 7 6 10 6 12 A4 4 0 0 0 14 12 C14 10 13 7 10 2 Z" fill={color} />
  </svg>
);

const SensorLidar = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="10" cy="10" r="2" fill={color} />
    <path d="M10 10 L18 6 M10 10 L18 14 M10 10 L2 8 M10 10 L2 12" stroke={color} strokeWidth="1.2" />
  </svg>
);

const SensorCamera = ({ size = 20, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="2" y="6" width="12" height="9" rx="1.5" fill={color} />
    <path d="M14 9 L18 6 L18 15 L14 12 Z" fill={color} />
  </svg>
);

const SENSOR_ICON: Record<SensorType, (p: IconProps) => JSX.Element> = {
  seismic:  SensorSeismic,
  acoustic: SensorAcoustic,
  thermal:  SensorThermal,
  lidar:    SensorLidar,
  camera:   SensorCamera,
};

interface SensorIconProps {
  sensorType: SensorType;
  size?: number;
  color?: string;
  className?: string;
}

export const SensorTypeIcon = ({
  sensorType,
  size,
  color,
  className,
}: SensorIconProps) => {
  const Component = SENSOR_ICON[sensorType];
  return (
    <span className={className} aria-label={t().sensor[sensorType]} role="img">
      <Component size={size} color={color} />
    </span>
  );
};

export const sensorTypeLabel = (s: SensorType): string => t().sensor[s];
