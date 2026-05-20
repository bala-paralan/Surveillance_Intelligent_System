import { apiFetch } from '@/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type OutcomeClass =
  | 'animal'
  | 'human'
  | 'group'
  | 'vehicle'
  | 'drone'
  | 'gunshot'
  | 'tunnel'
  | 'unknown';

export type GlyphType =
  | 'footstep_radius'
  | 'tunnel'
  | 'vehicle'
  | 'gunshot'
  | 'drone'
  | 'animal'
  | 'unknown';

export interface RenderHint {
  glyph: GlyphType;
  radius_m?: number;
  bearing_deg?: number;
  arc_deg?: number;
  decay_s: number;
}

export interface FusionOutcome {
  id: string;
  aoiId: string;
  outcomeClass: OutcomeClass;
  confidence: number;
  supportingEventIds: string[];
  renderHint: RenderHint;
  firstSeen: string;
  lastSeen: string;
}

export interface FusionWeight {
  className: string;
  prior: number;
  likelihoods: Record<string, number>;
}

// ── Query helpers ─────────────────────────────────────────────────────────────

interface ListOutcomesParams {
  from?: string;
  to?: string;
  limit?: number;
}

const buildQuery = (params?: ListOutcomesParams): string => {
  if (params === undefined) return '';
  const entries: [string, string][] = [];
  if (params.from !== undefined) entries.push(['from', params.from]);
  if (params.to !== undefined) entries.push(['to', params.to]);
  if (params.limit !== undefined) entries.push(['limit', String(params.limit)]);
  if (entries.length === 0) return '';
  const qs = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `?${qs}`;
};

// ── API calls ─────────────────────────────────────────────────────────────────

export const listOutcomes = (
  aoiId: string,
  params?: ListOutcomesParams,
): Promise<{ outcomes: FusionOutcome[]; total: number }> =>
  apiFetch<{ outcomes: FusionOutcome[]; total: number }>(
    `/aoi/${aoiId}/outcomes${buildQuery(params)}`,
  );

export const getFusionWeights = (): Promise<{ weights: FusionWeight[] }> =>
  apiFetch<{ weights: FusionWeight[] }>('/fusion/weights');

export const updateFusionWeights = (
  body: FusionWeight,
): Promise<{ weights: FusionWeight[] }> =>
  apiFetch<{ weights: FusionWeight[] }>('/fusion/weights', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
