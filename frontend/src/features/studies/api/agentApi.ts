import { z } from "zod";
import apiClient from "@/lib/api-client";

const base = (slug: string, sessionId: number) =>
  `/studies/${slug}/design-sessions/${sessionId}/agent/sessions`;

export const startAgentSessionResponse = z.object({
  agent_session_id: z.number(),
  channel_name: z.string(),
});
export type StartAgentSessionResponse = z.infer<typeof startAgentSessionResponse>;

export async function startAgentSession(
  slug: string,
  sessionId: number,
  versionId: number | null,
): Promise<StartAgentSessionResponse> {
  const { data } = await apiClient.post(base(slug, sessionId), { version_id: versionId });
  return startAgentSessionResponse.parse(data.data ?? data);
}

export async function sendAgentMessage(
  slug: string,
  sessionId: number,
  agentSessionId: number,
  text: string,
): Promise<void> {
  await apiClient.post(`${base(slug, sessionId)}/${agentSessionId}/messages`, {
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

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; input: unknown }
  | { type: "done"; costUsd: number }
  | { type: "error"; message: string };
