// Per-sensor map glyph — TASK-043 §7.1–7.5.
//
// Each sensor type has a distinct visual idiom built around the same
// data contract (what / where / when / confidence / use-case match).
// Per §11 the operator path NEVER renders raw waveforms or radiometric
// matrices; this component only shows illustrative geometry.
//
// Per Q3 of §14, direction_deg is only available on advanced sensors.
// When absent, seismic falls back to ring-only (no arrow), and acoustic
// falls back to a 360° reach circle (no cone).
//
// This produces a self-contained SVG element used as the visual content
// of a maplibre HTML marker. (True geo-anchored layers — Polygon Sources
// for cones / footprints / fences — are deferred until the sensor catalog
// is wired into the map layer.)

import type { Classification, SensorType } from '@shared/types';

export interface SensorGlyphProps {
  sensorType: SensorType;
  classification: Classification;
  confidence: number;
  /** Optional — only emitted by advanced sensors (Q3). */
  bearingDeg?: number;
  /** Optional cone/sweep arc width in degrees, defaults per sensor. */
  arcDeg?: number;
  /** Recent / continuous detections pulse the glyph. */
  continuous?: boolean;
  size?: number;
}

const confidenceColor = (c: number): string => {
  if (c >= 0.8) return '#22c55e';
  if (c >= 0.5) return '#eab308';
  return '#ef4444';
};

// Build a sector-arc path covering arcDeg degrees centred on bearingDeg.
const sectorPath = (
  cx: number,
  cy: number,
  r: number,
  bearingDeg: number,
  arcDeg: number,
): string => {
  const halfArc = arcDeg / 2;
  // 0° = N (up), CW. SVG y axis is inverted.
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const a1 = toRad(bearingDeg - halfArc);
  const a2 = toRad(bearingDeg + halfArc);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2);
  const y2 = cy + r * Math.sin(a2);
  const largeArc = arcDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
};

// ── Inner per-classification icon (small overlay) ───────────────────────────

const innerIcon = (
  classification: Classification,
  cx: number,
  cy: number,
  color: string,
): JSX.Element | null => {
  switch (classification) {
    case 'tunneling':
      return (
        <path
          d={`M ${cx - 8} ${cy + 6} L ${cx - 8} ${cy} A 8 8 0 0 1 ${cx + 8} ${cy} L ${cx + 8} ${cy + 6}`}
          stroke={color}
          strokeWidth="1.5"
          fill="none"
        />
      );
    case 'footsteps_single':
    case 'human_presence':
      return (
        <>
          <ellipse cx={cx - 3} cy={cy - 1} rx="1.6" ry="2.2" fill={color} />
          <ellipse cx={cx + 3} cy={cy + 2} rx="1.6" ry="2.2" fill={color} />
        </>
      );
    case 'footsteps_group':
    case 'group_presence':
      return (
        <>
          <ellipse cx={cx - 4} cy={cy - 1} rx="1.4" ry="2" fill={color} />
          <ellipse cx={cx} cy={cy - 1} rx="1.4" ry="2" fill={color} />
          <ellipse cx={cx + 4} cy={cy - 1} rx="1.4" ry="2" fill={color} />
        </>
      );
    case 'vehicle':
    case 'engine':
      return (
        <rect x={cx - 6} y={cy - 3} width="12" height="6" rx="1.5" fill={color} />
      );
    case 'animal':
    case 'livestock':
      return (
        <path
          d={`M ${cx - 5} ${cy + 2} L ${cx - 5} ${cy - 1} L ${cx - 3} ${cy - 4} L ${cx + 3} ${cy - 4} L ${cx + 5} ${cy - 1} L ${cx + 5} ${cy + 2} Z`}
          fill={color}
        />
      );
    case 'voices':
      return (
        <path
          d={`M ${cx - 6} ${cy - 3} L ${cx - 2} ${cy - 3} L ${cx + 2} ${cy + 1} L ${cx + 2} ${cy - 5} L ${cx - 2} ${cy - 3}`}
          fill={color}
        />
      );
    case 'gunshot':
      return (
        <>
          <circle cx={cx} cy={cy} r="3" fill={color} />
          <line x1={cx} y1={cy - 6} x2={cx} y2={cy - 4} stroke={color} strokeWidth="1.2" />
          <line x1={cx} y1={cy + 4} x2={cx} y2={cy + 6} stroke={color} strokeWidth="1.2" />
          <line x1={cx - 6} y1={cy} x2={cx - 4} y2={cy} stroke={color} strokeWidth="1.2" />
          <line x1={cx + 4} y1={cy} x2={cx + 6} y2={cy} stroke={color} strokeWidth="1.2" />
        </>
      );
    case 'drone':
      return (
        <>
          <circle cx={cx - 5} cy={cy - 5} r="1.5" fill={color} />
          <circle cx={cx + 5} cy={cy - 5} r="1.5" fill={color} />
          <circle cx={cx - 5} cy={cy + 5} r="1.5" fill={color} />
          <circle cx={cx + 5} cy={cy + 5} r="1.5" fill={color} />
          <rect x={cx - 2} y={cy - 2} width="4" height="4" rx="0.5" fill={color} />
        </>
      );
    case 'hot_spot':
      return (
        <path
          d={`M ${cx} ${cy - 5} C ${cx - 3} ${cy - 1} ${cx - 4} ${cy + 2} ${cx} ${cy + 5} C ${cx + 4} ${cy + 2} ${cx + 3} ${cy - 1} ${cx} ${cy - 5} Z`}
          fill={color}
        />
      );
    default:
      return null;
  }
};

