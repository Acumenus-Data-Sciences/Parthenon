import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getEcho } from "@/lib/echo";
import {
  agentError,
  agentTextDelta,
  agentToolStart,
  agentTurnDone,
  sendAgentMessage,
  startAgentSession,
} from "../api/publishAgentApi";
import { usePublishAgentStore } from "../stores/publishAgentStore";
import { PUBLISH_DRAFT_KEYS } from "./usePublicationDrafts";

interface Params {
  draftId: number | null;
}

export function usePublishAgent({ draftId }: Params) {
  const qc = useQueryClient();
  // Select only the primitive channel name + the (stable) setter. Subscribing to
  // the whole store here would re-run the effect below on every streamed event,
  // churning the Echo subscription (leave + re-subscribe per event).
  const channelName = usePublishAgentStore((s) => s.channelName);
  const setSession = usePublishAgentStore((s) => s.setSession);
  const subscribedRef = useRef<string | null>(null);

  const startMutation = useMutation({
    mutationFn: () => startAgentSession(draftId!),
    onSuccess: (data) => setSession(data.agent_session_id, data.channel_name),
  });

  // Subscribe to the private Reverb channel once a session exists. Depends only
  // on the channel name (primitive) + route params, so streamed events do NOT
  // re-run it. Store actions are read via getState() (stable) inside listeners.
  useEffect(() => {
    if (!channelName) return;
    const echo = getEcho();
    if (!echo) return;

    const name = channelName.replace(/^private-/, "");
    if (subscribedRef.current === name) return;
    if (subscribedRef.current) echo.leave(subscribedRef.current);

    const { applyEvent } = usePublishAgentStore.getState();
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
        if (draftId != null) {
          qc.invalidateQueries({ queryKey: ["publish", "study"] });
          qc.invalidateQueries({ queryKey: PUBLISH_DRAFT_KEYS.detail(draftId) });
        }
      })
      .listen(".agent.error", (e: unknown) =>
        applyEvent({ type: "error", ...agentError.parse(e) }),
      );

    subscribedRef.current = name;
    return () => {
      echo.leave(name);
      subscribedRef.current = null;
    };
  }, [channelName, draftId, qc]);

  const send = useCallback(
    async (text: string) => {
      const { agentSessionId, pushUserMessage } = usePublishAgentStore.getState();
      if (draftId == null || agentSessionId == null) return;
      pushUserMessage(text);
      await sendAgentMessage(draftId, agentSessionId, text);
    },
    [draftId],
  );

  return { start: startMutation.mutate, starting: startMutation.isPending, send };
}
