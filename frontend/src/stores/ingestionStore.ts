import { create } from "zustand";

interface IngestionState {
  currentJobId: number | null;
  setCurrentJob: (id: number | null) => void;
}

export const useIngestionStore = create<IngestionState>()((set) => ({
  currentJobId: null,
  setCurrentJob: (id) => set({ currentJobId: id }),
}));
