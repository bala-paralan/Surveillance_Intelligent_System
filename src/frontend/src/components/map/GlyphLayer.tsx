import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useQuery } from '@tanstack/react-query';
import { listOutcomes } from '@/api/fusion';
import type { FusionOutcome } from '@/api/fusion';
import { useGlyphStore } from '@/store/glyphStore';
import { sensorGlyphHtml } from '@/components/map/SensorGlyph';
import {
  classificationFromOutcomeClass,
  sensorFromGlyph,
} from '@/api/threats';

// ── Props ─────────────────────────────────────────────────────────────────────

interface GlyphLayerProps {
  aoiId: string;
  map: maplibregl.Map | null;
}

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
      const sensorType = sensorFromGlyph(outcome.renderHint.glyph);
      const classification = classificationFromOutcomeClass(outcome.outcomeClass);
      // Continuous = multiple supporting detections, i.e. the event has been
      // observed more than once. Triggers the glyph-pulse animation per §7.1.
      const continuous = outcome.supportingEventIds.length > 1;
      el.innerHTML = sensorGlyphHtml({
        sensorType,
        classification,
        confidence: outcome.confidence,
        bearingDeg: outcome.renderHint.bearing_deg,
        arcDeg: outcome.renderHint.arc_deg,
        continuous,
        size: 64,
      });
      el.setAttribute(
        'aria-label',
        `${sensorType} sensor — ${classification}, confidence ${Math.round(outcome.confidence * 100)}%`,
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
