import { useState, type ReactNode } from "react";

export interface AgentApproval {
  toolUseId: string;
  tool: string;
  input: unknown;
}

interface AgentCopilotShellProps {
  title: string;
  errorMessage?: string | null;
  /** The transcript view — each feature passes its own AgentTranscript. */
  children: ReactNode;
  onSend: (message: string) => void;
  /** Disable input/send (no active session yet, or starting). */
  disabled: boolean;
  /** A response is streaming — blocks submit. */
  streaming: boolean;
  inputLabel: string;
  sendLabel: string;
  /** Send-button accent: gold for publishing surfaces, crimson elsewhere. */
  sendVariant?: "publish" | "primary";
  approvals?: AgentApproval[];
  approveLabel?: string;
  rejectLabel?: string;
  onApprove?: (toolUseId: string, approved: boolean) => void;
}

/**
 * Shared chrome for the AI copilot side-panels (the Studies design-session
 * assistant and the /publish authoring assistant). Presentational only: each
 * feature wires its own agent hook + store and passes its transcript as
 * children, so the two panels stop being near-duplicate copies.
 */
export function AgentCopilotShell({
  title,
  errorMessage,
  children,
  onSend,
  disabled,
  streaming,
  inputLabel,
  sendLabel,
  sendVariant = "primary",
  approvals,
  approveLabel,
  rejectLabel,
  onApprove,
}: AgentCopilotShellProps) {
  const [draft, setDraft] = useState("");

  return (
    <aside
      data-testid="agent-copilot-panel"
      className="flex h-full w-[360px] flex-col border-l border-border-default bg-surface-base p-4"
    >
      <h2 className="mb-2 text-sm font-semibold text-text-secondary">{title}</h2>
      {errorMessage && (
        <div className="mb-2 rounded bg-critical/10 p-2 text-xs text-critical">{errorMessage}</div>
      )}
      {approvals && approvals.length > 0 && onApprove && (
        <div className="mb-2 flex flex-col gap-2">
          {approvals.map((approval) => (
            <div
              key={approval.toolUseId}
              data-testid="approval-card"
              className="rounded border border-border-default bg-surface-elevated p-2 text-xs text-text-secondary"
            >
              <p className="mb-1 font-semibold text-accent">{approval.tool}</p>
              <p className="mb-2 break-all text-text-muted">
                {JSON.stringify(approval.input).slice(0, 160)}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onApprove(approval.toolUseId, true)}
                  className="rounded bg-success px-2 py-0.5 text-surface-base"
                >
                  {approveLabel}
                </button>
                <button
                  type="button"
                  onClick={() => onApprove(approval.toolUseId, false)}
                  className="rounded bg-critical px-2 py-0.5 text-white"
                >
                  {rejectLabel}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-y-auto">{children}</div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim() && !streaming) {
            onSend(draft.trim());
            setDraft("");
          }
        }}
      >
        <input
          aria-label={inputLabel}
          className="flex-1 rounded border border-border-default bg-surface-elevated px-2 py-1 text-sm text-text-primary"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={disabled}
        />
        <button
          type="submit"
          disabled={streaming || disabled}
          className={`btn btn-sm ${sendVariant === "publish" ? "btn-publish" : "btn-primary"}`}
        >
          {sendLabel}
        </button>
      </form>
    </aside>
  );
}
