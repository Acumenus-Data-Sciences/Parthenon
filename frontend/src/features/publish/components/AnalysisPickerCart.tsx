import { X, ShoppingCart } from "lucide-react";
import type { SelectedExecution } from "../types/publish";

const TYPE_LABELS: Record<string, string> = {
  characterizations: "Characterization",
  estimations: "Estimation",
  predictions: "Prediction",
  incidence_rates: "Incidence Rate",
  sccs: "SCCS",
  evidence_synthesis: "Evidence Synthesis",
  pathways: "Pathway",
};

interface AnalysisPickerCartProps {
  selections: SelectedExecution[];
  onRemove: (executionId: number) => void;
}

export default function AnalysisPickerCart({
  selections,
  onRemove,
}: AnalysisPickerCartProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-default">
        <ShoppingCart className="w-4 h-4 text-accent" />
        <span className="text-sm font-medium text-text-primary">
          Selected ({selections.length})
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {selections.length === 0 ? (
          <div className="border border-dashed border-border-default rounded-lg p-4 text-center">
            <p className="text-sm text-text-ghost">No analyses selected yet</p>
          </div>
        ) : (
          selections.map((sel) => (
            <div
              key={sel.executionId}
              className="bg-surface-raised border border-border-default rounded-lg p-2 group"
            >
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary truncate">
                    {sel.analysisName}
                  </p>
                  <p className="text-xs text-text-ghost">
                    {TYPE_LABELS[sel.analysisType] ?? sel.analysisType}
                  </p>
                  {sel.studyTitle && (
                    <p className="text-xs text-accent truncate mt-0.5">
                      {sel.studyTitle}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(sel.executionId)}
                  className="shrink-0 p-1 rounded hover:bg-surface-elevated text-text-ghost hover:text-text-primary transition-colors"
                  aria-label={`Remove ${sel.analysisName}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
