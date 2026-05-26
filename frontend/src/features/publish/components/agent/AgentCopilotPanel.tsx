import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePublishAgent } from "../../hooks/usePublishAgent";
import { usePublishAgentStore } from "../../stores/publishAgentStore";
import { AgentTranscript } from "./AgentTranscript";

interface Props {
  draftId: number | null;
}

export function AgentCopilotPanel({ draftId }: Props) {
  const { t } = useTranslation();
  const { start, starting, send, approve } = usePublishAgent({ draftId });
  const { transcript, isStreaming, agentSessionId, errorMessage, pendingApprovals } =
    usePublishAgentStore();
  const [draft, setDraft] = useState("");
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
    <aside data-testid="agent-copilot-panel" className="flex h-full w-[360px] flex-col border-l border-white/10 bg-[#0E0E11] p-4">
      <h2 className="mb-2 text-sm font-semibold text-slate-200">{t("publish.agent.title", "Publication Assistant")}</h2>
      {errorMessage && <div className="mb-2 rounded bg-[#9B1B30]/20 p-2 text-xs text-[#9B1B30]">{errorMessage}</div>}
      {pendingApprovals.length > 0 && (
        <div className="mb-2 flex flex-col gap-2">
          {pendingApprovals.map((approval) => (
            <div
              key={approval.toolUseId}
              data-testid="approval-card"
              className="rounded border border-white/10 bg-white/5 p-2 text-xs text-slate-200"
            >
              <p className="mb-1 font-semibold text-[#C9A227]">{approval.tool}</p>
              <p className="mb-2 break-all text-slate-400">
                {JSON.stringify(approval.input).slice(0, 160)}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void approve(approval.toolUseId, true)}
                  className="rounded bg-[#2DD4BF] px-2 py-0.5 text-black"
                >
                  {t("publish.agent.approve", "Approve")}
                </button>
                <button
                  type="button"
                  onClick={() => void approve(approval.toolUseId, false)}
                  className="rounded bg-[#9B1B30] px-2 py-0.5 text-white"
                >
                  {t("publish.agent.reject", "Reject")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        <AgentTranscript transcript={transcript} isStreaming={isStreaming} />
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim() && !isStreaming) {
            void send(draft.trim());
            setDraft("");
          }
        }}
      >
        <input
          aria-label={t("publish.agent.input", "Message the assistant")}
          className="flex-1 rounded bg-white/5 px-2 py-1 text-sm text-slate-100"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={starting || agentSessionId == null}
        />
        <button type="submit" disabled={isStreaming || agentSessionId == null} className="rounded bg-[#2DD4BF] px-3 py-1 text-sm text-black disabled:opacity-40">
          {t("common.send", "Send")}
        </button>
      </form>
    </aside>
  );
}
