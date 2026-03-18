import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

export interface ConversationSummary {
  id: number;
  title: string;
  page_context: string;
  created_at: string;
  messages_count: number;
}

interface AbbyState {
  panelOpen: boolean;
  togglePanel: () => void;
  setPanelOpen: (open: boolean) => void;

  messages: Message[];
  addMessage: (msg: Message) => void;
  clearMessages: () => void;

  conversationId: number | null;             // was string | null
  setConversationId: (id: number | null) => void;

  conversationList: ConversationSummary[];
  setConversationList: (list: ConversationSummary[]) => void;

  pageContext: string;
  setPageContext: (ctx: string) => void;

  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;

  streamingContent: string;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (chunk: string) => void;
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hello! I'm Abby, your AI research assistant powered by MedGemma and backed by a knowledge base of 39,000+ documentation chunks. I remember our past conversations and can help with concept mapping, cohort design, data quality, clinical analytics, and OMOP CDM guidance. How can I help?",
  timestamp: new Date(),
};

export const useAbbyStore = create<AbbyState>()(
  persist(
    (set) => ({
      panelOpen: false,
      togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
      setPanelOpen: (open) => set({ panelOpen: open }),

      messages: [WELCOME_MESSAGE],
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      clearMessages: () => set({ messages: [WELCOME_MESSAGE], conversationId: null }),

      conversationId: null,
      setConversationId: (id) => set({ conversationId: id }),

      conversationList: [],
      setConversationList: (list) => set({ conversationList: list }),

      pageContext: "general",
      setPageContext: (ctx) => set({ pageContext: ctx }),

      isStreaming: false,
      setIsStreaming: (streaming) => set({ isStreaming: streaming }),

      streamingContent: "",
      setStreamingContent: (content) => set({ streamingContent: content }),
      appendStreamingContent: (chunk) =>
        set((s) => ({ streamingContent: s.streamingContent + chunk })),
    }),
    {
      name: "parthenon-abby",
      // Do NOT persist conversationId — stale IDs cause 422 validation failures
      // after DB restores, and users expect a clean slate on hard refresh.
      partialize: () => ({}),
    },
  ),
);
