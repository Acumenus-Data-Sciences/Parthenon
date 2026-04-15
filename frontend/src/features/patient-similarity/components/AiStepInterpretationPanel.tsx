import { useState } from "react";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui";
import type { CohortSimilarityStepInterpretation } from "../types/patientSimilarity";

interface AiStepInterpretationPanelProps {
  interpretation?: CohortSimilarityStepInterpretation;
  isLoading?: boolean;
  onInterpret: (forceRefresh?: boolean) => void;
}

export function AiStepInterpretationPanel({
  interpretation,
  isLoading = false,
  onInterpret,
}: AiStepInterpretationPanelProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const isInterpreted = interpretation?.status === "interpreted";
  const hasError = interpretation?.status === "unavailable" || interpretation?.status === "unparseable";

  const handleInterpret = () => {
    setModalOpen(true);
    onInterpret(isInterpreted);
  };

  return (
    <div className="mt-5 border-t border-border-subtle pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <h4 className="text-sm font-semibold text-text-primary">Researcher Interpretation</h4>
          </div>
          <p className="text-xs text-text-muted">
            Generate a complete aggregate-only reading of this step using the configured LLM provider.
          </p>
        </div>

        <button
          type="button"
          onClick={handleInterpret}
          disabled={isLoading}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-md border border-border-default px-3 py-2 text-sm font-medium transition-colors",
            "text-text-secondary hover:border-border-hover hover:bg-surface-overlay hover:text-text-primary",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {isInterpreted ? "Regenerate" : "Interpret this step"}
        </button>
      </div>

      {isInterpreted && interpretation ? (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="mt-3 text-xs font-medium text-primary transition-colors hover:text-primary-light"
        >
          View latest interpretation
        </button>
      ) : null}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Researcher Interpretation"
        size="lg"
      >
        {isLoading ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 text-center">
            <Loader2 size={36} className="animate-spin text-primary" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-text-primary">Interpreting this step...</p>
              <p className="max-w-md text-sm text-text-muted">
                The configured LLM service is reviewing aggregate results and preparing clinical implications, cautions, and next steps.
              </p>
            </div>
          </div>
        ) : isInterpreted && interpretation ? (
          <InterpretationContent interpretation={interpretation} />
        ) : hasError && interpretation ? (
          <div className="flex min-h-[220px] items-start gap-3 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-text-secondary">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
            <div className="space-y-1">
              <p className="font-semibold text-text-primary">Interpretation unavailable</p>
              <p>{interpretation.error || "The model response could not be parsed."}</p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
            <Sparkles size={28} className="text-primary" />
            <p className="text-sm text-text-muted">Start an interpretation to review this step.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function InterpretationContent({
  interpretation,
}: {
  interpretation: CohortSimilarityStepInterpretation;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
        <span className="rounded bg-surface-overlay px-2 py-1">
          {interpretation.provider} · {interpretation.model}
        </span>
        <span className="rounded bg-info/10 px-2 py-1 text-info">
          {Math.round(interpretation.confidence * 100)}% confidence
        </span>
      </div>

      <div className="space-y-2">
        {interpretation.summary ? (
          <p className="text-sm font-medium text-text-primary">{interpretation.summary}</p>
        ) : null}
        <p className="whitespace-pre-line text-sm leading-6 text-text-secondary">
          {interpretation.interpretation}
        </p>
      </div>

      <InterpretationList title="Clinical Implications" items={interpretation.clinical_implications} />
      <InterpretationList title="Methodologic Cautions" items={interpretation.methodologic_cautions} tone="warning" />
      <InterpretationList title="Recommended Next Steps" items={interpretation.recommended_next_steps} />
    </div>
  );
}

function InterpretationList({
  title,
  items,
  tone = "default",
}: {
  title: string;
  items: string[];
  tone?: "default" | "warning";
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.08em]",
          tone === "warning" ? "text-warning" : "text-text-ghost",
        )}
      >
        {title}
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-text-secondary">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
