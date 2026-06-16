import { z } from "zod";
import apiClient from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Abby orchestrator agent client (ADR-0020 Phase 5b)
// ---------------------------------------------------------------------------

const base = (slug: string): string => `/studies/${slug}/agent/sessions`;

export const startAbbySessionResponse = z.object({
  agent_session_id: z.number(),
  channel_name: z.string(),
  // Provider + whether approval-gated WRITE actions are available. Defaults
  // preserve EE behavior (cloud Anthropic, actions on) when the field is absent;
  // a reads-only CE deployment returns actions_enabled=false so the dock hides
  // action affordances.
  provider: z.string().optional().default("anthropic"),
  actions_enabled: z.boolean().optional().default(true),
});
export type StartAbbySessionResponse = z.infer<typeof startAbbySessionResponse>;

export async function startAbbySession(slug: string): Promise<StartAbbySessionResponse> {
  const { data } = await apiClient.post(base(slug), {});
  return startAbbySessionResponse.parse(data.data ?? data);
}

export async function sendAbbyMessage(
  slug: string,
  sessionId: number,
  text: string,
): Promise<void> {
  await apiClient.post(`${base(slug)}/${sessionId}/messages`, {
    text,
    idempotency_key: crypto.randomUUID(),
  });
}

export async function approveAbbyTool(
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
