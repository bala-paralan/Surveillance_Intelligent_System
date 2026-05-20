import { useQuery } from '@tanstack/react-query';
import { useLayoutStore } from '@/store/layoutStore';
import type { PaneIndex } from '@/store/layoutStore';
import { AoiSelector } from '@/components/map/AoiSelector';
import { AoiMap } from '@/components/map/AoiMap';
import { AlertTicker } from '@/components/alerts/AlertTicker';
import { listCatalogue } from '@/api/catalogue';

// ── Props ─────────────────────────────────────────────────────────────────────

interface AoiPaneProps {
  paneIndex: PaneIndex;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AoiPane = ({ paneIndex }: AoiPaneProps) => {
  const paneAois = useLayoutStore((s) => s.paneAois);
  const aoiId = paneAois[paneIndex];

  const { data: catalogueData } = useQuery({
    queryKey: ['catalogue', aoiId],
    queryFn: () => (aoiId !== null ? listCatalogue(aoiId) : Promise.reject(new Error('No AOI'))),
    enabled: aoiId !== null,
    staleTime: 30_000,
  });

  const sensorCount = catalogueData?.count ?? null;

  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-700 rounded overflow-hidden">
      {/* Pane header */}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-800 border-b border-gray-700 shrink-0">
        <span className="text-xs font-semibold text-gray-500 shrink-0">Pane {paneIndex + 1}</span>
        <div className="flex-1">
          <AoiSelector paneIndex={paneIndex} />
        </div>
        {sensorCount !== null && (
          <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
            {sensorCount} sensor{sensorCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden">
        {aoiId !== null ? (
          <>
            <AoiMap />
            <AlertTicker aoiId={aoiId} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            Select an AOI for this pane
          </div>
        )}
      </div>
    </div>
  );
};