// ── Per-sensor visual idiom ─────────────────────────────────────────────────

interface IdiomCtx {
  cx: number;
  cy: number;
  r: number;
  color: string;
  bearingDeg?: number;
  arcDeg: number;
}

const seismicIdiom = (ctx: IdiomCtx): JSX.Element => (
  <g>
    {/* Distance estimate ring */}
    <circle
      cx={ctx.cx}
      cy={ctx.cy}
      r={ctx.r}
      fill={ctx.color}
      fillOpacity="0.12"
      stroke={ctx.color}
      strokeWidth="1.5"
      strokeDasharray="3 3"
    />
    {/* Direction arrow — only when advanced sensor reports bearing (Q3) */}
    {ctx.bearingDeg !== undefined && (() => {
      const rad = ((ctx.bearingDeg - 90) * Math.PI) / 180;
      const tx = ctx.cx + (ctx.r + 4) * Math.cos(rad);
      const ty = ctx.cy + (ctx.r + 4) * Math.sin(rad);
      return (
        <>
          <line x1={ctx.cx} y1={ctx.cy} x2={tx} y2={ty} stroke={ctx.color} strokeWidth="2" />
          <polygon
            points={`${tx},${ty} ${tx - 5},${ty - 2} ${tx - 5},${ty + 2}`}
            fill={ctx.color}
            transform={`rotate(${ctx.bearingDeg}, ${tx}, ${ty})`}
          />
        </>
      );
    })()}
  </g>
);

const acousticIdiom = (ctx: IdiomCtx): JSX.Element => {
  if (ctx.bearingDeg === undefined) {
    // Q3 fallback — no bearing → 360° reach circle
    return (
      <circle
        cx={ctx.cx}
        cy={ctx.cy}
        r={ctx.r}
        fill={ctx.color}
        fillOpacity="0.18"
        stroke={ctx.color}
        strokeWidth="1.5"
      />
    );
  }
  return (
    <path
      d={sectorPath(ctx.cx, ctx.cy, ctx.r, ctx.bearingDeg, ctx.arcDeg)}
      fill={ctx.color}
      fillOpacity="0.25"
      stroke={ctx.color}
      strokeWidth="1.5"
    />
  );
};

const thermalIdiom = (ctx: IdiomCtx): JSX.Element => {
  // Sensor footprint as a polygon (truncated cone). Bearing optional.
  const bearing = ctx.bearingDeg ?? 0;
  return (
    <g>
      <path
        d={sectorPath(ctx.cx, ctx.cy, ctx.r, bearing, 60)}
        fill={ctx.color}
        fillOpacity="0.18"
        stroke={ctx.color}
        strokeWidth="1.2"
        strokeDasharray="2 2"
      />
      {/* Heat blob — sized by confidence (visual proxy for target size) */}
      <circle
        cx={ctx.cx}
        cy={ctx.cy}
        r={Math.max(4, ctx.r * 0.18)}
        fill={ctx.color}
        fillOpacity="0.85"
      />
    </g>
  );
};

const lidarIdiom = (ctx: IdiomCtx): JSX.Element => {
  // Footprint + virtual fence (chord across the footprint).
  const bearing = ctx.bearingDeg ?? 0;
  const fenceRad = ((bearing - 90) * Math.PI) / 180;
  const fx1 = ctx.cx + ctx.r * Math.cos(fenceRad - Math.PI / 4);
  const fy1 = ctx.cy + ctx.r * Math.sin(fenceRad - Math.PI / 4);
  const fx2 = ctx.cx + ctx.r * Math.cos(fenceRad + Math.PI / 4);
  const fy2 = ctx.cy + ctx.r * Math.sin(fenceRad + Math.PI / 4);
  return (
    <g>
      <path
        d={sectorPath(ctx.cx, ctx.cy, ctx.r, bearing, 90)}
        fill={ctx.color}
        fillOpacity="0.10"
        stroke={ctx.color}
        strokeWidth="1.2"
      />
      <line x1={fx1} y1={fy1} x2={fx2} y2={fy2} stroke={ctx.color} strokeWidth="2" strokeDasharray="4 2" />
    </g>
  );
};

const cameraIdiom = (ctx: IdiomCtx): JSX.Element => {
  const bearing = ctx.bearingDeg ?? 0;
  return (
    <path
      d={sectorPath(ctx.cx, ctx.cy, ctx.r, bearing, 70)}
      fill={ctx.color}
      fillOpacity="0.22"
      stroke={ctx.color}
      strokeWidth="1.5"
    />
  );
};

