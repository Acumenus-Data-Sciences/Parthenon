import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, CheckCircle2, XCircle, Clock, X } from "lucide-react";

export interface JobProgressModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  logOutput: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const STATUS_CONFIG = {
  pending: {
    badge: "bg-amber-900/40 text-amber-400 border-amber-700/50",
    labelKey: "ui.job.status.pending",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  running: {
    badge: "bg-blue-900/40 text-blue-400 border-blue-700/50",
    labelKey: "ui.job.status.running",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  },
  completed: {
    badge: "bg-emerald-900/40 text-emerald-400 border-emerald-700/50",
    labelKey: "ui.job.status.completed",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  failed: {
    badge: "bg-red-900/40 text-red-400 border-red-700/50",
    labelKey: "ui.job.status.failed",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
} as const;

export function JobProgressModal({
  open,
  onClose,
  title,
  description,
  status,
  progress,
  logOutput,
  startedAt,
  completedAt,
  errorMessage,
}: JobProgressModalProps) {
  const { t } = useTranslation("common");
  const [elapsed, setElapsed] = useState(0);
  const logRef = useRef<HTMLPreElement>(null);
  const isTerminal = status === "completed" || status === "failed";

  // Elapsed time ticker
  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }

    const start = new Date(startedAt).getTime();

    if (completedAt) {
      const end = new Date(completedAt).getTime();
      setElapsed(Math.floor((end - start) / 1000));
      return;
    }

    const tick = () => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, completedAt]);

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logOutput]);

  if (!open) return null;

  const cfg = STATUS_CONFIG[status];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={isTerminal ? onClose : undefined}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-border-default bg-surface-raised shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border-default px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h2 className="truncate text-base font-semibold text-text-primary">
                {title}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.badge}`}
              >
                {cfg.icon}
                {t(cfg.labelKey)}
              </span>
            </div>
            {description && (
              <p className="mt-1 text-sm text-text-muted">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={!isTerminal}
            className="ml-3 rounded p-1 text-text-ghost transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={t("ui.aria.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-4">
          {/* Progress bar + percentage */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">{t("ui.job.progress")}</span>
              <span className="font-mono font-medium text-text-primary">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-elevated">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>

          {/* Timer */}
          {startedAt && (
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Clock className="h-3 w-3" />
              <span>
                {isTerminal ? t("ui.job.duration") : t("ui.job.elapsed")}:{" "}
                <span className="font-mono text-text-primary">
                  {formatElapsed(elapsed)}
                </span>
              </span>
            </div>
          )}

          {/* Log viewer */}
          {logOutput && (
            <pre
              ref={logRef}
              className="max-h-[200px] overflow-y-auto rounded-lg border border-border-default bg-surface-base p-3 font-mono text-xs leading-relaxed text-text-muted"
            >
              {logOutput}
            </pre>
          )}

          {/* Success banner */}
          {status === "completed" && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>{t("ui.job.completedSuccessfully")}</span>
            </div>
          )}

          {/* Error banner */}
          {status === "failed" && errorMessage && (
            <div className="flex items-start gap-2 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-sm text-red-400">
              <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        {isTerminal && (
          <div className="flex justify-end border-t border-border-default px-5 py-3">
            <button
              onClick={onClose}
              className="rounded-lg bg-surface-elevated px-4 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-accent"
            >
              {t("ui.aria.close")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
