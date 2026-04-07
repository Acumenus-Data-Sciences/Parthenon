import { create } from "zustand";
import { persist, type StateStorage } from "zustand/middleware";
import type { WikiChatMessage, WikiLintResponse, WikiPageSummary } from "@/features/commons/types/wiki";

// Debounced localStorage adapter — prevents blocking the main thread
// during streaming when appendToMessage fires rapidly.
function createDebouncedStorage(delay = 1000): StateStorage {
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const key = "parthenon-wiki-chat";

  return {
    getItem: (name: string) => localStorage.getItem(name),
    setItem: (name: string, value: string) => {
      pending = value;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (pending !== null) {
          localStorage.setItem(name, pending);
          pending = null;
        }
      }, delay);
    },
    removeItem: (name: string) => {
      if (timer) clearTimeout(timer);
      pending = null;
      localStorage.removeItem(name);
    },
  };
}

// Flush on page unload so we don't lose the last second of tokens
const debouncedStorage = createDebouncedStorage(1000);
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    // Force-flush any pending write
    const raw = (debouncedStorage as { pending?: string | null }).pending;
    if (typeof raw === "string") {
      localStorage.setItem("parthenon-wiki-chat", raw);
    }
  });
}

interface WikiState {
  selectedPageSlug: string | null;
  lastOpenedSlug: string | null;
  searchQuery: string;
  lintResponse: WikiLintResponse | null;
  ingestModalOpen: boolean;
  activityDrawerOpen: boolean;
  chatDrawerOpen: boolean;
  pdfModalFilename: string | null;
  chatMessagesByScope: Record<string, WikiChatMessage[]>;
  setSelectedPageSlug: (slug: string | null) => void;
  setSearchQuery: (query: string) => void;
  setLintResponse: (response: WikiLintResponse | null) => void;
  setIngestModalOpen: (open: boolean) => void;
  setActivityDrawerOpen: (open: boolean) => void;
  setChatDrawerOpen: (open: boolean) => void;
  setPdfModalFilename: (filename: string | null) => void;
  addChatMessage: (scope: string, message: WikiChatMessage) => void;
  appendToMessage: (scope: string, messageId: string, token: string) => void;
  setCitationsOnMessage: (scope: string, messageId: string, citations: WikiPageSummary[]) => void;
  clearChat: (scope?: string) => void;
}

export const useWikiStore = create<WikiState>()(
  persist(
    (set) => ({
      selectedPageSlug: null,
      lastOpenedSlug: null,
      searchQuery: "",
      lintResponse: null,
      ingestModalOpen: false,
      activityDrawerOpen: false,
      chatDrawerOpen: false,
      pdfModalFilename: null,
      chatMessagesByScope: {},
      setSelectedPageSlug: (slug) => set({ selectedPageSlug: slug, lastOpenedSlug: slug ?? undefined }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setLintResponse: (response) => set({ lintResponse: response }),
      setIngestModalOpen: (open) => set({ ingestModalOpen: open }),
      setActivityDrawerOpen: (open) => set({ activityDrawerOpen: open }),
      setChatDrawerOpen: (open) => set({ chatDrawerOpen: open }),
      setPdfModalFilename: (filename) => set({ pdfModalFilename: filename }),
      addChatMessage: (scope, message) => set((state) => ({
        chatMessagesByScope: {
          ...state.chatMessagesByScope,
          [scope]: [...(state.chatMessagesByScope[scope] ?? []), message],
        },
      })),
      appendToMessage: (scope, messageId, token) => set((state) => {
        const msgs = state.chatMessagesByScope[scope];
        if (!msgs) return state;
        return {
          chatMessagesByScope: {
            ...state.chatMessagesByScope,
            [scope]: msgs.map((m) =>
              m.id === messageId ? { ...m, content: m.content + token } : m,
            ),
          },
        };
      }),
      setCitationsOnMessage: (scope, messageId, citations) => set((state) => {
        const msgs = state.chatMessagesByScope[scope];
        if (!msgs) return state;
        return {
          chatMessagesByScope: {
            ...state.chatMessagesByScope,
            [scope]: msgs.map((m) =>
              m.id === messageId ? { ...m, citations } : m,
            ),
          },
        };
      }),
      clearChat: (scope) => set((state) => {
        if (!scope) {
          return { chatMessagesByScope: {} };
        }
        return {
          chatMessagesByScope: {
            ...state.chatMessagesByScope,
            [scope]: [],
          },
        };
      }),
    }),
    {
      name: "parthenon-wiki-chat",
      storage: debouncedStorage,
      // Only persist chat messages — UI state (modals, drawers, selection)
      // should reset on page load.
      partialize: (state) => ({
        chatMessagesByScope: state.chatMessagesByScope,
        lastOpenedSlug: state.lastOpenedSlug,
      }),
    },
  ),
);
