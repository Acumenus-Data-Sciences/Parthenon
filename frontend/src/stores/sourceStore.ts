import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SourceState {
  /** Cached default source ID from the server (sources with is_default=true) */
  defaultSourceId: number | null;
  setDefaultSourceId: (id: number | null) => void;
}

export const useSourceStore = create<SourceState>()(
  persist(
    (set) => ({
      defaultSourceId: null,
      setDefaultSourceId: (id) => set({ defaultSourceId: id }),
    }),
    { name: "parthenon-source" },
  ),
);
