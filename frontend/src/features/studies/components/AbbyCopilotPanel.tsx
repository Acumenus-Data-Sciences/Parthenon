import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, Send, X } from "lucide-react";
import { useAbbyAgent } from "../hooks/useAbbyAgent";
import { useAbbyAgentStore } from "../stores/abbyAgentStore";
import { useAbbyDockStore } from "../stores/abbyDockStore";

interface AbbyCopilotPanelProps {
  slug: string;
}

/**
 * The omnipresent Abby orchestrator dock (ADR-0020 Phase 5b). Mounted once on
 * the study page and available on every tab: a floating launcher when closed, a
 * docked chat panel when open. Inline "Ask Abby about this" affordances on gate
 * cards, result rows, and the manuscript hand it a context-specific question via
 * the dock store — the dock then starts a session if needed and auto-sends.
 *
 * Abby proposes; every action is approval-gated and gate approvals/overrides
 * stay yours in the Gates timeline. A session is only started on explicit intent
 * (the user opens and asks, or fires an affordance) — never on mount — so it
 * never spends LLM budget unbidden.
 */
export function AbbyCopilotPanel({ slug }: AbbyCopilotPanelProps) {
  const { start, starting, send, approve } = useAbbyAgent({ slug });
  const { transcript, isStreaming, agentSessionId, errorMessage, pendingApprovals, lastCostUsd, actionsEnabled } =
    useAbbyAgentStore();
  const isOpen = useAbbyDockStore((s) => s.isOpen);
  const queuedPrompt = useAbbyDockStore((s) => s.queuedPrompt);
  const openWith = useAbbyDockStore((s) => s.openWith);
  const close = useAbbyDockStore((s) => s.close);
  const consumeQueued = useAbbyDockStore((s) => s.consumeQueued);

  const [draft, setDraft] = useState("");
  const autoStartedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-start a session + send a queued prompt fired by an inline affordance.
  useEffect(() => {
    if (!queuedPrompt) {
      autoStartedRef.current = false;
      return;
    }
    if (agentSessionId == null) {
      if (!autoStartedRef.current) {
        autoStartedRef.current = true;
        start();
      }
      return;
    }
    if (!isStreaming) {
      const prompt = consumeQueued();
      if (prompt) void send(prompt);
    }
  }, [queuedPrompt, agentSessionId, isStreaming, start, send, consumeQueued]);

  // Keep the transcript pinned to the latest message.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcript, isStreaming]);

  // Collapsed launcher.
  if (!isOpen) {
    return (
      <button
        type="button"
        data-testid="abby-dock-launcher"
        onClick={() => openWith()}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-[#0E0E11] shadow-lg shadow-black/30 hover:brightness-110 transition"
      >
        <Sparkles size={16} />
        Abby
        {pendingApprovals.length > 0 && (
          <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0E0E11] px-1 text-[10px] font-bold text-accent">
            {pendingApprovals.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      data-testid="abby-copilot-panel"
      className="fixed bottom-6 right-6 z-40 flex max-h-[72vh] w-[min(380px,calc(100vw-2rem))] flex-col rounded-xl border border-border-default bg-surface-raised shadow-2xl shadow-black/40"
    >
      <div className="flex items-center justify-between border-b border-border-muted px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-accent" />
          <h3 className="text-sm font-semibold text-text-primary">Abby Orchestrator</h3>
        </div>
        <div className="flex items-center gap-2">
          {agentSessionId != null && lastCostUsd != null && (
            <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-text-ghost">
              ${lastCostUsd.toFixed(3)}
            </span>
          )}
          <button
            type="button"
            aria-label="Close Abby"
            onClick={() => close()}
            className="rounded p-1 text-text-ghost hover:bg-surface-overlay hover:text-text-primary"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" ref={scrollRef}>
        {agentSessionId == null ? (
          <div className="space-y-3">
            {actionsEnabled ? (
              <p className="text-xs text-text-muted">
                Abby reads this study's design, gates, results, and manuscript, and can — on your
                one-click approval — re-evaluate gates, refresh results, build a study package, and
                open the manuscript in the Publisher. It never decides scientific validity: gate
                approvals and overrides stay yours in the Gates timeline.
              </p>
            ) : (
              <p data-testid="abby-readonly-note" className="text-xs text-text-muted">
                Abby reads this study's design, gates, results, and manuscript and answers your
                questions. Action-taking is disabled on this deployment — gate evaluations, result
                refreshes, and publishing run from the controls in each tab.
              </p>
            )}
            <button
              type="button"
              onClick={() => start()}
              disabled={starting}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/25 disabled:opacity-40"
            >
              {starting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Start Abby
            </button>
          </div>
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
                    data-testid="abby-approval-card"
                    className="rounded border border-accent/30 bg-accent/5 p-2 text-xs"
                  >
                    <p className="font-semibold text-accent">Approve action: {a.tool}</p>
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

            <div className="space-y-2">
              {transcript.map((turn, i) => (
                <div key={i}>
                  <span className="text-[10px] uppercase tracking-wider text-text-ghost">
                    {turn.role === "user" ? "You" : "Abby"}
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
          </>
        )}
      </div>

      {agentSessionId != null && (
        <form
          className="flex gap-2 border-t border-border-muted p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim() && !isStreaming) {
              void send(draft.trim());
              setDraft("");
            }
          }}
        >
          <input
            aria-label="Message Abby"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={isStreaming}
            placeholder="Ask Abby what's blocking this study…"
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
      )}
    </div>
  );
}
