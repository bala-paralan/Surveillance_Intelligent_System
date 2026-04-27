// MapControls — TASK-043 §5.1 layer toggles + basemap switch.
//
// Operator-facing only. No tile keys / RTSP / port labels surface here.
// Tile licensing is out of scope (§13) — Satellite is gated until a
// licensed style URL is supplied via env.

import { useState } from 'react';

export type LayerKey = 'aoi' | 'assets' | 'detections' | 'threats';

export interface LayerVisibility {
  aoi: boolean;
  assets: boolean;
  detections: boolean;
  threats: boolean;
}

export const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  aoi:        true,
  assets:     true,
  detections: true,
  threats:    true,
};

export interface BasemapOption {
  id: string;
  label: string;
  styleUrl: string;
  // When the style requires a licensed key that isn't available, mark as
  // unavailable to disable the toggle and surface a tooltip explaining why.
  unavailable?: boolean;
}

// Tile licensing is out of scope for TASK-043 (§13). Satellite is gated
// until infra config provides a licensed style URL.
export const DEFAULT_BASEMAPS: BasemapOption[] = [
  {
    id: 'default',
    label: 'Default',
    styleUrl: 'https://demotiles.maplibre.org/style.json',
  },
  {
    id: 'osm',
    label: 'OSM',
    styleUrl: 'https://demotiles.maplibre.org/style.json', // placeholder — OSM raster style is added inline by AoiMap
  },
  { id: 'satellite', label: 'Satellite', styleUrl: '', unavailable: true },
];

interface MapControlsProps {
  visibility: LayerVisibility;
  onVisibilityChange: (v: LayerVisibility) => void;
  basemap: string;
  onBasemapChange: (id: string) => void;
  basemaps?: BasemapOption[];
}

const LAYER_LABEL: Record<LayerKey, string> = {
  aoi:        'AOI boundary',
  assets:     'Assets',
  detections: 'Detections',
  threats:    'Fused threats',
};

const LAYER_KEYS: ReadonlyArray<LayerKey> = ['aoi', 'assets', 'detections', 'threats'];

export const MapControls = ({
  visibility,
  onVisibilityChange,
  basemap,
  onBasemapChange,
  basemaps = DEFAULT_BASEMAPS,
}: MapControlsProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute top-3 right-14 z-10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-2.5 py-1.5 bg-gray-800/95 hover:bg-gray-700 text-gray-200 text-xs font-medium rounded-md shadow-lg border border-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
        aria-expanded={open}
        aria-controls="map-controls-panel"
      >
        Layers ▾
      </button>

      {open && (
        <div
          id="map-controls-panel"
          className="mt-1.5 w-52 rounded-md bg-gray-800/95 border border-gray-600 shadow-xl p-2.5"
          role="menu"
        >
          <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">
            Layers
          </p>
          <ul className="flex flex-col gap-1 mb-3">
            {LAYER_KEYS.map((key) => (
              <li key={key}>
                <label className="flex items-center gap-2 text-xs text-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibility[key]}
                    onChange={(e) =>
                      onVisibilityChange({ ...visibility, [key]: e.target.checked })
                    }
                    className="rounded text-blue-500 focus:ring-blue-500 bg-gray-700 border-gray-600"
                  />
                  {LAYER_LABEL[key]}
                </label>
              </li>
            ))}
          </ul>

          <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">
            Basemap
          </p>
          <ul className="flex flex-col gap-1">
            {basemaps.map((b) => (
              <li key={b.id}>
                <label
                  className={`flex items-center gap-2 text-xs cursor-pointer ${
                    b.unavailable === true ? 'text-gray-500 cursor-not-allowed' : 'text-gray-200'
                  }`}
                  title={b.unavailable === true
                    ? 'Satellite tiles require a configured tile key (see infra config).'
                    : b.label}
                >
                  <input
                    type="radio"
                    name="basemap"
                    checked={basemap === b.id}
                    disabled={b.unavailable === true}
                    onChange={() => onBasemapChange(b.id)}
                    className="text-blue-500 focus:ring-blue-500 bg-gray-700 border-gray-600 disabled:opacity-50"
                  />
                  {b.label}
                  {b.unavailable === true && (
                    <span className="ml-auto text-[9px] text-gray-500">key required</span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
