import { z } from "zod";
import apiClient from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Clio orchestrator agent client (ADR-0020 Phase 5b)
// ---------------------------------------------------------------------------

const base = (slug: string): string => `/studies/${slug}/agent/sessions`;

export const startClioSessionResponse = z.object({
  agent_session_id: z.number(),
  channel_name: z.string(),
});
export type StartClioSessionResponse = z.infer<typeof startClioSessionResponse>;

export async function startClioSession(slug: string): Promise<StartClioSessionResponse> {
  const { data } = await apiClient.post(base(slug), {});
  return startClioSessionResponse.parse(data.data ?? data);
}

export async function sendClioMessage(
  slug: string,
  sessionId: number,
  text: string,
): Promise<void> {
  await apiClient.post(`${base(slug)}/${sessionId}/messages`, {
    text,
    idempotency_key: crypto.randomUUID(),
  });
}

export async function approveClioTool(
  slug: string,
  sessionId: number,
  toolUseId: string,
  approved: boolean,
): Promise<void> {
  await apiClient.post(`${base(slug)}/${sessionId}/approve`, {
    tool_use_id: toolUseId,
    approved,
  });
}

// ── Reverb event payloads (emitted by the python-ai harness) ────────────────
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
