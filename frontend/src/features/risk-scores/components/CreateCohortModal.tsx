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
      <div className="mx-4 w-full max-w-lg rounded-xl border border-[#2A2A2F] bg-[#141418] p-6">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#F0EDE8]">
            Create Cohort from Risk Tier
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="rounded-lg p-1.5 text-[#8A857D] transition-colors hover:bg-[#1A1A1E] hover:text-[#F0EDE8]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4">
          {/* Name input */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#C5C0B8]">
              Cohort Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={mutation.isPending}
              className="form-input w-full rounded-lg border border-[#2A2A2F] bg-[#1A1A1E] px-3 py-2 text-sm text-[#F0EDE8] placeholder-[#5A5650] focus:border-[#2DD4BF] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]"
            />
          </div>

          {/* Description textarea */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#C5C0B8]">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={mutation.isPending}
              rows={3}
              className="form-input w-full rounded-lg border border-[#2A2A2F] bg-[#1A1A1E] px-3 py-2 text-sm text-[#F0EDE8] placeholder-[#5A5650] focus:border-[#2DD4BF] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]"
            />
          </div>

          {/* Patient count */}
          <p className="text-sm text-[#8A857D]">
            <span className="font-semibold text-[#C5C0B8]">
              {patientCount.toLocaleString()}
            </span>{" "}
            patients will be included
          </p>

          {/* Derivation info (collapsible) */}
          <div>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-xs text-[#8A857D] transition-colors hover:text-[#C5C0B8]"
            >
              {showDetails ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
              Show details
            </button>
            {showDetails && (
              <div className="mt-2 space-y-1 rounded-lg border border-[#2A2A2F] bg-[#1A1A1E] px-3 py-2 font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D]">
                <p>
                  Analysis ID:{" "}
                  <span className="text-[#C5C0B8]">{analysisId}</span>
                </p>
                <p>
                  Execution ID:{" "}
                  <span className="text-[#C5C0B8]">{executionId}</span>
                </p>
                <p>
                  Score:{" "}
                  <span className="text-[#C5C0B8]">{scoreId}</span>
                </p>
                <p>
                  Tier:{" "}
                  <span className="text-[#C5C0B8]">
                    {riskTier ?? "Custom filter"}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Error display */}
          {mutation.isError && (
            <p className="text-sm text-[#E85A6B]">
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
            className="rounded-lg px-4 py-2 text-sm font-medium text-[#C5C0B8] transition-colors hover:bg-[#1A1A1E]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={mutation.isPending || !name.trim()}
            className="flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] transition-colors hover:bg-[#2DD4BF]/90 disabled:opacity-50"
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
