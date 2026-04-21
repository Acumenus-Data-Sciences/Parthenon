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
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useRunRiskScores } from "../hooks/useRiskScores";
import type { RunOutcome, RunScoreResult } from "../types/riskScore";
import { formatRiskScoreDuration } from "../lib/i18n";

interface RiskScoreRunModalProps {
  sourceId: number;
  scoreIds?: string[];
  onClose: () => void;
}

function ScoreResultRow({ result }: { result: RunScoreResult }) {
  const { t } = useTranslation("app");
  const [showError, setShowError] = useState(false);

  return (
    <div className="space-y-0">
      <div
        className={cn(
          "flex cursor-default items-center gap-2 rounded-md px-3 py-2 text-sm",
          result.status === "failed" && "cursor-pointer bg-critical/5",
          result.status === "completed" && "hover:bg-surface-overlay",
        )}
        onClick={() => {
          if (result.status === "failed") setShowError(!showError);
        }}
      >
        {result.status === "completed" && (
          <CheckCircle2 size={14} className="shrink-0 text-success" />
        )}
        {result.status === "failed" && (
          <AlertCircle size={14} className="shrink-0 text-critical" />
        )}

        <span
          className={cn(
            "flex-1 truncate",
            result.status === "completed" && "text-text-secondary",
            result.status === "failed" && "text-critical",
          )}
        >
          <span className="mr-1.5 font-['IBM_Plex_Mono',monospace] text-xs text-text-muted">
            {result.score_id}
          </span>
          {result.score_name}
        </span>

        {result.status === "completed" && result.tiers != null && (
          <span className="font-['IBM_Plex_Mono',monospace] text-xs tabular-nums text-text-ghost">
            {t("riskScores.runModal.tiers", { count: result.tiers })}
          </span>
        )}
        {result.status === "completed" && result.elapsed_ms != null && (
          <span className="font-['IBM_Plex_Mono',monospace] text-xs tabular-nums text-text-ghost">
            {formatRiskScoreDuration(t, result.elapsed_ms)}
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
        <div className="ml-7 whitespace-pre-wrap break-all rounded-md border border-critical/10 bg-critical/5 px-3 py-2 font-['IBM_Plex_Mono',monospace] text-xs text-critical/80">
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
  const { t } = useTranslation("app");
  const mutation = useRunRiskScores(sourceId);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    mutation.mutate(scoreIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mutation.isPending) {
      startRef.current = Date.now();
      const interval = setInterval(() => {
        if (startRef.current !== null) {
          setElapsed(Date.now() - startRef.current);
        }
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
  const skipped =
    scoreIds && outcome ? Math.max(0, scoreIds.length - outcome.scores.length) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-border-default bg-surface-base shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-default px-6 py-4">
          <div className="flex items-center gap-3">
            {isFinished ? (
              <Zap size={20} className="text-success" />
            ) : (
              <Activity size={20} className="animate-pulse text-accent" />
            )}
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                {t("riskScores.runModal.title")}
              </h2>
              <p className="text-xs text-text-ghost">
                {mutation.isPending && (
                  <>
                    {t("riskScores.runModal.computingScores")}{" "}
                    <span className="font-['IBM_Plex_Mono',monospace] tabular-nums text-accent">
                      {(elapsed / 1000).toFixed(1)}s
                    </span>
                  </>
                )}
                {mutation.isSuccess &&
                  t("riskScores.runModal.completedScoresIn", {
                    count: total,
                    duration: formatRiskScoreDuration(t, elapsed),
                  })}
                {mutation.isError && t("riskScores.runModal.runFailed")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-overlay hover:text-text-primary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 border-b border-border-default px-6 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-['IBM_Plex_Mono',monospace] text-lg font-semibold text-accent">
              {mutation.isPending ? "..." : `${pct}%`}
            </span>
            <div className="flex items-center gap-4">
              {completed > 0 && (
                <span className="flex items-center gap-1 text-xs text-success">
                  <CheckCircle2 size={12} />{" "}
                  {t("riskScores.runModal.passed", { count: completed })}
                </span>
              )}
              {failed > 0 && (
                <span className="flex items-center gap-1 text-xs text-critical">
                  <AlertCircle size={12} />{" "}
                  {t("riskScores.runModal.failed", { count: failed })}
                </span>
              )}
              {skipped > 0 && (
                <span className="flex items-center gap-1 text-xs text-text-muted">
                  <SkipForward size={12} />{" "}
                  {t("riskScores.runModal.skipped", { count: skipped })}
                </span>
              )}
              {isFinished && elapsed > 0 && (
                <span className="flex items-center gap-1 text-xs text-text-muted">
                  <Clock size={12} />{" "}
                  {t("riskScores.common.duration.total", {
                    value: formatRiskScoreDuration(t, elapsed),
                  })}
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
                    ? "linear-gradient(90deg, #C9A227 0%, #E85A6B 100%)"
                    : "linear-gradient(90deg, #C9A227 0%, #2DD4BF 100%)",
              }}
            />
          </div>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto px-6 py-4">
          {mutation.isPending && (
            <div className="flex flex-col items-center justify-center gap-4 py-10">
              <div className="relative h-24 w-24">
                <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke="var(--surface-overlay)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
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
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-['IBM_Plex_Mono',monospace] text-xl font-semibold tabular-nums text-accent">
                    {(elapsed / 1000).toFixed(1)}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-text-ghost">
                    {t("riskScores.runModal.seconds")}
                  </span>
                </div>
              </div>
            </div>
          )}

          {outcome?.scores.map((result) => (
            <ScoreResultRow key={result.score_id} result={result} />
          ))}
        </div>
      </div>
    </div>
  );
}
