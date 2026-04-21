import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { useCohortDefinitions } from "@/features/cohort-definitions/hooks/useCohortDefinitions";
import { CLINICAL_ANALYSIS_REGISTRY } from "../../clinicalRegistry";
import type {
  ClinicalAnalysisType,
  ClinicalAnalysisConfig,
  Investigation,
} from "../../types";
import {
  getClinicalAnalysisDescription,
  getClinicalAnalysisEstimatedTime,
  getClinicalAnalysisLabel,
} from "../../lib/i18n";

interface ConfigDrawerProps {
  analysisType: ClinicalAnalysisType | null; // null = closed
  investigation: Investigation;
  onClose: () => void;
  onExecute: (config: ClinicalAnalysisConfig) => void;
  isPending?: boolean;
  pendingLabel?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs text-text-muted">{children}</label>;
}

function SelectInput({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string | number;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full bg-surface-raised/60 border border-border-default rounded px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-success/60 disabled:opacity-50"
    >
      {children}
    </select>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  label?: string;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full bg-surface-raised/60 border border-border-default rounded px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-success/60"
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ConfigDrawer({
  analysisType,
  investigation,
  onClose,
  onExecute,
  isPending = false,
  pendingLabel = "Running…",
}: ConfigDrawerProps) {
  const { t } = useTranslation("app");
  const isOpen = analysisType !== null;
  const descriptor = analysisType
    ? CLINICAL_ANALYSIS_REGISTRY.find((r) => r.type === analysisType) ?? null
    : null;

  // ---- Sources ----
  const { data: sources = [], isLoading: sourcesLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
    staleTime: 60_000,
    enabled: isOpen && analysisType !== "evidence_synthesis",
  });

  // ---- Cohort definitions ----
  const { data: cohortPage } = useCohortDefinitions({ limit: 200 });
  const allCohorts = cohortPage?.items ?? [];

  // IDs that belong to this investigation
  const investigationCohortIds = new Set(
    investigation.phenotype_state.selected_cohort_ids ?? [],
  );

  // ---- Local form state ----
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [targetCohortId, setTargetCohortId] = useState<number | null>(null);
  const [comparatorCohortId, setComparatorCohortId] = useState<number | null>(null);
  const [outcomeCohortId, setOutcomeCohortId] = useState<number | null>(null);
  const [outcomeCohortIds, setOutcomeCohortIds] = useState<number[]>([]);

  // characterization
  const [minCellCount, setMinCellCount] = useState(5);

  // incidence_rate
  const [tarStart, setTarStart] = useState(0);
  const [tarEnd, setTarEnd] = useState(365);

  // estimation
  const [psMethod, setPsMethod] = useState<"matching" | "stratification" | "weighting">("matching");

  // prediction
  const [modelType, setModelType] = useState(
    "lasso_logistic_regression",
  );

  // sccs
  const [naivePeriod, setNaivePeriod] = useState(180);

  // Reset form when analysis type changes — legitimate derived-reset sync
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSourceId(null);
    setTargetCohortId(null);
    setComparatorCohortId(null);
    setOutcomeCohortId(null);
    setOutcomeCohortIds([]);
    setMinCellCount(5);
    setTarStart(0);
    setTarEnd(365);
    setPsMethod("matching");
    setModelType("lasso_logistic_regression");
    setNaivePeriod(180);
  }, [analysisType]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ---- Build config ----
  function buildConfig(): ClinicalAnalysisConfig {
    const base: ClinicalAnalysisConfig = {
      type: analysisType!,
      source_id: sourceId,
      target_cohort_id: targetCohortId,
      comparator_cohort_id: null,
      outcome_cohort_ids: [],
      parameters: {},
    };

    switch (analysisType) {
      case "characterization":
        return { ...base, parameters: { min_cell_count: minCellCount } };

      case "incidence_rate":
        return {
          ...base,
          outcome_cohort_ids: outcomeCohortId ? [outcomeCohortId] : [],
          parameters: { tar_start: tarStart, tar_end: tarEnd },
        };

      case "estimation":
        return {
          ...base,
          comparator_cohort_id: comparatorCohortId,
          outcome_cohort_ids: outcomeCohortIds,
          parameters: { ps_method: psMethod },
        };

      case "prediction":
        return {
          ...base,
          outcome_cohort_ids: outcomeCohortId ? [outcomeCohortId] : [],
          parameters: { model_type: modelType },
        };

      case "sccs":
        return {
          ...base,
          outcome_cohort_ids: outcomeCohortId ? [outcomeCohortId] : [],
          parameters: { naive_period: naivePeriod },
        };

      case "pathway":
        return base;

      case "evidence_synthesis":
        return { ...base, source_id: null };

      default:
        return base;
    }
  }

  function handleExecute() {
    onExecute(buildConfig());
  }

  // ---- Cohort selector helper ----
  function CohortSelect({
    value,
    onChange,
    placeholder = "Select cohort…",
  }: {
    value: number | null;
    onChange: (id: number | null) => void;
    placeholder?: string;
  }) {
    return (
      <SelectInput
        value={value ?? ""}
        onChange={(v) => onChange(v ? Number(v) : null)}
      >
        <option value="">{placeholder}</option>
        {allCohorts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {investigationCohortIds.has(c.id) ? " ★" : ""}
          </option>
        ))}
      </SelectInput>
    );
  }

  // ---- Multi-select checkbox helper ----
  function toggleOutcomeCohort(id: number) {
    setOutcomeCohortIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  // ---- Type-specific fields ----
  function renderTypeFields() {
    switch (analysisType) {
      case "characterization":
        return (
          <div className="flex flex-col gap-1">
            <FieldLabel>{t("investigation.clinical.drawer.minCellCount")}</FieldLabel>
            <NumberInput
              value={minCellCount}
              onChange={setMinCellCount}
              min={1}
              label={t("investigation.clinical.drawer.minCellCountLabel")}
            />
            <p className="text-[11px] text-text-ghost mt-0.5">
              {t("investigation.clinical.drawer.minCellCountHelp")}
            </p>
          </div>
        );

      case "incidence_rate":
        return (
          <>
            <div className="flex flex-col gap-1">
              <FieldLabel>{t("investigation.clinical.drawer.outcomeCohort")}</FieldLabel>
              <CohortSelect
                value={outcomeCohortId}
                onChange={setOutcomeCohortId}
                placeholder={t("investigation.common.placeholders.selectOutcomeCohort")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <FieldLabel>{t("investigation.clinical.drawer.tarStart")}</FieldLabel>
                <NumberInput
                  value={tarStart}
                  onChange={setTarStart}
                  label={t("investigation.clinical.drawer.tarStartLabel")}
                />
              </div>
              <div className="flex flex-col gap-1">
                <FieldLabel>{t("investigation.clinical.drawer.tarEnd")}</FieldLabel>
                <NumberInput
                  value={tarEnd}
                  onChange={setTarEnd}
                  min={1}
                  label={t("investigation.clinical.drawer.tarEndLabel")}
                />
              </div>
            </div>
          </>
        );

      case "estimation":
        return (
          <>
            <div className="flex flex-col gap-1">
              <FieldLabel>{t("investigation.clinical.drawer.comparatorCohort")}</FieldLabel>
              <CohortSelect
                value={comparatorCohortId}
                onChange={setComparatorCohortId}
                placeholder={t("investigation.common.placeholders.selectComparatorCohort")}
              />
            </div>
            <div className="flex flex-col gap-1">
              <FieldLabel>{t("investigation.clinical.drawer.outcomeCohorts")}</FieldLabel>
              <div className="rounded border border-border-default bg-surface-raised/40 max-h-40 overflow-y-auto p-2 flex flex-col gap-1">
                {allCohorts.length === 0 && (
                  <p className="text-[11px] text-text-ghost p-1">
                    {t("investigation.common.empty.noCohortsAvailable")}
                  </p>
                )}
                {allCohorts.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={outcomeCohortIds.includes(c.id)}
                      onChange={() => toggleOutcomeCohort(c.id)}
                      className="accent-success w-3 h-3"
                    />
                    <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors flex items-center gap-1.5">
                      {c.name}
                      {investigationCohortIds.has(c.id) && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-success/10 text-success border border-success/20">
                          {t("investigation.common.labels.fromInvestigation")}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <FieldLabel>{t("investigation.clinical.drawer.propensityScoreMethod")}</FieldLabel>
              <div className="flex flex-col gap-1.5">
                {(
                  [
                    {
                      value: "matching",
                      label: t("investigation.clinical.drawer.psMatching"),
                    },
                    {
                      value: "stratification",
                      label: t("investigation.clinical.drawer.psStratification"),
                    },
                    {
                      value: "weighting",
                      label: t("investigation.clinical.drawer.psWeighting"),
                    },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="ps_method"
                      value={opt.value}
                      checked={psMethod === opt.value}
                      onChange={() => setPsMethod(opt.value)}
                      className="accent-success"
                    />
                    <span className="text-xs text-text-secondary">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        );

      case "prediction":
        return (
          <>
            <div className="flex flex-col gap-1">
              <FieldLabel>{t("investigation.clinical.drawer.outcomeCohort")}</FieldLabel>
              <CohortSelect
                value={outcomeCohortId}
                onChange={setOutcomeCohortId}
                placeholder={t("investigation.common.placeholders.selectOutcomeCohort")}
              />
            </div>
            <div className="flex flex-col gap-1">
              <FieldLabel>{t("investigation.clinical.drawer.modelType")}</FieldLabel>
              <SelectInput
                value={modelType}
                onChange={setModelType}
              >
                <option value="lasso_logistic_regression">
                  {t("investigation.clinical.drawer.lassoLogisticRegression")}
                </option>
                <option value="gradient_boosting">
                  {t("investigation.clinical.drawer.gradientBoosting")}
                </option>
                <option value="random_forest">
                  {t("investigation.clinical.drawer.randomForest")}
                </option>
                <option value="ada_boost">
                  {t("investigation.clinical.drawer.adaBoost")}
                </option>
                <option value="decision_tree">
                  {t("investigation.clinical.drawer.decisionTree")}
                </option>
              </SelectInput>
            </div>
          </>
        );

      case "sccs":
        return (
          <>
            <div className="flex flex-col gap-1">
              <FieldLabel>{t("investigation.clinical.drawer.outcomeCohort")}</FieldLabel>
              <CohortSelect
                value={outcomeCohortId}
                onChange={setOutcomeCohortId}
                placeholder={t("investigation.common.placeholders.selectOutcomeCohort")}
              />
              <p className="text-[11px] text-text-ghost mt-0.5">
                {t("investigation.clinical.drawer.exposureUsesTarget")}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <FieldLabel>{t("investigation.clinical.drawer.naivePeriod")}</FieldLabel>
              <NumberInput
                value={naivePeriod}
                onChange={setNaivePeriod}
                min={0}
                label={t("investigation.clinical.drawer.naivePeriodLabel")}
              />
              <p className="text-[11px] text-text-ghost mt-0.5">
                {t("investigation.clinical.drawer.naivePeriodHelp")}
              </p>
            </div>
          </>
        );

      case "evidence_synthesis":
        return (
          <div className="rounded border border-border-default bg-surface-raised/20 p-4 text-center">
            <p className="text-xs text-text-muted">
              {t("investigation.clinical.drawer.synthesisPrompt")}
            </p>
            <p className="text-[11px] text-text-ghost mt-1">
              {t("investigation.clinical.drawer.synthesisHelp")}
            </p>
          </div>
        );

      case "pathway":
        // Only target cohort — already shown in common fields
        return null;

      default:
        return null;
    }
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={[
          "fixed top-0 right-0 z-50 flex h-full w-[480px] flex-col",
          "bg-surface-darkest border-l border-border-default shadow-2xl",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        aria-modal="true"
        role="dialog"
        aria-label={
          descriptor
            ? getClinicalAnalysisLabel(t, descriptor.type)
            : t("investigation.clinical.drawer.analysisConfiguration")
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              {descriptor
                ? getClinicalAnalysisLabel(t, descriptor.type)
                : t("investigation.clinical.drawer.configureAnalysis")}
            </h2>
            {descriptor && (
              <p className="text-[11px] text-text-ghost mt-0.5">
                {getClinicalAnalysisDescription(t, descriptor.type)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={t("investigation.clinical.drawer.closeDrawer")}
            className="ml-4 flex-shrink-0 rounded p-1.5 text-text-muted hover:bg-surface-raised hover:text-text-primary transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="flex flex-col gap-5">
            {/* Source selector — hidden for evidence_synthesis */}
            {analysisType !== "evidence_synthesis" && (
              <div className="flex flex-col gap-1">
                <FieldLabel>{t("investigation.common.sections.dataSource")}</FieldLabel>
                <SelectInput
                  value={sourceId ?? ""}
                  onChange={(v) => setSourceId(v ? Number(v) : null)}
                  disabled={sourcesLoading}
                >
                  <option value="">
                    {sourcesLoading
                      ? t("investigation.common.sections.loadingSources")
                      : t("investigation.common.placeholders.selectSource")}
                  </option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.source_name}
                    </option>
                  ))}
                </SelectInput>
              </div>
            )}

            {/* Target cohort — hidden for evidence_synthesis */}
            {analysisType !== "evidence_synthesis" && (
              <div className="flex flex-col gap-1">
                <FieldLabel>
                  {analysisType === "sccs"
                    ? t("investigation.clinical.drawer.exposureCohortTarget")
                    : t("investigation.clinical.drawer.targetCohort")}
                </FieldLabel>
                <SelectInput
                  value={targetCohortId ?? ""}
                  onChange={(v) => setTargetCohortId(v ? Number(v) : null)}
                >
                  <option value="">
                    {t("investigation.common.placeholders.selectTargetCohort")}
                  </option>
                  {allCohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {investigationCohortIds.has(c.id) ? " ★" : ""}
                    </option>
                  ))}
                </SelectInput>
                {/* Investigation cohort badges legend */}
                {allCohorts.some((c) => investigationCohortIds.has(c.id)) && (
                  <p className="text-[11px] text-text-ghost mt-0.5">
                    {t("investigation.common.labels.cohortFromThisInvestigation")}
                  </p>
                )}
              </div>
            )}

            {/* Divider before type-specific fields */}
            {analysisType !== "evidence_synthesis" &&
              analysisType !== "pathway" && (
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-surface-raised" />
                  <span className="text-[10px] uppercase tracking-wide text-text-ghost">
                    {t("investigation.common.sections.analysisParameters")}
                  </span>
                  <div className="h-px flex-1 bg-surface-raised" />
                </div>
              )}

            {/* Type-specific fields */}
            {renderTypeFields()}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border-default px-5 py-4 flex items-center justify-between gap-3">
          {/* Estimated time badge */}
          {descriptor && (
            <span className="text-[11px] text-text-ghost flex items-center gap-1">
              <svg
                className="w-3.5 h-3.5 text-text-ghost"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {t("investigation.common.labels.estTime", {
                value: getClinicalAnalysisEstimatedTime(t, descriptor.type),
              })}
            </span>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded text-xs text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors"
            >
              {t("investigation.common.actions.cancel")}
            </button>
            <button
              onClick={handleExecute}
              disabled={analysisType === "evidence_synthesis" || isPending}
              className="px-5 py-2 rounded text-xs font-medium text-primary-foreground bg-primary hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[110px] justify-center"
            >
              {isPending ? (
                <>
                  <svg
                    className="w-3 h-3 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  {pendingLabel}
                </>
              ) : (
                t("investigation.common.actions.runAnalysis")
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
