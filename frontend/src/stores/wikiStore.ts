import { create } from "zustand";
import type { WikiLintResponse, WikiQueryResponse } from "@/features/commons/types/wiki";

interface WikiState {
  workspace: string;
  selectedPageSlug: string | null;
  searchQuery: string;
  queryPanelOpen: boolean;
  ingestPanelOpen: boolean;
  lastQueryResponse: WikiQueryResponse | null;
  lastLintResponse: WikiLintResponse | null;
  draftWorkspaceName: string;
  setWorkspace: (workspace: string) => void;
  setSelectedPageSlug: (slug: string | null) => void;
  setSearchQuery: (query: string) => void;
  setQueryPanelOpen: (open: boolean) => void;
  setIngestPanelOpen: (open: boolean) => void;
  setLastQueryResponse: (response: WikiQueryResponse | null) => void;
  setLastLintResponse: (response: WikiLintResponse | null) => void;
  setDraftWorkspaceName: (value: string) => void;
}

export const useWikiStore = create<WikiState>()((set) => ({
  workspace: "platform",
  selectedPageSlug: null,
  searchQuery: "",
  queryPanelOpen: true,
  ingestPanelOpen: true,
  lastQueryResponse: null,
  lastLintResponse: null,
  draftWorkspaceName: "",
  setWorkspace: (workspace) =>
    set({
      workspace,
      selectedPageSlug: null,
      lastQueryResponse: null,
      lastLintResponse: null,
    }),
  setSelectedPageSlug: (slug) => set({ selectedPageSlug: slug }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setQueryPanelOpen: (open) => set({ queryPanelOpen: open }),
  setIngestPanelOpen: (open) => set({ ingestPanelOpen: open }),
  setLastQueryResponse: (response) => set({ lastQueryResponse: response }),
  setLastLintResponse: (response) => set({ lastLintResponse: response }),
  setDraftWorkspaceName: (value) => set({ draftWorkspaceName: value }),
}));
