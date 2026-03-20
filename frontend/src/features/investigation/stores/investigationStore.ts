import { create } from "zustand";
import type { EvidenceDomain } from "../types";

interface InvestigationUiState {
  activeDomain: EvidenceDomain;
  sidebarOpen: boolean;
  setActiveDomain: (domain: EvidenceDomain) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useInvestigationStore = create<InvestigationUiState>()((set) => ({
  activeDomain: "phenotype",
  sidebarOpen: true,
  setActiveDomain: (domain) => set({ activeDomain: domain }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
