import { useEffect, useRef, useState } from 'react';
import { useAoiStore } from '@/store/aoiStore';
import { exportAoi, importAois } from '@/api/aoi';
import { AoiMap } from '@/components/map/AoiMap';
import { AoiList } from '@/components/map/AoiList';
import { CataloguePanel } from '@/components/catalogue/CataloguePanel';

export const AoiPage = () => {
  const { aois, activeAoiId, fetchAois } = useAoiStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    void fetchAois();
  }, [fetchAois]);

  const handleExport = (): void => {
    if (activeAoiId === null) {
      window.alert('Select an AOI from the list to export.');
      return;
    }
    exportAoi(activeAoiId)
      .then((geojson) => {
        const blob = new Blob([JSON.stringify(geojson, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aoi-${activeAoiId}.geojson`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => window.alert('Export failed.'));
  };

  const handleImportClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file === undefined) return;

    const reader = new FileReader();
    reader.onload = (event): void => {
      try {
        const fc = JSON.parse(event.target?.result as string) as object;
        importAois(fc)
          .then((result) => {
            setImportStatus(`Imported ${result.created} AOI(s), skipped ${result.skipped}.`);
            void fetchAois();
            setTimeout(() => setImportStatus(null), 4000);
          })
          .catch(() => window.alert('Import failed. Check the GeoJSON format.'));
      } catch {
        window.alert('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-white font-semibold text-lg">Areas of Interest</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
            {aois.length} AOI{aois.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {importStatus !== null && (
            <span className="text-green-400 text-sm">{importStatus}</span>
          )}
          <button
            onClick={handleImportClick}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Import GeoJSON
          </button>
          <button
            onClick={handleExport}
            disabled={activeAoiId === null}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Export
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".geojson,.json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 shrink-0 bg-gray-800 border-r border-gray-700 overflow-y-auto">
          <div className="px-3 py-2 border-b border-gray-700">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Saved AOIs
            </p>
          </div>
          <AoiList />
        </aside>

        {/* Map + Catalogue panel */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Map */}
          <main className="flex-1 overflow-hidden">
            <AoiMap />
          </main>

          {/* Sensor catalogue panel */}
          <aside className="h-56 shrink-0 bg-gray-800 border-t border-gray-700 flex flex-col">
            <div className="px-3 py-2 border-b border-gray-700 shrink-0 flex items-center gap-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Sensor Catalogue
              </p>
              {activeAoiId !== null && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-900 text-indigo-300 font-mono">
                  AOI active
                </span>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              {activeAoiId !== null ? (
                <CataloguePanel aoiId={activeAoiId} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  Select an AOI to see its sensor catalogue
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
