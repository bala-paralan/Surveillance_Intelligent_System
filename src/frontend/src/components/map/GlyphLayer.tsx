import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useQuery } from '@tanstack/react-query';
import { listOutcomes } from '@/api/fusion';
import type { FusionOutcome, GlyphType } from '@/api/fusion';
import { useGlyphStore } from '@/store/glyphStore';

// ── Props ─────────────────────────────────────────────────────────────────────

interface GlyphLayerProps {
  aoiId: string;
  map: maplibregl.Map | null;
}

// ── Glyph SVG / label helpers ─────────────────────────────────────────────────

const confidenceColor = (confidence: number): string => {
  if (confidence >= 0.8) return '#22c55e'; // green
  if (confidence >= 0.5) return '#eab308'; // yellow
  return '#ef4444'; // red
};

const glyphSvgHtml = (
  glyph: GlyphType,
  confidence: number,
  count?: number,
): string => {
  const color = confidenceColor(confidence);

  switch (glyph) {
    case 'footstep_radius':
      return `
        <div
          class="glyph-pulse"
          style="
            width: 32px; height: 32px;
            border-radius: 50%;
            background: ${color};
            opacity: 0.8;
            display: flex; align-items: center; justify-content: center;
          "
        ></div>`;

    case 'tunnel':
      return `
        <div style="font-size:20px; line-height:1; display:flex; align-items:center; justify-content:center;">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="14,4 26,24 2,24" fill="${color}" opacity="0.9"/>
          </svg>
        </div>`;

    case 'vehicle':
      return `
        <div style="display:flex; align-items:center; justify-content:center;">
          <svg width="30" height="20" viewBox="0 0 30 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="28" height="18" rx="3" fill="${color}" opacity="0.9"/>
          </svg>
        </div>`;

    case 'gunshot':
      return `
        <div style="display:flex; align-items:center; justify-content:center;">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="14" cy="14" r="10" fill="${color}" opacity="0.85"/>
            <line x1="14" y1="4" x2="14" y2="8" stroke="white" stroke-width="2"/>
            <line x1="14" y1="20" x2="14" y2="24" stroke="white" stroke-width="2"/>
            <line x1="4" y1="14" x2="8" y2="14" stroke="white" stroke-width="2"/>
            <line x1="20" y1="14" x2="24" y2="14" stroke="white" stroke-width="2"/>
          </svg>
        </div>`;

    case 'drone':
      return `
        <div style="display:flex; align-items:center; justify-content:center;">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="14,2 26,9 26,19 14,26 2,19 2,9" fill="${color}" opacity="0.9"/>
          </svg>
        </div>`;

    case 'animal':
      return `
        <div style="font-size:20px; line-height:1; display:flex; align-items:center; justify-content:center; color:${color};">
          &#9670;
        </div>`;

    default: {
      // human / group / unknown
      const isGroup = count !== undefined && count > 1;
      return `
        <div style="position:relative; display:flex; align-items:center; justify-content:center; font-size:20px; color:${color};">
          &#128100;
          ${isGroup ? `<span style="position:absolute; top:-6px; right:-10px; background:${color}; color:#111; font-size:10px; font-weight:bold; border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center;">${count}</span>` : ''}
        </div>`;
    }
  }
};

// ── GlyphLayer ────────────────────────────────────────────────────────────────

export const GlyphLayer = ({ aoiId, map }: GlyphLayerProps) => {
  const { addGlyph, purgeStale, glyphs } = useGlyphStore();
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  // Poll outcomes every 5s
  const { data } = useQuery({
    queryKey: ['fusion-outcomes', aoiId],
    queryFn: () => listOutcomes(aoiId, { limit: 20 }),
    refetchInterval: 5_000,
    staleTime: 4_000,
    enabled: map !== null,
  });

  // Add new glyphs to store when data arrives
  useEffect(() => {
    if (data === undefined) return;
    data.outcomes.forEach((outcome: FusionOutcome) => {
      addGlyph(outcome);
    });
  }, [data, addGlyph]);

  // Purge stale glyphs every second
  useEffect(() => {
    const interval = setInterval(() => {
      purgeStale();
    }, 1_000);
    return () => clearInterval(interval);
  }, [purgeStale]);

  // Sync MapLibre markers whenever glyphs change
  useEffect(() => {
    if (map === null) return;

    const currentKeys = new Set<string>();

    glyphs.forEach((gs, key) => {
      if (!gs.visible) return;
      currentKeys.add(key);

      const { outcome } = gs;
      // We need a lng/lat — derive from last supporting event or use centre of map
      // Since FusionOutcome doesn't carry coordinates directly, use map centre as placeholder
      // Real integration would use a lookup table keyed by sensorId → location
      const centre = map.getCenter();

      if (markersRef.current.has(key)) return; // already added

      const el = document.createElement('div');
      el.innerHTML = glyphSvgHtml(
        outcome.renderHint.glyph,
        outcome.confidence,
        outcome.outcomeClass === 'group' ? outcome.supportingEventIds.length : undefined,
      );
      el.setAttribute(
        'aria-label',
        `${outcome.outcomeClass} — confidence ${Math.round(outcome.confidence * 100)}%`,
      );
      el.setAttribute('role', 'img');
      el.style.cursor = 'default';

      try {
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([centre.lng, centre.lat])
          .addTo(map);
        markersRef.current.set(key, marker);
      } catch {
        // Map may not be ready
      }
    });

    // Remove markers for stale glyphs
    markersRef.current.forEach((marker, key) => {
      if (!currentKeys.has(key)) {
        marker.remove();
        markersRef.current.delete(key);
      }
    });
  }, [glyphs, map]);

  // Cleanup markers on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
    };
  }, []);

  return null;
};