const SENSOR_IDIOM: Record<SensorType, (ctx: IdiomCtx) => JSX.Element> = {
  seismic:  seismicIdiom,
  acoustic: acousticIdiom,
  thermal:  thermalIdiom,
  lidar:    lidarIdiom,
  camera:   cameraIdiom,
};

const DEFAULT_ARC: Record<SensorType, number> = {
  seismic:  0,   // ring only
  acoustic: 60,
  thermal:  60,
  lidar:    90,
  camera:   70,
};

// ── Public component ────────────────────────────────────────────────────────

export const SensorGlyph = ({
  sensorType,
  classification,
  confidence,
  bearingDeg,
  arcDeg,
  continuous,
  size = 64,
}: SensorGlyphProps) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;
  const color = confidenceColor(confidence);
  const finalArc = arcDeg ?? DEFAULT_ARC[sensorType];

  const Idiom = SENSOR_IDIOM[sensorType];

  return (
    <span
      className={continuous === true ? 'glyph-pulse' : undefined}
      role="img"
      aria-label={`${sensorType} sensor — ${classification}, confidence ${Math.round(confidence * 100)}%`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <Idiom
          cx={cx}
          cy={cy}
          r={r}
          color={color}
          bearingDeg={bearingDeg}
          arcDeg={finalArc}
        />
        {/* Centre dot for the sensor */}
        <circle cx={cx} cy={cy} r="3" fill={color} />
        {/* Classification icon overlay */}
        {innerIcon(classification, cx, cy + 1, color)}
      </svg>
    </span>
  );
};

// HTML/string variant — for use inside maplibre Marker `element` where the
// content is mounted via innerHTML rather than React. Keeps the SVG visual
// in lockstep with the React component above.
export const sensorGlyphHtml = (props: SensorGlyphProps): string => {
  const size = props.size ?? 64;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;
  const color = confidenceColor(props.confidence);
  const arc = props.arcDeg ?? DEFAULT_ARC[props.sensorType];
  const bearing = props.bearingDeg;
  const cls = props.continuous === true ? 'glyph-pulse' : '';

  const idiomSvg = (() => {
    switch (props.sensorType) {
      case 'seismic': {
        const arrow = bearing !== undefined
          ? (() => {
              const rad = ((bearing - 90) * Math.PI) / 180;
              const tx = cx + (r + 4) * Math.cos(rad);
              const ty = cy + (r + 4) * Math.sin(rad);
              return `<line x1="${cx}" y1="${cy}" x2="${tx}" y2="${ty}" stroke="${color}" stroke-width="2"/>
                <polygon points="${tx},${ty} ${tx - 5},${ty - 2} ${tx - 5},${ty + 2}" fill="${color}" transform="rotate(${bearing}, ${tx}, ${ty})"/>`;
            })()
          : '';
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="1.5" stroke-dasharray="3 3"/>${arrow}`;
      }
      case 'acoustic':
        if (bearing === undefined) {
          return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="1.5"/>`;
        }
        return `<path d="${sectorPath(cx, cy, r, bearing, arc)}" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="1.5"/>`;
      case 'thermal': {
        const b = bearing ?? 0;
        return `<path d="${sectorPath(cx, cy, r, b, 60)}" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="1.2" stroke-dasharray="2 2"/>
          <circle cx="${cx}" cy="${cy}" r="${Math.max(4, r * 0.18)}" fill="${color}" fill-opacity="0.85"/>`;
      }
      case 'lidar': {
        const b = bearing ?? 0;
        const fenceRad = ((b - 90) * Math.PI) / 180;
        const fx1 = cx + r * Math.cos(fenceRad - Math.PI / 4);
        const fy1 = cy + r * Math.sin(fenceRad - Math.PI / 4);
        const fx2 = cx + r * Math.cos(fenceRad + Math.PI / 4);
        const fy2 = cy + r * Math.sin(fenceRad + Math.PI / 4);
        return `<path d="${sectorPath(cx, cy, r, b, 90)}" fill="${color}" fill-opacity="0.10" stroke="${color}" stroke-width="1.2"/>
          <line x1="${fx1}" y1="${fy1}" x2="${fx2}" y2="${fy2}" stroke="${color}" stroke-width="2" stroke-dasharray="4 2"/>`;
      }
      case 'camera': {
        const b = bearing ?? 0;
        return `<path d="${sectorPath(cx, cy, r, b, 70)}" fill="${color}" fill-opacity="0.22" stroke="${color}" stroke-width="1.5"/>`;
      }
      default:
        return '';
    }
  })();

  return `
    <span class="${cls}" role="img" aria-label="${props.sensorType} sensor — ${props.classification}">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        ${idiomSvg}
        <circle cx="${cx}" cy="${cy}" r="3" fill="${color}"/>
      </svg>
    </span>`;
};
