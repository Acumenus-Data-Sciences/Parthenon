import { create } from "zustand";

interface LayerState {
  activeLayers: Set<string>;
  selectedFips: string | null;
  selectedName: string | null;
  drawerOpen: boolean;
  suppressionThreshold: number;
}

interface LayerActions {
  toggleLayer: (id: string) => void;
  setSelectedRegion: (fips: string | null, name: string | null) => void;
  setLayerActive: (id: string, active: boolean) => void;
  setDrawerOpen: (open: boolean) => void;
  setSuppressionThreshold: (threshold: number) => void;
  isLayerActive: (id: string) => boolean;
}

export const useLayerStore = create<LayerState & LayerActions>((set, get) => ({
  activeLayers: new Set<string>(),
  selectedFips: null,
  selectedName: null,
  drawerOpen: false,
  suppressionThreshold: 0,

  toggleLayer: (id) =>
    set((state) => {
      const next = new Set(state.activeLayers);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { activeLayers: next };
    }),

  setSelectedRegion: (fips, name) =>
    set({ selectedFips: fips, selectedName: name }),

  setLayerActive: (id, active) =>
    set((state) => {
      const next = new Set(state.activeLayers);
      if (active) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return { activeLayers: next };
    }),

  setDrawerOpen: (open) => set({ drawerOpen: open }),

  setSuppressionThreshold: (threshold) =>
    set({ suppressionThreshold: threshold }),

  isLayerActive: (id) => get().activeLayers.has(id),
}));
