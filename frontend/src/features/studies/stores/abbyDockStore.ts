import { create } from "zustand";

/**
 * UI state for the omnipresent Abby copilot dock. Separate from the agent
 * transcript store (abbyAgentStore) so that any component on any study tab can
 * open the dock and queue a question without owning the agent session.
 *
 * An inline "Ask Abby about this" affordance calls `openWith(prompt)`; the dock
 * (mounted once on the study page) opens, starts a session if needed, and sends
 * the queued prompt once the session is live.
 */
interface AbbyDockState {
  isOpen: boolean;
  /** A prompt waiting to be sent once the agent session is live; null when none. */
  queuedPrompt: string | null;
  /** Open the dock; optionally queue a prompt to auto-send. */
  openWith: (prompt?: string) => void;
  toggle: () => void;
  close: () => void;
  /** Take the queued prompt (clearing it) — the dock calls this once it sends. */
  consumeQueued: () => string | null;
}

export const useAbbyDockStore = create<AbbyDockState>((set, get) => ({
  isOpen: false,
  queuedPrompt: null,

  openWith: (prompt) =>
    set((s) => ({
      isOpen: true,
      queuedPrompt: prompt ?? s.queuedPrompt,
    })),

  toggle: () => set((s) => ({ isOpen: !s.isOpen })),

  close: () => set({ isOpen: false }),

  consumeQueued: () => {
    const { queuedPrompt } = get();
    if (queuedPrompt !== null) set({ queuedPrompt: null });
    return queuedPrompt;
  },
}));
