import { create } from "zustand";

interface SourceInfo {
  id: number;
  source_name: string;
}

interface SourceState {
  /** Currently selected source — resets to user default each session */
  activeSourceId: number | null;
  /** The authenticated user's default source ID (from server) */
  defaultSourceId: number | null;
  /** Cached source list for components that need it */
  sources: SourceInfo[];
  setActiveSource: (id: number) => void;
  setDefaultSourceId: (id: number | null) => void;
  setSources: (sources: SourceInfo[]) => void;
}

export const useSourceStore = create<SourceState>()((set) => ({
  activeSourceId: null,
  defaultSourceId: null,
  sources: [],
  setActiveSource: (id) => set({ activeSourceId: id }),
  setDefaultSourceId: (id) => set({ defaultSourceId: id }),
  setSources: (sources) => set({ sources }),
}));
