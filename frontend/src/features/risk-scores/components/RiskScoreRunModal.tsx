import { useState, useEffect, useRef } from "react";
import {
  X,
  CheckCircle2,
  AlertCircle,
  SkipForward,
  Clock,
  ChevronDown,
  Activity,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRunRiskScores } from "../hooks/useRiskScores";
import type { RunOutcome, RunScoreResult } from "../types/riskScore";

interface RiskScoreRunModalProps {
  sourceId: number;
  scoreIds?: string[];
  onClose: () => void;
}

function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toFixed(0)}s`;
}

function ScoreResultRow({ result }: { result: RunScoreResult }) {
  const [showError, setShowError] = useState(false);

  return (
    <div className="space-y-0">
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 rounded-md text-sm",
          result.status === "failed" && "bg-critical/5 cursor-pointer",
          result.status === "completed" && "hover:bg-surface-overlay",
        )}
        onClick={() =>
          result.status === "failed" && setShowError(!showError)
        }
      >
        {result.status === "completed" && (
          <CheckCircle2 size={14} className="text-success shrink-0" />
        )}
        {result.status === "failed" && (
          <AlertCircle size={14} className="text-critical shrink-0" />
        )}

        <span
          className={cn(
            "flex-1 truncate",
            result.status === "completed" && "text-text-secondary",
            result.status === "failed" && "text-critical",
          )}
        >
          <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-muted mr-1.5">
            {result.score_id}
          </span>
          {result.score_name}
        </span>

        {result.status === "completed" && result.tiers != null && (
          <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-ghost tabular-nums">
            {result.tiers} tiers
          </span>
        )}
        {result.status === "completed" && result.elapsed_ms != null && (
          <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-ghost tabular-nums">
            {formatDuration(result.elapsed_ms)}
          </span>
        )}
        {result.status === "failed" && (
          <ChevronDown
            size={12}
            className={cn(
              "text-critical transition-transform",
              showError && "rotate-180",
            )}
          />
        )}
      </div>
      {showError && result.error && (
        <div className="ml-7 px-3 py-2 text-xs text-critical/80 bg-critical/5 rounded-md border border-critical/10 font-['IBM_Plex_Mono',monospace] whitespace-pre-wrap break-all">
          {result.error}
        </div>
      )}
    </div>
  );
}

export function RiskScoreRunModal({
  sourceId,
  scoreIds,
  onClose,
}: RiskScoreRunModalProps) {
  const mutation = useRunRiskScores(sourceId);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  // Fire the request on mount
  useEffect(() => {
    mutation.mutate(scoreIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live timer while pending
  useEffect(() => {
    if (mutation.isPending) {
      startRef.current = Date.now();
      const interval = setInterval(() => {
        setElapsed(Date.now() - startRef.current);
      }, 100);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [mutation.isPending]);

  const outcome: RunOutcome | undefined = mutation.data;
  const isFinished = mutation.isSuccess || mutation.isError;
  const completed = outcome?.completed ?? 0;
  const failed = outcome?.failed ?? 0;
  const total = completed + failed;
  const pct = total > 0 ? 100 : 0;

  // Count skipped (score_ids provided but not in results)
  const skipped =
    scoreIds && outcome
      ? Math.max(0, scoreIds.length - outcome.scores.length)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative flex flex-col w-full max-w-2xl max-h-[80vh] rounded-2xl border border-border-default bg-surface-base shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
          <div className="flex items-center gap-3">
            {isFinished ? (
              <Zap size={20} className="text-success" />
            ) : (
              <Activity
                size={20}
                className="text-accent animate-pulse"
              />
            )}
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                Population Risk Scores
              </h2>
              <p className="text-xs text-text-ghost">
                {mutation.isPending && (
                  <>
                    Computing scores...{" "}
                    <span className="font-['IBM_Plex_Mono',monospace] text-accent tabular-nums">
                      {(elapsed / 1000).toFixed(1)}s
                    </span>
                  </>
                )}
                {mutation.isSuccess &&
                  `Completed ${total} score${total !== 1 ? "s" : ""} in ${formatDuration(elapsed)}`}
                {mutation.isError && "Run failed"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress bar + stats */}
        <div className="px-6 py-4 border-b border-border-default space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-['IBM_Plex_Mono',monospace] text-accent text-lg font-semibold">
              {mutation.isPending ? "..." : `${pct}%`}
            </span>
            <div className="flex items-center gap-4">
              {completed > 0 && (
                <span className="flex items-center gap-1 text-xs text-success">
                  <CheckCircle2 size={12} /> {completed} passed
                </span>
              )}
              {failed > 0 && (
                <span className="flex items-center gap-1 text-xs text-critical">
                  <AlertCircle size={12} /> {failed} failed
                </span>
              )}
              {skipped > 0 && (
                <span className="flex items-center gap-1 text-xs text-text-muted">
                  <SkipForward size={12} /> {skipped} skipped
                </span>
              )}
              {isFinished && elapsed > 0 && (
                <span className="flex items-center gap-1 text-xs text-text-muted">
                  <Clock size={12} /> {formatDuration(elapsed)} total
                </span>
              )}
            </div>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-overlay">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300 ease-out",
                mutation.isPending && "animate-pulse",
              )}
              style={{
                width: mutation.isPending ? "60%" : `${pct}%`,
                background:
                  failed > 0
                    ? "linear-gradient(90deg, var(--accent) 0%, var(--critical) 100%)"
                    : "linear-gradient(90deg, var(--accent) 0%, var(--success) 100%)",
              }}
            />
          </div>
        </div>

        {/* Score results list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
          {mutation.isPending && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              {/* Circular progress indicator */}
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                  {/* Background circle */}
                  <circle
                    cx="48" cy="48" r="40"
                    fill="none"
                    stroke="var(--surface-overlay)"
                    strokeWidth="6"
                  />
                  {/* Animated progress arc */}
                  <circle
                    cx="48" cy="48" r="40"
                    fill="none"
                    stroke="url(#progressGradient)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${251.3 * 0.75} ${251.3 * 0.25}`}
                    className="animate-spin"
                    style={{ animationDuration: "2s" }}
                  />
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="var(--accent)" />
                      <stop offset="100%" stopColor="var(--success)" />
                    </linearGradient>
                  </defs>
                </svg>
                {/* Elapsed time in center */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-['IBM_Plex_Mono',monospace] text-xl font-semibold text-accent tabular-nums">
                    {(elapsed / 1000).toFixed(1)}
                  </span>
                  <span className="text-[9px] text-text-ghost uppercase tracking-wider">
                    seconds
                  </span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-text-secondary">
                  Computing {scoreIds?.length ?? "all"} risk score{(scoreIds?.length ?? 0) !== 1 ? "s" : ""}...
                </p>
                <p className="text-xs text-text-ghost mt-1">
                  This may take a few moments for large populations
                </p>
              </div>
            </div>
          )}

          {mutation.isError && (
            <div className="rounded-xl border border-critical/20 bg-critical/5 p-4">
              <p className="text-sm text-critical">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : "An unexpected error occurred while running risk scores."}
              </p>
            </div>
          )}

          {outcome?.scores.map((s) => (
            <ScoreResultRow key={s.score_id} result={s} />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-border-default">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              isFinished
                ? "bg-success/10 text-success hover:bg-success/20"
                : "bg-surface-overlay text-text-secondary hover:bg-surface-elevated",
            )}
          >
            {isFinished ? "Done" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
