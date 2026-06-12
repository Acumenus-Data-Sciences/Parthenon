import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AgentCopilotShell } from "@/components/agent/AgentCopilotShell";
import { useStudyDesignerAgent } from "../../../hooks/useStudyDesignerAgent";
import { useStudyDesignerAgentStore } from "../../../stores/studyDesignerAgentStore";
import { AgentTranscript } from "./AgentTranscript";

interface Props {
  slug: string | null;
  sessionId: number | null;
  versionId: number | null;
}

export function AgentCopilotPanel({ slug, sessionId, versionId }: Props) {
  const { t } = useTranslation("app");
  const { start, starting, send } = useStudyDesignerAgent({ slug, sessionId, versionId });
  const { transcript, isStreaming, agentSessionId, errorMessage } = useStudyDesignerAgentStore();
  const startAttemptedRef = useRef(false);

  // Reset the one-shot start guard when the design-session context changes.
  useEffect(() => {
    startAttemptedRef.current = false;
  }, [slug, sessionId]);

  // Auto-start exactly once per session context. The ref survives React 19
  // strict-mode double-invoke and in-flight re-renders, preventing duplicate
  // agent sessions + scoped tokens.
  useEffect(() => {
    if (agentSessionId == null && !startAttemptedRef.current && slug && sessionId) {
      startAttemptedRef.current = true;
      start();
    }
  }, [agentSessionId, slug, sessionId, start]);

  return (
    <AgentCopilotShell
      title={t("studies.agent.title", "Study Designer Assistant")}
      errorMessage={errorMessage}
      onSend={(message) => void send(message)}
      disabled={starting || agentSessionId == null}
      streaming={isStreaming}
      inputLabel={t("studies.agent.input", "Message the assistant")}
      sendLabel={t("common.send", "Send")}
      sendVariant="primary"
    >
      <AgentTranscript transcript={transcript} isStreaming={isStreaming} />
    </AgentCopilotShell>
  );
}
