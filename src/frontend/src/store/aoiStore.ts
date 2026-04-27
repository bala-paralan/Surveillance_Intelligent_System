import { create } from 'zustand';
import { type Aoi, type AoiPolygon, listAois } from '@/api/aoi';

interface AoiState {
  aois: Aoi[];
  activeAoiId: string | null;
  draft: AoiPolygon | null;
  loading: boolean;
  fetchAois: (bopZoneId?: string) => Promise<void>;
  addAoi: (aoi: Aoi) => void;
  updateAoi: (id: string, patch: Partial<Aoi>) => void;
  removeAoi: (id: string) => void;
  setActiveAoi: (id: string | null) => void;
  setDraft: (polygon: AoiPolygon | null) => void;
}

export const useAoiStore = create<AoiState>((set) => ({
  aois: [],
  activeAoiId: null,
  draft: null,
  loading: false,

  fetchAois: async (bopZoneId?: string): Promise<void> => {
    set({ loading: true });
    try {
      const result = await listAois(bopZoneId);
      set({ aois: result.aois, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addAoi: (aoi: Aoi): void => {
    set((state) => ({ aois: [...state.aois, aoi] }));
  },

  updateAoi: (id: string, patch: Partial<Aoi>): void => {
    set((state) => ({
      aois: state.aois.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  },

  removeAoi: (id: string): void => {
    set((state) => ({
      aois: state.aois.filter((a) => a.id !== id),
      activeAoiId: state.activeAoiId === id ? null : state.activeAoiId,
    }));
  },

  setActiveAoi: (id: string | null): void => {
    set({ activeAoiId: id });
  },

  setDraft: (polygon: AoiPolygon | null): void => {
    set({ draft: polygon });
  },
}));
