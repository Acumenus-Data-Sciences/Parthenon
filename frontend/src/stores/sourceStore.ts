import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SourceInfo {
  id: number;
  source_name: string;
  is_default?: boolean;
}

interface SourceState {
  /** Currently selected source — global across all features */
  activeSourceId: number | null;
  /** Cached default source ID from the server */
  defaultSourceId: number | null;
  /** Cached source list for selectors */
  sources: SourceInfo[];
  setActiveSource: (id: number) => void;
  setDefaultSourceId: (id: number | null) => void;
  setSources: (sources: SourceInfo[]) => void;
}

export const useSourceStore = create<SourceState>()(
  persist(
    (set) => ({
      activeSourceId: null,
      defaultSourceId: null,
      sources: [],
      setActiveSource: (id) => set({ activeSourceId: id }),
      setDefaultSourceId: (id) => set({ defaultSourceId: id }),
      setSources: (sources) => set({ sources }),
    }),
    { name: "parthenon-source" },
  ),
);
