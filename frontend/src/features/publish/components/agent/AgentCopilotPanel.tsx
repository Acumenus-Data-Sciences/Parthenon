import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AgentCopilotShell } from "@/components/agent/AgentCopilotShell";
import { usePublishAgent } from "../../hooks/usePublishAgent";
import { usePublishAgentStore } from "../../stores/publishAgentStore";
import { AgentTranscript } from "./AgentTranscript";

interface Props {
  draftId: number | null;
}

export function AgentCopilotPanel({ draftId }: Props) {
  const { t } = useTranslation("app");
  const { start, starting, send, approve } = usePublishAgent({ draftId });
  const { transcript, isStreaming, agentSessionId, errorMessage, pendingApprovals } =
    usePublishAgentStore();
  const startAttemptedRef = useRef(false);

  // Reset the one-shot start guard when the draft context changes.
  useEffect(() => {
    startAttemptedRef.current = false;
  }, [draftId]);

  // Auto-start exactly once per draft context. The ref survives React 19
  // strict-mode double-invoke and in-flight re-renders, preventing duplicate
  // agent sessions + scoped tokens.
  useEffect(() => {
    if (agentSessionId == null && !startAttemptedRef.current && draftId != null) {
      startAttemptedRef.current = true;
      start();
    }
  }, [agentSessionId, draftId, start]);

  return (
    <AgentCopilotShell
      title={t("publish.agent.title", "Publication Assistant")}
      errorMessage={errorMessage}
      onSend={(message) => void send(message)}
      disabled={starting || agentSessionId == null}
      streaming={isStreaming}
      inputLabel={t("publish.agent.input", "Message the assistant")}
      sendLabel={t("common.send", "Send")}
      sendVariant="publish"
      approvals={pendingApprovals.map((approval) => ({
        toolUseId: approval.toolUseId,
        tool: approval.tool,
        input: approval.input,
      }))}
      approveLabel={t("publish.agent.approve", "Approve")}
      rejectLabel={t("publish.agent.reject", "Reject")}
      onApprove={(toolUseId, approved) => void approve(toolUseId, approved)}
    >
      <AgentTranscript transcript={transcript} isStreaming={isStreaming} />
    </AgentCopilotShell>
  );
}
