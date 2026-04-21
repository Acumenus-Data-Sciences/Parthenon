// Phase 17 GENOMICS-08 — empty-state CTA modal.
// Picker populated from GET /pgs-catalog/scores (plain <select> per 17-CONTEXT.md
// Open Question #2). Submit POSTs to /finngen/endpoints/{name}/prs; disabled when
// the cohort has no associated FinnGen endpoint (v1 limitation — tracked in
// 17-DEFERRED-ITEMS.md for generic cohort dispatch).
import { useState, type FormEvent } from "react";
import {
  usePgsCatalogScores,
  useComputePrsMutation,
} from "../hooks/usePrsScores";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onClose: () => void;
  cohortId: number;
  endpointName: string | null;
  sourceKey: string | null;
}

export function ComputePrsModal({
  open,
  onClose,
  cohortId,
  endpointName,
  sourceKey,
}: Props) {
  const { t } = useTranslation("app");
  const [scoreId, setScoreId] = useState<string>("");
  const [sourceKeyInput, setSourceKeyInput] = useState<string>(
    sourceKey ?? "",
  );
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const { data: catalog, isLoading } = usePgsCatalogScores();
  const mutation = useComputePrsMutation(endpointName ?? "", cohortId);

  if (!open) return null;

  const hasEndpoint = endpointName !== null && endpointName !== "";
  const canSubmit =
    hasEndpoint &&
    scoreId !== "" &&
    sourceKeyInput !== "" &&
    !mutation.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrMsg(null);
    if (!canSubmit || !hasEndpoint) return;
    try {
      await mutation.mutateAsync({
        source_key: sourceKeyInput,
        score_id: scoreId,
        cohort_definition_id: cohortId,
      });
      onClose();
    } catch (err) {
      setErrMsg(
        err instanceof Error ? err.message : "Compute PRS failed",
      );
    }
  }

  const scoreOptions = catalog?.scores ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compute-prs-title"
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
    >
      <form
        onSubmit={onSubmit}
        className="bg-surface-raised p-6 rounded w-[480px] max-w-[90vw] space-y-4"
      >
        <h2
          id="compute-prs-title"
          className="text-lg font-semibold text-text-primary"
        >
          {t("cohortDefinitions.auto.computePrs_0d8599")}
        </h2>

        {!hasEndpoint && (
          <p role="alert" className="text-sm text-critical">
            {t("cohortDefinitions.auto.prsComputeIsAvailableOnlyForFinngenEndpoint_a25411")}
          </p>
        )}

        <label className="block text-sm">
          <span className="text-text-muted">{t("cohortDefinitions.auto.pgsCatalogScore_38e7d3")}</span>
          <select
            aria-label={t("cohortDefinitions.auto.pgsCatalogScore_38e7d3")}
            value={scoreId}
            onChange={(e) => setScoreId(e.target.value)}
            className="mt-1 block w-full px-2 py-1 rounded bg-surface-base border border-border-default text-text-primary"
            disabled={isLoading || !hasEndpoint}
          >
            <option value="">{isLoading ? "Loading..." : "— select —"}</option>
            {scoreOptions.map((s) => (
              <option key={s.score_id} value={s.score_id}>
                {(s.trait_reported ?? "(no trait)") + " — " + s.score_id}
                {s.variants_number
                  ? " (" + s.variants_number + " variants)"
                  : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-text-muted">{t("cohortDefinitions.auto.sourceKeyEGPancreas_cb9a49")}</span>
          <input
            type="text"
            aria-label={t("cohortDefinitions.auto.sourceKey_c84233")}
            value={sourceKeyInput}
            onChange={(e) => setSourceKeyInput(e.target.value.toUpperCase())}
            className="mt-1 block w-full px-2 py-1 rounded bg-surface-base border border-border-default text-text-primary"
            pattern="^[A-Z][A-Z0-9_]*$"
            disabled={!hasEndpoint}
          />
        </label>

        {errMsg && (
          <p role="alert" className="text-sm text-critical">
            {errMsg}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-sm rounded border border-border-default text-text-muted"
          >
            {t("cohortDefinitions.auto.cancel_ea4788")}
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            title={
              !hasEndpoint
                ? "Available only for FinnGen endpoint cohorts in v1"
                : undefined
            }
            className="px-3 py-1 text-sm rounded bg-[color:var(--color-crimson)] text-white disabled:opacity-50"
          >
            {mutation.isPending ? "Submitting..." : "Compute PRS"}
          </button>
        </div>
      </form>
    </div>
  );
}
