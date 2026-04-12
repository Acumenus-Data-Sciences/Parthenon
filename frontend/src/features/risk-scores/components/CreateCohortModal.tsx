import { useState } from "react";
import { X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useCreateCohortFromTier } from "../hooks/useRiskScores";

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface CreateCohortModalProps {
  analysisId: number;
  executionId: number;
  scoreId: string;
  scoreName: string;
  cohortName: string;
  riskTier?: string;
  patientCount: number;
  personIds?: number[];
  onClose: () => void;
  onCreated: (cohortId: number, name: string) => void;
}

export function CreateCohortModal({
  analysisId,
  executionId,
  scoreId,
  scoreName,
  cohortName,
  riskTier,
  patientCount,
  personIds,
  onClose,
  onCreated,
}: CreateCohortModalProps) {
  const tierLabel = riskTier ? titleCase(riskTier) : "Filtered";

  const [name, setName] = useState(
    `${scoreName} — ${tierLabel} Risk — ${cohortName}`,
  );
  const [description, setDescription] = useState(
    `Patients from cohort '${cohortName}' with ${scoreName} risk tier = ${riskTier ?? "filtered"}`,
  );
  const [showDetails, setShowDetails] = useState(false);

  const mutation = useCreateCohortFromTier();

  function handleCreate() {
    mutation.mutate(
      {
        analysisId,
        payload: {
          name,
          description: description || undefined,
          execution_id: executionId,
          score_id: scoreId,
          risk_tier: riskTier,
          person_ids: personIds,
        },
      },
      {
        onSuccess: (response) => {
          onCreated(response.data.id, name);
          onClose();
        },
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-xl border border-border-default bg-surface-raised p-6">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">
            Create Cohort from Risk Tier
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-overlay hover:text-text-primary"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4">
          {/* Name input */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">
              Cohort Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={mutation.isPending}
              className="form-input w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary placeholder-text-ghost focus:border-success focus:outline-none focus:ring-1 focus:ring-success"
            />
          </div>

          {/* Description textarea */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={mutation.isPending}
              rows={3}
              className="form-input w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary placeholder-text-ghost focus:border-success focus:outline-none focus:ring-1 focus:ring-success"
            />
          </div>

          {/* Patient count */}
          <p className="text-sm text-text-muted">
            <span className="font-semibold text-text-secondary">
              {patientCount.toLocaleString()}
            </span>{" "}
            patients will be included
          </p>

          {/* Derivation info (collapsible) */}
          <div>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-secondary"
            >
              {showDetails ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
              Show details
            </button>
            {showDetails && (
              <div className="mt-2 space-y-1 rounded-lg border border-border-default bg-surface-overlay px-3 py-2 font-['IBM_Plex_Mono',monospace] text-xs text-text-muted">
                <p>
                  Analysis ID:{" "}
                  <span className="text-text-secondary">{analysisId}</span>
                </p>
                <p>
                  Execution ID:{" "}
                  <span className="text-text-secondary">{executionId}</span>
                </p>
                <p>
                  Score:{" "}
                  <span className="text-text-secondary">{scoreId}</span>
                </p>
                <p>
                  Tier:{" "}
                  <span className="text-text-secondary">
                    {riskTier ?? "Custom filter"}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Error display */}
          {mutation.isError && (
            <p className="text-sm text-critical">
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Failed to create cohort. Please try again."}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-overlay"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={mutation.isPending || !name.trim()}
            className="flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base transition-colors hover:bg-success/90 disabled:opacity-50"
          >
            {mutation.isPending && (
              <Loader2 size={14} className="animate-spin" />
            )}
            Create Cohort
          </button>
        </div>
      </div>
    </div>
  );
}
