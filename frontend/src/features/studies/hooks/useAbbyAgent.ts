import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getEcho } from "@/lib/echo";
import {
  agentApprovalDenied,
  agentApprovalRequest,
  agentError,
  agentTextDelta,
  agentToolStart,
  agentTurnDone,
  approveAbbyTool,
  sendAbbyMessage,
  startAbbySession,
} from "../api/abbyAgentApi";
import { useAbbyAgentStore } from "../stores/abbyAgentStore";

interface Params {
  slug: string | null;
}

/**
 * Drives a Abby orchestrator agent session for a study (ADR-0020 Phase 5b):
 * starts the session, subscribes to its private Reverb channel, and relays
 * user messages + tool approvals. When a turn completes it refreshes the gate
 * timeline (the agent may have evaluated gates).
 */
export function useAbbyAgent({ slug }: Params) {
  const qc = useQueryClient();
  const channelName = useAbbyAgentStore((s) => s.channelName);
  const setSession = useAbbyAgentStore((s) => s.setSession);
  const subscribedRef = useRef<string | null>(null);

  const startMutation = useMutation({
    mutationFn: () => startAbbySession(slug!),
    onSuccess: (data) => setSession(data.agent_session_id, data.channel_name),
  });

  useEffect(() => {
    if (!channelName) return;
    const echo = getEcho();
    if (!echo) return;

    const name = channelName.replace(/^private-/, "");
    if (subscribedRef.current === name) return;
    if (subscribedRef.current) echo.leave(subscribedRef.current);

    const { applyEvent } = useAbbyAgentStore.getState();
    echo
      .private(name)
      .listen(".agent.text.delta", (e: unknown) =>
        applyEvent({ type: "text", ...agentTextDelta.parse(e) }),
      )
      .listen(".agent.tool.start", (e: unknown) => {
        const p = agentToolStart.parse(e);
        applyEvent({ type: "tool", name: p.name, input: p.input });
      })
      .listen(".agent.turn.done", (e: unknown) => {
        applyEvent({ type: "done", costUsd: agentTurnDone.parse(e).cost_usd });
        if (slug) qc.invalidateQueries({ queryKey: ["study-gates", slug] });
      })
      .listen(".agent.error", (e: unknown) =>
        applyEvent({ type: "error", ...agentError.parse(e) }),
      )
      .listen(".agent.approval.request", (e: unknown) => {
        const p = agentApprovalRequest.parse(e);
        applyEvent({ type: "approval-request", toolUseId: p.tool_use_id, tool: p.tool, input: p.input });
      })
      .listen(".agent.approval.denied", (e: unknown) => {
        const p = agentApprovalDenied.parse(e);
        applyEvent({ type: "approval-denied", toolUseId: p.tool_use_id });
      });

    subscribedRef.current = name;
    return () => {
      echo.leave(name);
      subscribedRef.current = null;
    };
  }, [channelName, slug, qc]);

  const send = useCallback(
    async (text: string) => {
      const { agentSessionId, pushUserMessage } = useAbbyAgentStore.getState();
      if (!slug || agentSessionId == null) return;
      pushUserMessage(text);
      await sendAbbyMessage(slug, agentSessionId, text);
    },
    [slug],
  );

  const approve = useCallback(
    async (toolUseId: string, approved: boolean) => {
      const { agentSessionId } = useAbbyAgentStore.getState();
      if (!slug || agentSessionId == null) return;
      await approveAbbyTool(slug, agentSessionId, toolUseId, approved);
    },
    [slug],
  );

  return { start: startMutation.mutate, starting: startMutation.isPending, send, approve };
}
