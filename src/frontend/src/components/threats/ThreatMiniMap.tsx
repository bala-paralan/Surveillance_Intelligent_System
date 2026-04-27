// Schematic mini-map for the Threat Detail Drawer.
//
// Renders an SVG showing the anchor sensor, the threat's coverage radius,
// an optional bearing arrow (Q3: only when direction_deg is supplied), and
// a centred illustrative icon for the classification.
//
// This is intentionally schematic — not a tiled basemap. It satisfies §5.3
// "geo context" requirement at low cost. A full embedded MapLibre instance
// can replace this if/when the operator workflow demands it.

import type { Threat } from '@shared/types';
import { IllustrativeIcon } from '@/components/threats/IllustrativeIcon';

interface ThreatMiniMapProps {
  threat: Threat;
  size?: number;
}

const SEVERITY_TINT: Record<Threat['severity'], string> = {
  CRITICAL: '#dc2626',
  HIGH:     '#f97316',
  MEDIUM:   '#facc15',
  LOW:      '#3b82f6',
};

export const ThreatMiniMap = ({ threat, size = 220 }: ThreatMiniMapProps) => {
  const tint = SEVERITY_TINT[threat.severity];
  const half = size / 2;
  const ringR = size * 0.35;
  const sensorR = 5;

  // Bearing → end point on a vector from centre at length ringR + 14.
  const bearing = threat.geo.direction_deg;
  const arrowEnd = (() => {
    if (bearing === undefined) return null;
    const rad = ((bearing - 90) * Math.PI) / 180; // 0° = N (up)
    const len = ringR + 18;
    return {
      x: half + len * Math.cos(rad),
      y: half + len * Math.sin(rad),
    };
  })();

  return (
    <div
      className="relative rounded-md overflow-hidden border border-gray-700"
      style={{ width: size, height: size }}
      aria-label="Threat geo context"
      role="img"
    >
      {/* Faint grid background */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
      >
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#374151" strokeWidth="0.5" />
          </pattern>
          <radialGradient id="ring-fade">
            <stop offset="0%" stopColor={tint} stopOpacity="0.25" />
            <stop offset="100%" stopColor={tint} stopOpacity="0.0" />
          </radialGradient>
        </defs>

        <rect width={size} height={size} fill="#111827" />
        <rect width={size} height={size} fill="url(#grid)" />

        {/* Compass cardinals */}
        <text x={half} y={12} textAnchor="middle" fill="#6b7280" fontSize="10">N</text>
        <text x={size - 6} y={half + 4} textAnchor="end" fill="#6b7280" fontSize="10">E</text>
        <text x={half} y={size - 4} textAnchor="middle" fill="#6b7280" fontSize="10">S</text>
        <text x={6} y={half + 4} textAnchor="start" fill="#6b7280" fontSize="10">W</text>

        {/* Coverage radius (uncertainty) */}
        <circle cx={half} cy={half} r={ringR} fill="url(#ring-fade)" stroke={tint} strokeWidth="1.5" strokeDasharray="3 3" />

        {/* Bearing arrow (only when direction_deg present, Q3) */}
        {arrowEnd !== null && (
          <g>
            <line
              x1={half}
              y1={half}
              x2={arrowEnd.x}
              y2={arrowEnd.y}
              stroke={tint}
              strokeWidth="2"
            />
            <polygon
              points={`${arrowEnd.x},${arrowEnd.y} ${arrowEnd.x - 6},${arrowEnd.y - 2} ${arrowEnd.x - 6},${arrowEnd.y + 2}`}
              fill={tint}
              transform={`rotate(${bearing}, ${arrowEnd.x}, ${arrowEnd.y})`}
            />
          </g>
        )}

        {/* Anchor sensor */}
        <circle cx={half} cy={half} r={sensorR + 2} fill="#1f2937" />
        <circle cx={half} cy={half} r={sensorR} fill={tint} />
      </svg>

      {/* Classification icon overlay (centred above the anchor) */}
      <div
        className="absolute"
        style={{
          left: half - 16,
          top: half - 38,
          color: tint,
        }}
      >
        <IllustrativeIcon classification={threat.classification} size={32} />
      </div>

      {/* Radius label */}
      {threat.geo.radius_m > 0 && (
        <div className="absolute bottom-1.5 right-2 text-[10px] text-gray-300 bg-gray-900/80 px-1.5 py-0.5 rounded">
          radius ≈ {Math.round(threat.geo.radius_m)} m
        </div>
      )}
    </div>
  );
};
