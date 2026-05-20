import { useLayoutStore } from '@/store/layoutStore';
import type { LayoutMode, PaneIndex } from '@/store/layoutStore';
import { AoiPane } from '@/components/map/AoiPane';

// ── Grid styles per layout ────────────────────────────────────────────────────

const GRID_CLASS: Record<LayoutMode, string> = {
  '1':  'grid-cols-1 grid-rows-1',
  '2h': 'grid-cols-2 grid-rows-1',
  '2v': 'grid-cols-1 grid-rows-2',
  '4':  'grid-cols-2 grid-rows-2',
};

const VISIBLE_PANES: Record<LayoutMode, PaneIndex[]> = {
  '1':  [0],
  '2h': [0, 1],
  '2v': [0, 1],
  '4':  [0, 1, 2, 3],
};

// ── Component ─────────────────────────────────────────────────────────────────

export const QuadviewLayout = () => {
  const layout = useLayoutStore((s) => s.layout);
  const visiblePanes = VISIBLE_PANES[layout];

  return (
    <div
      className={`grid gap-1 h-full ${GRID_CLASS[layout]}`}
      aria-label="Quadview layout"
    >
      {visiblePanes.map((paneIndex) => (
        <AoiPane key={paneIndex} paneIndex={paneIndex} />
      ))}
    </div>
  );
};
