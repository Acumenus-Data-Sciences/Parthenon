import { create } from "zustand";
import type { WikiChatMessage, WikiLintResponse } from "@/features/commons/types/wiki";

interface WikiState {
  selectedPageSlug: string | null;
  searchQuery: string;
  lintResponse: WikiLintResponse | null;
  ingestModalOpen: boolean;
  activityDrawerOpen: boolean;
  chatDrawerOpen: boolean;
  pdfModalFilename: string | null;
  chatMessages: WikiChatMessage[];
  setSelectedPageSlug: (slug: string | null) => void;
  setSearchQuery: (query: string) => void;
  setLintResponse: (response: WikiLintResponse | null) => void;
  setIngestModalOpen: (open: boolean) => void;
  setActivityDrawerOpen: (open: boolean) => void;
  setChatDrawerOpen: (open: boolean) => void;
  setPdfModalFilename: (filename: string | null) => void;
  addChatMessage: (message: WikiChatMessage) => void;
  clearChat: () => void;
}

export const useWikiStore = create<WikiState>()((set) => ({
  selectedPageSlug: null,
  searchQuery: "",
  lintResponse: null,
  ingestModalOpen: false,
  activityDrawerOpen: false,
  chatDrawerOpen: false,
  pdfModalFilename: null,
  chatMessages: [],
  setSelectedPageSlug: (slug) => set({ selectedPageSlug: slug }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setLintResponse: (response) => set({ lintResponse: response }),
  setIngestModalOpen: (open) => set({ ingestModalOpen: open }),
  setActivityDrawerOpen: (open) => set({ activityDrawerOpen: open }),
  setChatDrawerOpen: (open) => set({ chatDrawerOpen: open }),
  setPdfModalFilename: (filename) => set({ pdfModalFilename: filename }),
  addChatMessage: (message) => set((state) => ({ chatMessages: [...state.chatMessages, message] })),
  clearChat: () => set({ chatMessages: [] }),
}));
