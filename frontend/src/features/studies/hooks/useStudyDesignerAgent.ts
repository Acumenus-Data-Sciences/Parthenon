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
  const store = useStudyDesignerAgentStore();
  const subscribedRef = useRef<string | null>(null);

  const startMutation = useMutation({
    mutationFn: () => startAgentSession(slug!, sessionId!, versionId),
    onSuccess: (data) => store.setSession(data.agent_session_id, data.channel_name),
  });

  useEffect(() => {
    const channel = store.channelName;
    if (!channel) return;
    const echo = getEcho();
    if (!echo) return;

    const name = channel.replace(/^private-/, "");
    if (subscribedRef.current === name) return;
    if (subscribedRef.current) echo.leave(subscribedRef.current);

    echo
      .private(name)
      .listen(".agent.text.delta", (e: unknown) => store.applyEvent({ type: "text", ...agentTextDelta.parse(e) }))
      .listen(".agent.tool.start", (e: unknown) => {
        const p = agentToolStart.parse(e);
        store.applyEvent({ type: "tool", name: p.name, input: p.input });
      })
      .listen(".agent.turn.done", (e: unknown) => {
        store.applyEvent({ type: "done", costUsd: agentTurnDone.parse(e).cost_usd });
        if (slug && sessionId && versionId) invalidateStudyDesignCompiler(qc, slug, sessionId, versionId);
      })
      .listen(".agent.error", (e: unknown) => store.applyEvent({ type: "error", ...agentError.parse(e) }));

    subscribedRef.current = name;
    return () => {
      echo.leave(name);
      subscribedRef.current = null;
    };
  }, [store, slug, sessionId, versionId, qc]);

  const send = useCallback(
    async (text: string) => {
      if (!slug || !sessionId || store.agentSessionId == null) return;
      store.pushUserMessage(text);
      await sendAgentMessage(slug, sessionId, store.agentSessionId, text);
    },
    [slug, sessionId, store],
  );

  return { start: startMutation.mutate, starting: startMutation.isPending, send };
}
