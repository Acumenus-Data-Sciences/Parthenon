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
} from "../api/agentApi";
import { useStudyDesignerAgentStore } from "../stores/studyDesignerAgentStore";
import { invalidateStudyDesignCompiler } from "./useStudies";

interface Params {
  slug: string | null;
  sessionId: number | null;
  versionId: number | null;
}

export function useStudyDesignerAgent({ slug, sessionId, versionId }: Params) {
  const qc = useQueryClient();
  // Select only the primitive channel name + the (stable) setter. Subscribing to
  // the whole store here would re-run the effect below on every streamed event,
  // churning the Echo subscription (leave + re-subscribe per event).
  const channelName = useStudyDesignerAgentStore((s) => s.channelName);
  const setSession = useStudyDesignerAgentStore((s) => s.setSession);
  const subscribedRef = useRef<string | null>(null);

  const startMutation = useMutation({
    mutationFn: () => startAgentSession(slug!, sessionId!, versionId),
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

    const { applyEvent } = useStudyDesignerAgentStore.getState();
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
        if (slug && sessionId && versionId) {
          invalidateStudyDesignCompiler(qc, slug, sessionId, versionId);
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
  }, [channelName, slug, sessionId, versionId, qc]);

  const send = useCallback(
    async (text: string) => {
      const { agentSessionId, pushUserMessage } = useStudyDesignerAgentStore.getState();
      if (!slug || !sessionId || agentSessionId == null) return;
      pushUserMessage(text);
      await sendAgentMessage(slug, sessionId, agentSessionId, text);
    },
    [slug, sessionId],
  );

  return { start: startMutation.mutate, starting: startMutation.isPending, send };
}
