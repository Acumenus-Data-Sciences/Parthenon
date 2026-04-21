import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Wrench, BarChart3, Loader2, Pencil } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCohortWizardStore } from "../../../stores/cohortWizardStore";
import { useCreateCohortDefinition, useGenerateCohort } from "../../../hooks/useCohortDefinitions";
import { getCohortGenerations } from "../../../api/cohortApi";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { CohortSummary } from "../CohortSummary";
import type { Source } from "@/types/models";
import { useTranslation } from "react-i18next";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReviewGenerateStep({ onClose }: Props) {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const store = useCohortWizardStore();
  const createdId = useCohortWizardStore((s) => s.createdId);
  const [sourceId, setSourceId] = useState<number | null>(null);

  const { data: sources, isLoading: loadingSources } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const createMutation = useCreateCohortDefinition();
  const generateMutation = useGenerateCohort();
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Poll generations for this definition. The backend job creates a separate
  // generation record, so we watch the full list and prefer the completed one.
  const { data: generations } = useQuery({
    queryKey: ["cohort-definitions", createdId, "generations"],
    queryFn: () => getCohortGenerations(createdId!),
    enabled: createdId != null && createdId > 0,
    refetchInterval: (query) => {
      const items = query.state.data ?? [];
      const hasTerminal = items.some((g) =>
        ["completed", "failed", "cancelled"].includes(g.status),
      );
      return hasTerminal ? false : 2000;
    },
  });
  // Prefer the completed/failed generation over the queued placeholder
  const generation =
    generations?.find((g) => ["completed", "failed"].includes(g.status)) ??
    generations?.[0] ??
    null;

  // ── Validation ────────────────────────────────────────────────────────────

  const errors: string[] = [];
  if (!store.name) errors.push("Cohort name is required (Step 1)");
  if (store.entryConcepts.length === 0) errors.push("At least one entry event is required (Step 2)");

  // ── Generate handler ──────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!sourceId || generating) return;

    let expression;
    try {
      expression = store.buildExpression();
    } catch (err) {
      console.error("Failed to build expression:", err);
      return;
    }

    setGenerating(true);
    setGenerateError(null);

    try {
      const def = await createMutation.mutateAsync({
        name: store.name,
        description: store.description,
        expression_json: expression,
      });
      store.setCreatedId(def.id);

      await generateMutation.mutateAsync({
        defId: def.id,
        sourceId,
      });
    } catch (err) {
      console.error("Failed to generate cohort:", err);
      setGenerateError("Failed to generate cohort. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const generationStatus = generation?.status;
  const isRunning =
    generating ||
    generationStatus === "running" ||
    generationStatus === "queued" ||
    generationStatus === "pending";

  const isDisabled = !sourceId || isRunning || errors.length > 0;
  const showWhatsNext = generationStatus === "completed";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Summary section */}
      <div>
        <div className="mb-2 text-[13px] font-medium text-text-muted">{t("cohortDefinitions.auto.cohortSummary_226728")}</div>
        <CohortSummary />
      </div>

      {/* Edit shortcuts */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => store.setStep(1)}
          className="inline-flex items-center gap-1 rounded border border-border-default px-2.5 py-1 text-[11px] text-text-muted hover:border-surface-highlight hover:text-text-secondary"
        >
          <Pencil size={10} />
          {t("cohortDefinitions.auto.editPopulation_63f7a8")}
        </button>
        <button
          type="button"
          onClick={() => store.setStep(2)}
          className="inline-flex items-center gap-1 rounded border border-border-default px-2.5 py-1 text-[11px] text-text-muted hover:border-surface-highlight hover:text-text-secondary"
        >
          <Pencil size={10} />
          {t("cohortDefinitions.auto.editCriteria_9a19c7")}
        </button>
        <button
          type="button"
          onClick={() => store.setStep(3)}
          className="inline-flex items-center gap-1 rounded border border-border-default px-2.5 py-1 text-[11px] text-text-muted hover:border-surface-highlight hover:text-text-secondary"
        >
          <Pencil size={10} />
          {t("cohortDefinitions.auto.editFollowUp_ae3e98")}
        </button>
      </div>

      {/* Validation errors */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-[rgba(155,27,48,0.3)] bg-[rgba(155,27,48,0.05)] px-4 py-3">
          <div className="mb-1 text-[12px] font-medium text-critical">
            {t("cohortDefinitions.auto.cannotGenerateFixTheseIssues_9e2a15")}
          </div>
          <ul className="list-inside list-disc text-[12px] text-critical">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Generate section */}
      <div className="border-t border-border-default pt-5">
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-text-muted">{t("cohortDefinitions.auto.runAgainst_8bfd59")}</span>
          <select
            value={sourceId ?? ""}
            onChange={(e) => setSourceId(e.target.value ? parseInt(e.target.value, 10) : null)}
            className="rounded-md border border-surface-highlight bg-surface-overlay px-3 py-1.5 text-[13px] text-text-secondary outline-none focus:border-accent focus:ring-1 focus:ring-accent/15"
            disabled={loadingSources}
          >
            <option value="">{t("cohortDefinitions.auto.selectDataSource_8c406d")}</option>
            {(sources ?? []).map((s: Source) => (
              <option key={s.id} value={s.id}>
                {s.source_name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isDisabled}
            className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-1.5 text-[13px] font-semibold text-surface-base transition-colors hover:bg-accent-dark disabled:opacity-50"
          >
            {isRunning && <Loader2 size={14} className="animate-spin" />}
            {t("cohortDefinitions.auto.generate_32b919")}
          </button>
        </div>
      </div>

      {/* Success result */}
      {generationStatus === "completed" && (
        <div className="rounded-lg border border-[rgba(45,212,191,0.15)] bg-[rgba(45,212,191,0.05)] p-4">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-[28px] font-bold text-success">
                {generation?.person_count?.toLocaleString() ?? 0}
              </div>
              <div className="text-[11px] text-text-muted">patients</div>
            </div>
          </div>
        </div>
      )}

      {/* Error result */}
      {(generationStatus === "failed" || generateError) && (
        <div className="rounded-lg border border-[rgba(155,27,48,0.3)] bg-[rgba(155,27,48,0.05)] px-4 py-3 text-[13px] text-critical">
          {generateError ?? "Generation failed. Check the expression and try again."}
        </div>
      )}

      {/* What's Next section */}
      {showWhatsNext && (
        <div className="border-t border-border-default pt-5">
          <div className="mb-3 text-[13px] font-medium text-accent">{t("cohortDefinitions.auto.whatSNext_b92b94")}</div>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => onClose()}
              className="rounded-lg border border-[rgba(45,212,191,0.2)] bg-[rgba(45,212,191,0.05)] p-4 text-left transition-colors hover:border-[rgba(45,212,191,0.4)]"
            >
              <div className="flex items-center gap-2 text-[13px] font-medium text-success">
                <Check size={16} />
                {t("cohortDefinitions.auto.doneSaveClose_656c71")}
              </div>
              <p className="mt-1 ml-[24px] text-[12px] text-text-muted">
                {t("cohortDefinitions.auto.cohortIsSavedAndReadyForUseIn_4be8dd")}
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(createdId ? `/cohort-definitions/${createdId}` : "/cohort-definitions");
              }}
              className="rounded-lg border border-[rgba(201,162,39,0.2)] bg-[rgba(201,162,39,0.05)] p-4 text-left transition-colors hover:border-[rgba(201,162,39,0.4)]"
            >
              <div className="flex items-center gap-2 text-[13px] font-medium text-accent">
                <Wrench size={16} />
                {t("cohortDefinitions.auto.openInAdvancedEditor_502532")}
              </div>
              <p className="mt-1 ml-[24px] text-[12px] text-text-muted">
                {t("cohortDefinitions.auto.fineTuneWithTheFullExpressionEditorSupports_85623e")}
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(createdId ? `/cohort-definitions/${createdId}` : "/cohort-definitions");
              }}
              className="rounded-lg border border-border-default bg-surface-overlay p-4 text-left transition-colors hover:border-surface-highlight"
            >
              <div className="flex items-center gap-2 text-[13px] font-medium text-text-secondary">
                <BarChart3 size={16} />
                {t("cohortDefinitions.auto.viewDiagnostics_d0f7c1")}
              </div>
              <p className="mt-1 ml-[24px] text-[12px] text-text-muted">
                {t("cohortDefinitions.auto.seeAttritionChartPatientBreakdownByAgeGender_c8e8ac")}
              </p>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
