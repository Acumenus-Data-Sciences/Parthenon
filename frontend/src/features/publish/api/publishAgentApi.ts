import { z } from "zod";
import apiClient from "@/lib/api-client";

const base = (draftId: number) => `/publish/drafts/${draftId}/agent/sessions`;

export const startAgentSessionResponse = z.object({
  agent_session_id: z.number(),
  channel_name: z.string(),
});
export type StartAgentSessionResponse = z.infer<typeof startAgentSessionResponse>;

export async function startAgentSession(
  draftId: number,
): Promise<StartAgentSessionResponse> {
  const { data } = await apiClient.post(base(draftId), {});
  return startAgentSessionResponse.parse(data.data ?? data);
}

export async function sendAgentMessage(
  draftId: number,
  agentSessionId: number,
  text: string,
): Promise<void> {
  await apiClient.post(`${base(draftId)}/${agentSessionId}/messages`, {
    text,
    idempotency_key: crypto.randomUUID(),
  });
}

// ── Reverb event payloads ────────────────────────────────────────────────────
export const agentTextDelta = z.object({ text: z.string() });
export const agentToolStart = z.object({ name: z.string(), input: z.unknown() });
export const agentTurnDone = z.object({
  cost_usd: z.number(),
  tokens_in: z.number(),
  tokens_out: z.number(),
  anthropic_session_id: z.string().nullable(),
});
export const agentError = z.object({ message: z.string() });

export const agentApprovalRequest = z.object({
  tool_use_id: z.string(),
  tool: z.string(),
  input: z.unknown(),
});
export const agentApprovalDenied = z.object({
  tool_use_id: z.string(),
  tool: z.string(),
});

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; input: unknown }
  | { type: "done"; costUsd: number }
  | { type: "error"; message: string }
  | { type: "approval-request"; toolUseId: string; tool: string; input: unknown }
  | { type: "approval-denied"; toolUseId: string };

export async function approveTool(
  draftId: number,
  agentSessionId: number,
  toolUseId: string,
  approved: boolean,
): Promise<void> {
  await apiClient.post(`${base(draftId)}/${agentSessionId}/approve`, {
    tool_use_id: toolUseId,
    approved,
  });
}
