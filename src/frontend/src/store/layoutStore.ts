import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Types ─────────────────────────────────────────────────────────────────────

export type LayoutMode = '1' | '2h' | '2v' | '4';
export type PaneIndex = 0 | 1 | 2 | 3;

interface LayoutStoreState {
  layout: LayoutMode;
  paneAois: [string | null, string | null, string | null, string | null];
  setLayout: (layout: LayoutMode) => void;
  setPaneAoi: (paneIndex: PaneIndex, aoiId: string | null) => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useLayoutStore = create<LayoutStoreState>()(
  persist(
    (set) => ({
      layout: '1',
      paneAois: [null, null, null, null],

      setLayout: (layout: LayoutMode): void => {
        set({ layout });
      },

      setPaneAoi: (paneIndex: PaneIndex, aoiId: string | null): void => {
        set((state) => {
          const next = [...state.paneAois] as [
            string | null,
            string | null,
            string | null,
            string | null,
          ];
          next[paneIndex] = aoiId;
          return { paneAois: next };
        });
      },
    }),
    {
      name: 'sis-layout',
    },
  ),
);
