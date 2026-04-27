// Geo-anchored headline sentence generator — TASK-043 §8.
//
// Template:
//   `<Classification> detected in <AOI/Sector>, ~<distance> from <anchor>,
//    last <duration>. <N> sensors confirm.`
//
// Pure functions. All operator-facing strings flow through the i18n module
// (TASK-043 §12) so headline phrases and use-case labels are translatable.

import type { Classification, Threat } from '@shared/types';
import { t } from '@/i18n';

// ── Classification label (i18n-resolved) ────────────────────────────────────

export const classificationLabel = (c: Classification): string =>
  t().classification[c];

// ── Distance formatting ─────────────────────────────────────────────────────

export const formatDistance = (meters: number): string => {
  const f = t().formatting;
  if (!Number.isFinite(meters) || meters < 0) return f.distanceMeters(0);
  if (meters < 1000) return f.distanceMeters(meters);
  const km = meters / 1000;
  // 1 decimal up to 10 km, 0 decimals beyond.
  return km < 10
    ? f.distanceKmOneDecimal(km.toFixed(1))
    : f.distanceKmRound(Math.round(km));
};

// ── Bearing → cardinal (8 sectors) ──────────────────────────────────────────

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

export const formatBearing = (deg: number | undefined): string | null => {
  if (deg === undefined || !Number.isFinite(deg)) return null;
  const norm = ((deg % 360) + 360) % 360;
  const sector = Math.round(norm / 45) % 8;
  return CARDINALS[sector] ?? null;
};

// ── Duration formatting ─────────────────────────────────────────────────────

export const formatDuration = (seconds: number | undefined): string | null => {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) return null;
  const f = t().formatting;
  if (seconds < 60)   return f.durationSec(Math.round(seconds));
  const minutes = Math.round(seconds / 60);
  if (minutes < 60)   return f.durationMin(minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24)     return f.durationHour(hours);
  return f.durationDay(Math.round(hours / 24));
};

// ── Sensor-count phrase ─────────────────────────────────────────────────────

export const sensorsConfirmPhrase = (count: number): string => {
  if (count <= 0) return '';
  const h = t().headline;
  return count === 1 ? h.sensorsConfirmSingular() : h.sensorsConfirmPlural(count);
};

// ── Headline assembly ───────────────────────────────────────────────────────

export interface HeadlineContext {
  // Operator label for the AOI / sector (e.g. "Sector A-2").
  aoiLabel: string;
  // Operator label for the anchor sensor (e.g. "Sensor S-07"). Undefined =>
  // omits the "from <anchor>" clause and falls back to the AOI label.
  anchorLabel?: string;
  // Distance from the anchor to the threat centroid, in metres.
  anchorDistanceM?: number;
  // Bearing from the anchor to the threat, in degrees (0 = north, CW).
  // Per Q3 of §14: only advanced sensors carry direction. Omit when absent.
  anchorBearingDeg?: number;
}

export const buildHeadline = (threat: Threat, ctx: HeadlineContext): string => {
  const h = t().headline;
  const subject = classificationLabel(threat.classification);
  const head = h.detectedIn(subject, ctx.aoiLabel);

  const anchorClause = (() => {
    if (ctx.anchorLabel === undefined) return '';
    if (ctx.anchorDistanceM === undefined) return h.anchorNear(ctx.anchorLabel);
    const distance = formatDistance(ctx.anchorDistanceM);
    const bearing = formatBearing(ctx.anchorBearingDeg);
    return bearing !== null
      ? h.anchorWithBearing(distance, bearing, ctx.anchorLabel)
      : h.anchorWithoutBearing(distance, ctx.anchorLabel);
  })();

  const durationClause = (() => {
    const d = formatDuration(threat.duration_s);
    return d !== null ? h.duration(d) : '';
  })();

  const sensorsClause = (() => {
    const phrase = sensorsConfirmPhrase(threat.contributions.length);
    return phrase === '' ? '.' : `. ${phrase}.`;
  })();

  return `${head}${anchorClause}${durationClause}${sensorsClause}`;
};

// ── Fused-score explanation for the drawer ──────────────────────────────────

// Returns the second-line explanation: "3 sensors agree → 0.91" or
// "Single-sensor reading 0.62".
export const fusedScoreExplanation = (threat: Threat): string => {
  const h = t().headline;
  const n = threat.contributions.length;
  const score = threat.fused_score.toFixed(2);
  return n <= 1 ? h.fusedSingle(score) : h.fusedAgree(n, score);
};
