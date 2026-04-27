import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileUp,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Progress } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ProtocolImportPhase } from "./protocolImportProgress";

interface ProtocolImportProgressProps {
  phase: ProtocolImportPhase;
  elapsedSeconds: number;
  fileName?: string | null;
  className?: string;
}

const workflowSteps = ["uploading", "analyzing", "output"] as const;

export function ProtocolImportProgress({
  phase,
  elapsedSeconds,
  fileName,
  className,
}: ProtocolImportProgressProps) {
  const { t } = useTranslation("app");

  if (phase === "idle") return null;

  const statusIcon = phase === "output"
    ? <CheckCircle2 className="h-4 w-4 text-success" />
    : phase === "error"
      ? <AlertTriangle className="h-4 w-4 text-critical" />
      : <Loader2 className="h-4 w-4 animate-spin text-accent" />;
  const progressValue = protocolImportProgressValue(phase, elapsedSeconds);
  const progressVariant = phase === "output" ? "success" : phase === "error" ? "critical" : "info";

  return (
    <div
      className={cn(
        "rounded-lg border border-border-default bg-surface-raised/80 p-3",
        className,
      )}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10">
            {statusIcon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">
              {t(`studies.designer.protocolImport.phases.${phase}.label`)}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              {t(`studies.designer.protocolImport.phases.${phase}.detail`)}
            </p>
            {fileName && (
              <p className="mt-1 truncate text-xs text-text-ghost">
                {t("studies.designer.protocolImport.file", { name: fileName })}
              </p>
            )}
          </div>
        </div>
        <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border-default px-2 py-1 text-xs text-text-muted">
          <Clock3 className="h-3 w-3" />
          {t("studies.designer.protocolImport.timer", {
            time: formatProtocolElapsed(elapsedSeconds),
          })}
        </div>
      </div>

      <Progress
        value={progressValue}
        variant={progressVariant}
        className="mt-3 h-2"
        label={t("studies.designer.protocolImport.progressLabel")}
      />

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {workflowSteps.map((step) => {
          const StepIcon = stepIcon(step);
          const isActive = phase === step;
          const isComplete = phase === "output" || workflowSteps.indexOf(step) < workflowSteps.indexOf(phase as typeof workflowSteps[number]);

          return (
            <div
              key={step}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2 py-2 text-xs",
                isActive
                  ? "border-accent/60 bg-accent/10 text-text-primary"
                  : isComplete
                    ? "border-success/40 bg-success/10 text-text-primary"
                    : "border-border-default bg-surface-base text-text-muted",
              )}
            >
              {isComplete ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
              ) : isActive ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" />
              ) : (
                <StepIcon className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="min-w-0 truncate">
                {t(`studies.designer.protocolImport.phases.${step}.short`)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function protocolImportProgressValue(phase: ProtocolImportPhase, elapsedSeconds: number): number {
  if (phase === "output" || phase === "error") return 100;
  if (phase === "uploading") return Math.min(24, 8 + elapsedSeconds * 8);
  if (phase === "analyzing") return Math.min(92, 24 + Math.max(0, elapsedSeconds - 2) * 2);
  return 0;
}

function formatProtocolElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function stepIcon(step: typeof workflowSteps[number]) {
  if (step === "uploading") return FileUp;
  if (step === "analyzing") return Sparkles;
  return CheckCircle2;
}
