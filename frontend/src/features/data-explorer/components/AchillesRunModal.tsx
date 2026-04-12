import { useState, useEffect, useRef } from "react";
import {
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Activity,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAchillesProgress } from "../hooks/useAchillesRun";
import type { AchillesRunCategory, AchillesRunStep } from "../api/achillesRunApi";

interface AchillesRunModalProps {
  sourceId: number;
  runId: string;
  totalAnalyses: number;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toFixed(0)}s`;
}

function LiveTimer({ startedAt, className }: { startedAt: string; className?: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const interval = setInterval(() => {
      setElapsed((Date.now() - start) / 1000);
    }, 100);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <span className={className ?? "font-['IBM_Plex_Mono',monospace] text-xs text-[#C9A227] tabular-nums"}>
      {elapsed < 60 ? `${elapsed.toFixed(1)}s` : `${Math.floor(elapsed / 60)}m ${(elapsed % 60).toFixed(0)}s`}
    </span>
  );
}

function StepRow({ step }: { step: AchillesRunStep }) {
  const [showError, setShowError] = useState(false);

  return (
    <div className="space-y-0">
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-3 rounded-md text-sm",
          step.status === "failed" && "bg-[#E85A6B]/5 cursor-pointer",
          step.status === "running" && "bg-[#C9A227]/5",
        )}
        onClick={() => step.status === "failed" && setShowError(!showError)}
      >
        {step.status === "pending" && <Clock size={13} className="text-[#5A5650] shrink-0" />}
        {step.status === "running" && <Loader2 size={13} className="animate-spin text-[#C9A227] shrink-0" />}
        {step.status === "completed" && <CheckCircle2 size={13} className="text-[#2DD4BF] shrink-0" />}
        {step.status === "failed" && <AlertCircle size={13} className="text-[#E85A6B] shrink-0" />}

        <span className={cn(
          "flex-1 truncate",
          step.status === "pending" && "text-[#5A5650]",
          step.status === "running" && "text-[#F0EDE8]",
          step.status === "completed" && "text-[#C5C0B8]",
          step.status === "failed" && "text-[#E85A6B]",
        )}>
          <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D] mr-1.5">
            {step.analysis_id}
          </span>
          {step.analysis_name}
        </span>

        {step.status === "running" && step.started_at && (
          <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#C9A227] tabular-nums">
            [<LiveTimer startedAt={step.started_at} />]
          </span>
        )}
        {step.status === "completed" && step.elapsed_seconds != null && (
          <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#5A5650] tabular-nums">
            {step.elapsed_seconds.toFixed(2)}s
          </span>
        )}
        {step.status === "failed" && (
          <ChevronDown size={12} className={cn("text-[#E85A6B] transition-transform", showError && "rotate-180")} />
        )}
      </div>
      {showError && step.error_message && (
        <div className="ml-7 px-3 py-2 text-xs text-[#E85A6B]/80 bg-[#E85A6B]/5 rounded-md border border-[#E85A6B]/10 font-['IBM_Plex_Mono',monospace] whitespace-pre-wrap break-all">
          {step.error_message}
        </div>
      )}
    </div>
  );
}

function CategorySection({ category, isHistorical }: { category: AchillesRunCategory; isHistorical: boolean }) {
  const isDone = category.completed + category.failed >= category.total;
  const hasRunning = category.running > 0;
  const [collapsed, setCollapsed] = useState(false);

  // Auto-collapse completed categories only during live runs (not historical viewing)
  const prevDoneRef = useRef(isDone);
  useEffect(() => {
    if (!isHistorical && isDone && !prevDoneRef.current) {
      setCollapsed(true);
    }
    prevDoneRef.current = isDone;
  }, [isDone, isHistorical]);

  const statusIcon = isDone
    ? category.failed > 0
      ? <AlertCircle size={14} className="text-[#E85A6B]" />
      : <CheckCircle2 size={14} className="text-[#2DD4BF]" />
    : hasRunning
      ? <Loader2 size={14} className="animate-spin text-[#C9A227]" />
      : <Clock size={14} className="text-[#5A5650]" />;

  return (
    <div className="rounded-xl border border-[#232328] bg-[#151518] overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-[#1A1A1E] transition-colors"
      >
        {collapsed ? <ChevronRight size={14} className="text-[#8A857D]" /> : <ChevronDown size={14} className="text-[#8A857D]" />}
        {statusIcon}
        <span className="text-sm font-medium text-[#F0EDE8] flex-1">{category.category}</span>
        <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D]">
          {category.completed}/{category.total}
        </span>
        {category.failed > 0 && (
          <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#E85A6B]">
            {category.failed} failed
          </span>
        )}
      </button>
      {!collapsed && (
        <div className="px-2 pb-2 space-y-0.5">
          {category.steps.map((step) => (
            <StepRow key={step.analysis_id} step={step} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AchillesRunModal({
  sourceId,
  runId,
  totalAnalyses,
  onClose,
}: AchillesRunModalProps) {
  const { data: progress } = useAchillesProgress(sourceId, runId);

  const completed = progress?.completed_analyses ?? 0;
  const failed = progress?.failed_analyses ?? 0;
  const total = progress?.total_analyses ?? totalAnalyses;
  const done = completed + failed;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const isFinished = progress?.status === "completed" || progress?.status === "failed";

  // Duration: use completed_at - started_at for finished runs, live clock for running
  const startedAt = progress?.started_at ? new Date(progress.started_at).getTime() : null;
  const completedAt = progress?.completed_at ? new Date(progress.completed_at).getTime() : null;
  const elapsedTotal = startedAt
    ? isFinished && completedAt
      ? (completedAt - startedAt) / 1000
      : (Date.now() - startedAt) / 1000
    : 0;

  // ETA calculation (only meaningful while running)
  const avgPerAnalysis = done > 0 ? elapsedTotal / done : 0;
  const remaining = (total - done) * avgPerAnalysis;

  // Historical = opened after run already finished (not watched live)
  const isHistorical = isFinished;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative flex flex-col w-full max-w-3xl max-h-[85vh] rounded-2xl border border-[#232328] bg-[#0E0E11] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#232328]">
          <div className="flex items-center gap-3">
            {isFinished ? (
              <Zap size={20} className="text-[#2DD4BF]" />
            ) : (
              <Activity size={20} className="text-[#C9A227] animate-pulse" />
            )}
            <div>
              <h2 className="text-base font-semibold text-[#F0EDE8]">
                Achilles Characterization
              </h2>
              <p className="text-xs text-[#5A5650]">
                {isFinished
                  ? `Completed in ${formatDuration(elapsedTotal)}`
                  : `${done} of ${total} analyses`}
                {!isFinished && startedAt && (
                  <span className="ml-2 text-[#8A857D]">
                    Elapsed: <LiveTimer startedAt={progress!.started_at!} className="text-xs text-[#8A857D] font-['IBM_Plex_Mono',monospace] tabular-nums" />
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#1A1A1E] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress bar + stats */}
        <div className="px-6 py-4 border-b border-[#232328] space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-['IBM_Plex_Mono',monospace] text-[#C9A227] text-lg font-semibold">
              {pct.toFixed(1)}%
            </span>
            <div className="flex items-center gap-4">
              {completed > 0 && (
                <span className="flex items-center gap-1 text-xs text-[#2DD4BF]">
                  <CheckCircle2 size={12} /> {completed} passed
                </span>
              )}
              {failed > 0 && (
                <span className="flex items-center gap-1 text-xs text-[#E85A6B]">
                  <AlertCircle size={12} /> {failed} failed
                </span>
              )}
              {isFinished && elapsedTotal > 0 && (
                <span className="flex items-center gap-1 text-xs text-[#8A857D]">
                  <Clock size={12} /> {formatDuration(elapsedTotal)} total
                </span>
              )}
              {!isFinished && remaining > 0 && (
                <span className="flex items-center gap-1 text-xs text-[#8A857D]">
                  <Clock size={12} /> ~{formatDuration(remaining)} remaining
                </span>
              )}
            </div>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#1A1A1E]">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${pct}%`,
                background: failed > 0
                  ? "linear-gradient(90deg, #C9A227 0%, #E85A6B 100%)"
                  : "linear-gradient(90deg, #C9A227 0%, #2DD4BF 100%)",
              }}
            />
          </div>
        </div>

        {/* Category list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {progress?.categories && progress.categories.length > 0 ? (
            progress.categories.map((cat) => (
              <CategorySection key={cat.category} category={cat} isHistorical={isHistorical} />
            ))
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-[#8A857D]" />
              <span className="ml-2 text-sm text-[#5A5650]">Waiting for analyses to start...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-[#232328]">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              isFinished
                ? "bg-[#2DD4BF]/10 text-[#2DD4BF] hover:bg-[#2DD4BF]/20"
                : "bg-[#1A1A1E] text-[#C5C0B8] hover:bg-[#232328]",
            )}
          >
            {isFinished ? "Done" : "Run in Background"}
          </button>
        </div>
      </div>
    </div>
  );
}
