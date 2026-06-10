import { useState } from "react";
import { Sparkles, Loader2, Send } from "lucide-react";
import { useClioAgent } from "../hooks/useClioAgent";
import { useClioAgentStore } from "../stores/clioAgentStore";

interface ClioCopilotPanelProps {
  slug: string;
}

/**
 * The Clio orchestrator surface (ADR-0020 Phase 5b). Lets a study collaborator
 * start a Clio session, chat with it, and approve/reject its approval-gated
 * actions. Started explicitly (not on mount) since each session consumes LLM
 * budget. Clio proposes; gate approvals/overrides stay in the Gates timeline.
 */
export function ClioCopilotPanel({ slug }: ClioCopilotPanelProps) {
  const { start, starting, send, approve } = useClioAgent({ slug });
  const { transcript, isStreaming, agentSessionId, errorMessage, pendingApprovals, lastCostUsd } =
    useClioAgentStore();
  const [draft, setDraft] = useState("");

  return (
    <div
      data-testid="clio-copilot-panel"
      className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-accent" />
          <h3 className="text-sm font-semibold text-text-primary">Clio Orchestrator</h3>
        </div>
        {agentSessionId == null ? (
          <button
            type="button"
            onClick={() => start()}
            disabled={starting}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/25 disabled:opacity-40"
          >
            {starting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Start Clio
          </button>
        ) : (
          lastCostUsd != null && (
            <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-text-ghost">
              ${lastCostUsd.toFixed(3)}
            </span>
          )
        )}
      </div>

      {agentSessionId == null ? (
        <p className="text-xs text-text-muted">
          Clio reads this study's gates, evaluates them from the latest diagnostics, and explains
          what is blocking progress — proposing concrete remediations. It never decides validity:
          gate approvals and overrides stay yours in the timeline above.
        </p>
      ) : (
        <>
          {errorMessage && (
            <div className="rounded bg-critical/15 p-2 text-xs text-critical">{errorMessage}</div>
          )}

          {pendingApprovals.length > 0 && (
            <div className="space-y-2">
              {pendingApprovals.map((a) => (
                <div
                  key={a.toolUseId}
                  data-testid="clio-approval-card"
                  className="rounded border border-accent/30 bg-accent/5 p-2 text-xs"
                >
                  <p className="font-semibold text-accent">{a.tool}</p>
                  <p className="mb-2 break-all text-text-muted">
                    {JSON.stringify(a.input).slice(0, 160)}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void approve(a.toolUseId, true)}
                      className="rounded bg-success/20 px-2 py-0.5 text-success"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void approve(a.toolUseId, false)}
                      className="rounded bg-critical/20 px-2 py-0.5 text-critical"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="max-h-80 space-y-2 overflow-y-auto">
            {transcript.map((turn, i) => (
              <div key={i}>
                <span className="text-[10px] uppercase tracking-wider text-text-ghost">
                  {turn.role === "user" ? "You" : "Clio"}
                </span>
                <p
                  className={
                    "whitespace-pre-wrap text-xs " +
                    (turn.role === "user" ? "text-text-secondary" : "text-text-primary")
                  }
                >
                  {turn.text}
                </p>
                {turn.tools && turn.tools.length > 0 && (
                  <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-[10px] text-text-ghost">
                    ↳ {turn.tools.map((t) => t.name).join(", ")}
                  </p>
                )}
              </div>
            ))}
            {isStreaming && <Loader2 size={12} className="animate-spin text-text-ghost" />}
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim() && !isStreaming) {
                void send(draft.trim());
                setDraft("");
              }
            }}
          >
            <input
              aria-label="Message Clio"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={isStreaming}
              placeholder="Ask Clio what's blocking this study…"
              className="flex-1 rounded-md border border-border-default bg-surface-base px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={isStreaming}
              className="rounded-md bg-accent/15 px-3 py-1.5 text-xs text-accent disabled:opacity-40"
            >
              <Send size={12} />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
