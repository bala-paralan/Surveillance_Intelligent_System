// Compact AOI library popover for the OperatorDashboard toolbar.
// Items are draggable onto panes (TASK-043 §10).

import { useState } from 'react';
import { useAoiStore } from '@/store/aoiStore';

export const AOI_DRAG_TYPE = 'application/x-sis-aoi-id';

export const AoiLibraryDrawer = () => {
  const aois = useAoiStore((s) => s.aois);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
        aria-expanded={open}
        aria-controls="aoi-library-popover"
      >
        AOI library ▾
      </button>

      {open && (
        <div
          id="aoi-library-popover"
          className="absolute right-0 mt-1.5 w-64 max-h-80 overflow-y-auto rounded-md bg-gray-800 border border-gray-700 shadow-xl z-30"
          role="menu"
        >
          <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-gray-400">
              Drag onto a pane
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-white text-xs"
              aria-label="Close library"
            >
              ✕
            </button>
          </div>
          {aois.length === 0 ? (
            <p className="px-3 py-4 text-xs text-gray-500">
              No AOIs defined yet. Create one from the AOI page.
            </p>
          ) : (
            <ul className="divide-y divide-gray-700">
              {aois.map((aoi) => (
                <li
                  key={aoi.id}
                  className="px-3 py-2 text-sm text-gray-200 cursor-grab active:cursor-grabbing hover:bg-gray-700/60 transition-colors"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData(AOI_DRAG_TYPE, aoi.id);
                    e.dataTransfer.setData('text/plain', aoi.name);
                  }}
                  title={aoi.name}
                >
                  <p className="truncate">{aoi.name}</p>
                  <p className="text-[10px] text-gray-500">
                    Drag onto a pane to load
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
