import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { useAoiStore } from '@/store/aoiStore';
import { createAoi, type AoiPolygon } from '@/api/aoi';
import { GlyphLayer } from '@/components/map/GlyphLayer';

const DEFAULT_CENTER: [number, number] = [88.17, 21.96];
const DEFAULT_ZOOM = 10;
const MAP_STYLE = 'https://demotiles.maplibre.org/style.json';

interface DrawCreateEvent {
  features: GeoJSON.Feature[];
}

export const AoiMap = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<InstanceType<typeof MapboxDraw> | null>(null);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
  const { aois, activeAoiId, addAoi, setActiveAoi } = useAoiStore();

  // Initialise map once
  useEffect(() => {
    if (mapContainerRef.current === null) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: false, trash: true },
    });

    // MapboxDraw expects a mapbox-style map; cast to satisfy the type
    map.addControl(draw as unknown as maplibregl.IControl);
    drawRef.current = draw;
    mapRef.current = map;
    map.once('load', () => setMapInstance(map));

    const handleDrawCreate = (e: DrawCreateEvent): void => {
      const feature = e.features[0];
      if (feature === undefined) return;
      const geometry = feature.geometry as AoiPolygon;

      const name = window.prompt('Enter a name for this AOI:');
      if (name === null || name.trim() === '') {
        draw.deleteAll();
        return;
      }

      createAoi({ name: name.trim(), geometry })
        .then(({ aoi }) => {
          addAoi(aoi);
          draw.deleteAll();
        })
        .catch(() => {
          window.alert('Failed to save AOI. Please try again.');
          draw.deleteAll();
        });
    };

    map.on('draw.create', handleDrawCreate as (e: object) => void);

    return () => {
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
      setMapInstance(null);
    };
  }, [addAoi]);

  // Sync AOI layers whenever aois list changes
  useEffect(() => {
    const map = mapRef.current;
    if (map === null || !map.isStyleLoaded()) return;

    // Remove stale layers/sources
    const existingLayers = map.getStyle().layers ?? [];
    existingLayers.forEach((layer) => {
      if (layer.id.startsWith('aoi-fill-') || layer.id.startsWith('aoi-outline-')) {
        map.removeLayer(layer.id);
      }
    });

    const style = map.getStyle();
    Object.keys(style.sources ?? {}).forEach((srcId) => {
      if (srcId.startsWith('aoi-src-')) {
        map.removeSource(srcId);
      }
    });

    // Add current AOIs
    aois.forEach((aoi) => {
      const srcId = `aoi-src-${aoi.id}`;
      const fillId = `aoi-fill-${aoi.id}`;
      const outlineId = `aoi-outline-${aoi.id}`;
      const isActive = aoi.id === activeAoiId;

      map.addSource(srcId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: aoi.geometry,
          properties: { id: aoi.id, name: aoi.name },
        },
      });

      map.addLayer({
        id: fillId,
        type: 'fill',
        source: srcId,
        paint: {
          'fill-color': isActive ? '#3b82f6' : '#6366f1',
          'fill-opacity': isActive ? 0.4 : 0.25,
        },
      });

      map.addLayer({
        id: outlineId,
        type: 'line',
        source: srcId,
        paint: {
          'line-color': isActive ? '#93c5fd' : '#a5b4fc',
          'line-width': isActive ? 2.5 : 1.5,
        },
      });

      map.on('click', fillId, () => {
        setActiveAoi(aoi.id);
      });
    });
  }, [aois, activeAoiId, setActiveAoi]);

  const handleDrawPolygon = (): void => {
    drawRef.current?.changeMode('draw_polygon');
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />

      <div className="absolute top-3 left-3 z-10">
        <button
          onClick={handleDrawPolygon}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Draw AOI
        </button>
      </div>

      {activeAoiId !== null && (
        <GlyphLayer aoiId={activeAoiId} map={mapInstance} />
      )}
    </div>
  );
};
