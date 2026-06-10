import { create } from "zustand";
import type { AgentEvent } from "../api/clioAgentApi";

export interface ToolCall {
  name: string;
  input: unknown;
}

export interface TranscriptTurn {
  role: "user" | "assistant";
  text: string;
  tools?: ToolCall[];
}

export interface PendingApproval {
  toolUseId: string;
  tool: string;
  input: unknown;
}

interface ClioAgentState {
  agentSessionId: number | null;
  channelName: string | null;
  transcript: TranscriptTurn[];
  isStreaming: boolean;
  lastCostUsd: number | null;
  errorMessage: string | null;
  pendingApprovals: PendingApproval[];
  setSession: (id: number, channel: string) => void;
  pushUserMessage: (text: string) => void;
  applyEvent: (event: AgentEvent) => void;
  reset: () => void;
}

function ensureAssistantTurn(transcript: TranscriptTurn[]): TranscriptTurn[] {
  const last = transcript[transcript.length - 1];
  if (last && last.role === "assistant") {
    return transcript;
  }
  return [...transcript, { role: "assistant", text: "", tools: [] }];
}

export const useClioAgentStore = create<ClioAgentState>((set) => ({
  agentSessionId: null,
  channelName: null,
  transcript: [],
  isStreaming: false,
  lastCostUsd: null,
  errorMessage: null,
  pendingApprovals: [],

  setSession: (id, channel) => set({ agentSessionId: id, channelName: channel }),

  pushUserMessage: (text) =>
    set((s) => ({
      transcript: [...s.transcript, { role: "user", text }],
      isStreaming: true,
      errorMessage: null,
    })),

  applyEvent: (event) =>
    set((s) => {
      if (event.type === "text") {
        const t = ensureAssistantTurn(s.transcript);
        const last = t[t.length - 1];
        const updated: TranscriptTurn = { ...last, text: last.text + event.text };
        return { transcript: [...t.slice(0, -1), updated] };
      }
      if (event.type === "tool") {
        const t = ensureAssistantTurn(s.transcript);
        const last = t[t.length - 1];
        const updated: TranscriptTurn = {
          ...last,
          tools: [...(last.tools ?? []), { name: event.name, input: event.input }],
        };
        return { transcript: [...t.slice(0, -1), updated] };
      }
      if (event.type === "approval-request") {
        const already = s.pendingApprovals.some((p) => p.toolUseId === event.toolUseId);
        if (already) return {};
        return {
          pendingApprovals: [
            ...s.pendingApprovals,
            { toolUseId: event.toolUseId, tool: event.tool, input: event.input },
          ],
        };
      }
      if (event.type === "approval-denied") {
        return {
          pendingApprovals: s.pendingApprovals.filter((p) => p.toolUseId !== event.toolUseId),
        };
      }
      if (event.type === "done") {
        return { isStreaming: false, lastCostUsd: event.costUsd, pendingApprovals: [] };
      }
      return { isStreaming: false, errorMessage: event.message };
    }),

  reset: () =>
    set({
      agentSessionId: null,
      channelName: null,
      transcript: [],
      isStreaming: false,
      lastCostUsd: null,
      errorMessage: null,
      pendingApprovals: [],
    }),
}));
