import { create } from 'zustand';
import type { FusionOutcome } from '@/api/fusion';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GlyphState {
  outcome: FusionOutcome;
  addedAt: number;
  visible: boolean;
}

interface GlyphStoreState {
  glyphs: Map<string, GlyphState>;
  addGlyph: (outcome: FusionOutcome) => void;
  purgeStale: () => void;
  clearAoi: (aoiId: string) => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useGlyphStore = create<GlyphStoreState>((set, get) => ({
  glyphs: new Map<string, GlyphState>(),

  addGlyph: (outcome: FusionOutcome): void => {
    set((state) => {
      const key = `${outcome.aoiId}:${outcome.id}`;
      const next = new Map(state.glyphs);
      next.set(key, { outcome, addedAt: Date.now(), visible: true });
      return { glyphs: next };
    });
  },

  purgeStale: (): void => {
    const now = Date.now();
    const { glyphs } = get();
    const next = new Map<string, GlyphState>();
    glyphs.forEach((gs, key) => {
      const expiresAt = gs.addedAt + gs.outcome.renderHint.decay_s * 1000;
      if (now < expiresAt) {
        next.set(key, gs);
      }
    });
    // Only trigger re-render if something was actually removed
    if (next.size !== glyphs.size) {
      set({ glyphs: next });
    }
  },

  clearAoi: (aoiId: string): void => {
    set((state) => {
      const next = new Map<string, GlyphState>();
      state.glyphs.forEach((gs, key) => {
        if (gs.outcome.aoiId !== aoiId) {
          next.set(key, gs);
        }
      });
      return { glyphs: next };
    });
  },
}));
