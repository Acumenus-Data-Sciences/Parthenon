import { useState } from "react";
import { X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCreateCohortFromTier } from "../hooks/useRiskScores";
import { getRiskScoreTierLabel } from "../lib/i18n";

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
  const { t } = useTranslation("app");
  const tierLabel = riskTier
    ? getRiskScoreTierLabel(t, riskTier)
    : t("riskScores.common.tier.filtered");

  const [name, setName] = useState(
    t("riskScores.createCohort.defaultName", {
      score: scoreName,
      tier: tierLabel,
      cohort: cohortName,
    }),
  );
  const [description, setDescription] = useState(
    t("riskScores.createCohort.derivedDescription", {
      cohort: cohortName,
      score: scoreName,
      tier: riskTier ?? t("riskScores.common.tier.filtered"),
    }),
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
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">
            {t("riskScores.createCohort.title")}
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

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">
              {t("riskScores.createCohort.cohortName")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={mutation.isPending}
              className="form-input w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary placeholder-text-ghost focus:border-success focus:outline-none focus:ring-1 focus:ring-success"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">
              {t("riskScores.createCohort.description")}
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={mutation.isPending}
              rows={3}
              className="form-input w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary placeholder-text-ghost focus:border-success focus:outline-none focus:ring-1 focus:ring-success"
            />
          </div>

          <p className="text-sm text-text-muted">
            <span className="font-semibold text-text-secondary">
              {patientCount.toLocaleString()}
            </span>{" "}
            {t("riskScores.createCohort.patientsIncluded", {
              count: patientCount,
            })}
          </p>

          <div>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-secondary"
            >
              {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showDetails
                ? t("riskScores.createCohort.hideDetails")
                : t("riskScores.createCohort.showDetails")}
            </button>
            {showDetails && (
              <div className="mt-2 space-y-1 rounded-lg border border-border-default bg-surface-overlay px-3 py-2 font-['IBM_Plex_Mono',monospace] text-xs text-text-muted">
                <p>
                  {t("riskScores.createCohort.analysisId")}{" "}
                  <span className="text-text-secondary">{analysisId}</span>
                </p>
                <p>
                  {t("riskScores.createCohort.executionId")}{" "}
                  <span className="text-text-secondary">{executionId}</span>
                </p>
                <p>
                  {t("riskScores.createCohort.score")}{" "}
                  <span className="text-text-secondary">{scoreId}</span>
                </p>
                <p>
                  {t("riskScores.createCohort.tier")}{" "}
                  <span className="text-text-secondary">
                    {riskTier ?? t("riskScores.common.tier.customFilter")}
                  </span>
                </p>
              </div>
            )}
          </div>

          {mutation.isError && (
            <p className="text-sm text-critical">
              {mutation.error instanceof Error
                ? mutation.error.message
                : t("riskScores.createCohort.createFailed")}
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-overlay"
          >
            {t("riskScores.common.actions.cancel")}
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={mutation.isPending || !name.trim()}
            className="flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base transition-colors hover:bg-success/90 disabled:opacity-50"
          >
            {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
            {t("riskScores.common.actions.createCohort")}
          </button>
        </div>
      </div>
    </div>
  );
}
