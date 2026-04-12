import { useState } from "react";
import { X, UserPlus, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useExpandCohort } from "../hooks/usePatientSimilarity";
import type { SimilarPatient } from "../types/patientSimilarity";

interface CohortExpandDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cohortDefinitionId: number;
  cohortName: string;
  sourceId: number;
  currentMemberCount: number;
  patients: SimilarPatient[];
}

export function CohortExpandDialog({
  isOpen,
  onClose,
  cohortDefinitionId,
  cohortName,
  sourceId,
  currentMemberCount,
  patients,
}: CohortExpandDialogProps) {
  const [minScore, setMinScore] = useState(0.5);

  const expandMutation = useExpandCohort();

  const filteredPatients = patients.filter(
    (p) => p.overall_score >= minScore && p.person_id != null,
  );
  const filteredCount = filteredPatients.length;

  const handleExpand = () => {
    const personIds = filteredPatients
      .map((p) => p.person_id)
      .filter((id): id is number => id != null);

    if (personIds.length === 0) return;

    expandMutation.mutate({
      cohort_definition_id: cohortDefinitionId,
      source_id: sourceId,
      person_ids: personIds,
    });
  };

  const handleClose = () => {
    setMinScore(0.5);
    expandMutation.reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg border border-border-default bg-surface-raised shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
          <h2 className="text-base font-semibold text-text-primary">
            Expand {cohortName}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-text-ghost hover:text-text-secondary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {expandMutation.isSuccess ? (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle size={40} className="text-success mb-3" />
              <p className="text-sm text-text-primary font-medium">
                Cohort expanded successfully
              </p>
              <p className="text-xs text-text-muted mt-1">
                Added {expandMutation.data.added_count} patients
                {expandMutation.data.skipped_duplicates > 0 && (
                  <> ({expandMutation.data.skipped_duplicates} duplicates skipped)</>
                )}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                New total: {expandMutation.data.new_total} members
              </p>
            </div>
          ) : (
            <>
              {/* Info */}
              <div className="rounded-lg bg-surface-base border border-border-default px-3 py-2.5">
                <p className="text-xs text-text-muted">
                  Add similar patients to{" "}
                  <span className="font-medium text-text-secondary">
                    {cohortName}
                  </span>
                </p>
                <p className="text-xs text-text-ghost mt-1">
                  Current size:{" "}
                  <span className="text-text-secondary">{currentMemberCount}</span>{" "}
                  members &rarr; New size:{" "}
                  <span className="text-success">
                    {currentMemberCount + filteredCount}
                  </span>
                </p>
              </div>

              {/* Min Score Slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] text-text-ghost uppercase tracking-wider">
                    Minimum Score
                  </label>
                  <span className="text-xs font-medium text-success tabular-nums">
                    {minScore.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={minScore}
                  onChange={(e) => setMinScore(parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-surface-elevated accent-success"
                />
              </div>

              {/* Count Preview */}
              <div className="rounded-lg bg-surface-base border border-border-default px-3 py-2">
                <p className="text-xs text-text-muted">
                  <span className="font-medium text-text-secondary">
                    {filteredCount}
                  </span>{" "}
                  of {patients.length} patients meet the threshold
                </p>
              </div>

              {expandMutation.isError && (
                <p className="text-xs text-critical">
                  Expansion failed. Please try again.
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border-default px-5 py-3">
          {expandMutation.isSuccess ? (
            <button
              type="button"
              onClick={handleClose}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                "bg-success/10 text-success hover:bg-success/20",
              )}
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-muted hover:text-text-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExpand}
                disabled={filteredCount === 0 || expandMutation.isPending}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  "bg-primary text-primary-foreground hover:bg-primary-light",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                {expandMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <UserPlus size={14} />
                )}
                Add {filteredCount} Patients
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
