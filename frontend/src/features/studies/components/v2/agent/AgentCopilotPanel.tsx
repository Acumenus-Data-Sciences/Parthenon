import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStudyDesignerAgent } from "../../../hooks/useStudyDesignerAgent";
import { useStudyDesignerAgentStore } from "../../../stores/studyDesignerAgentStore";
import { AgentTranscript } from "./AgentTranscript";

interface Props {
  slug: string | null;
  sessionId: number | null;
  versionId: number | null;
}

export function AgentCopilotPanel({ slug, sessionId, versionId }: Props) {
  const { t } = useTranslation();
  const { start, starting, send } = useStudyDesignerAgent({ slug, sessionId, versionId });
  const { transcript, isStreaming, agentSessionId, errorMessage } = useStudyDesignerAgentStore();
  const [draft, setDraft] = useState("");
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
    <aside data-testid="agent-copilot-panel" className="flex h-full w-[360px] flex-col border-l border-white/10 bg-[#0E0E11] p-4">
      <h2 className="mb-2 text-sm font-semibold text-slate-200">{t("studies.agent.title", "Study Designer Assistant")}</h2>
      {errorMessage && <div className="mb-2 rounded bg-[#9B1B30]/20 p-2 text-xs text-[#9B1B30]">{errorMessage}</div>}
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
          aria-label={t("studies.agent.input", "Message the assistant")}
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
