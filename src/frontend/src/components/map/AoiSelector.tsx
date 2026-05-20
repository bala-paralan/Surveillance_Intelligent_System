import { useAoiStore } from '@/store/aoiStore';
import { useLayoutStore } from '@/store/layoutStore';
import type { PaneIndex } from '@/store/layoutStore';

// ── Props ─────────────────────────────────────────────────────────────────────

interface AoiSelectorProps {
  paneIndex: PaneIndex;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AoiSelector = ({ paneIndex }: AoiSelectorProps) => {
  const aois = useAoiStore((s) => s.aois);
  const paneAois = useLayoutStore((s) => s.paneAois);
  const setPaneAoi = useLayoutStore((s) => s.setPaneAoi);

  const currentAoiId = paneAois[paneIndex];

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const value = e.target.value;
    setPaneAoi(paneIndex, value === '' ? null : value);
  };

  return (
    <select
      value={currentAoiId ?? ''}
      onChange={handleChange}
      className="w-full bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      aria-label={`AOI selector for pane ${paneIndex + 1}`}
    >
      <option value="">— None —</option>
      {aois.map((aoi) => (
        <option key={aoi.id} value={aoi.id}>
          {aoi.name}
        </option>
      ))}
    </select>
  );
};
