import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { useCohortDefinitions } from "@/features/cohort-definitions/hooks/useCohortDefinitions";
import { CLINICAL_ANALYSIS_REGISTRY } from "../../clinicalRegistry";
import type {
  ClinicalAnalysisType,
  ClinicalAnalysisConfig,
  Investigation,
} from "../../types";

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
  return <label className="text-xs text-zinc-400">{children}</label>;
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
      className="w-full bg-surface-raised/60 border border-border-default rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-[#2DD4BF]/60 disabled:opacity-50"
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
      className="w-full bg-surface-raised/60 border border-border-default rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-[#2DD4BF]/60"
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

  // Reset form when analysis type changes
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
            <FieldLabel>Min Cell Count</FieldLabel>
            <NumberInput
              value={minCellCount}
              onChange={setMinCellCount}
              min={1}
              label="Minimum cell count"
            />
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Cells with fewer patients are suppressed in output.
            </p>
          </div>
        );

      case "incidence_rate":
        return (
          <>
            <div className="flex flex-col gap-1">
              <FieldLabel>Outcome Cohort</FieldLabel>
              <CohortSelect
                value={outcomeCohortId}
                onChange={setOutcomeCohortId}
                placeholder="Select outcome cohort…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <FieldLabel>TAR Start (days)</FieldLabel>
                <NumberInput value={tarStart} onChange={setTarStart} label="Time-at-risk start days" />
              </div>
              <div className="flex flex-col gap-1">
                <FieldLabel>TAR End (days)</FieldLabel>
                <NumberInput value={tarEnd} onChange={setTarEnd} min={1} label="Time-at-risk end days" />
              </div>
            </div>
          </>
        );

      case "estimation":
        return (
          <>
            <div className="flex flex-col gap-1">
              <FieldLabel>Comparator Cohort</FieldLabel>
              <CohortSelect
                value={comparatorCohortId}
                onChange={setComparatorCohortId}
                placeholder="Select comparator cohort…"
              />
            </div>
            <div className="flex flex-col gap-1">
              <FieldLabel>Outcome Cohorts</FieldLabel>
              <div className="rounded border border-border-default bg-surface-raised/40 max-h-40 overflow-y-auto p-2 flex flex-col gap-1">
                {allCohorts.length === 0 && (
                  <p className="text-[11px] text-zinc-500 p-1">No cohorts available.</p>
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
                      className="accent-[#2DD4BF] w-3 h-3"
                    />
                    <span className="text-xs text-zinc-300 group-hover:text-zinc-100 transition-colors flex items-center gap-1.5">
                      {c.name}
                      {investigationCohortIds.has(c.id) && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-[#2DD4BF]/10 text-[#2DD4BF] border border-[#2DD4BF]/20">
                          From investigation
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <FieldLabel>Propensity Score Method</FieldLabel>
              <div className="flex flex-col gap-1.5">
                {(
                  [
                    { value: "matching", label: "PS Matching" },
                    { value: "stratification", label: "PS Stratification" },
                    { value: "weighting", label: "PS Weighting (IPTW)" },
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
                      className="accent-[#2DD4BF]"
                    />
                    <span className="text-xs text-zinc-300">{opt.label}</span>
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
              <FieldLabel>Outcome Cohort</FieldLabel>
              <CohortSelect
                value={outcomeCohortId}
                onChange={setOutcomeCohortId}
                placeholder="Select outcome cohort…"
              />
            </div>
            <div className="flex flex-col gap-1">
              <FieldLabel>Model Type</FieldLabel>
              <SelectInput
                value={modelType}
                onChange={setModelType}
              >
                <option value="lasso_logistic_regression">LASSO Logistic Regression</option>
                <option value="gradient_boosting">Gradient Boosting</option>
                <option value="random_forest">Random Forest</option>
                <option value="ada_boost">AdaBoost</option>
                <option value="decision_tree">Decision Tree</option>
              </SelectInput>
            </div>
          </>
        );

      case "sccs":
        return (
          <>
            <div className="flex flex-col gap-1">
              <FieldLabel>Outcome Cohort</FieldLabel>
              <CohortSelect
                value={outcomeCohortId}
                onChange={setOutcomeCohortId}
                placeholder="Select outcome cohort…"
              />
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Exposure cohort is the selected target cohort above.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <FieldLabel>Naive Period (days)</FieldLabel>
              <NumberInput
                value={naivePeriod}
                onChange={setNaivePeriod}
                min={0}
                label="Naive period days"
              />
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Days at the start of observation to exclude from analysis.
              </p>
            </div>
          </>
        );

      case "evidence_synthesis":
        return (
          <div className="rounded border border-border-default bg-surface-raised/20 p-4 text-center">
            <p className="text-xs text-zinc-400">
              Select 2+ completed estimation results
            </p>
            <p className="text-[11px] text-zinc-600 mt-1">
              Evidence synthesis pooling is not yet configurable here. Run
              from the estimation results view.
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
        aria-label={descriptor?.name ?? "Analysis configuration"}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              {descriptor?.name ?? "Configure Analysis"}
            </h2>
            {descriptor && (
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {descriptor.description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="ml-4 flex-shrink-0 rounded p-1.5 text-zinc-400 hover:bg-surface-raised hover:text-zinc-100 transition-colors"
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
                <FieldLabel>Data Source</FieldLabel>
                <SelectInput
                  value={sourceId ?? ""}
                  onChange={(v) => setSourceId(v ? Number(v) : null)}
                  disabled={sourcesLoading}
                >
                  <option value="">
                    {sourcesLoading ? "Loading sources…" : "Select a source…"}
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
                  {analysisType === "sccs" ? "Exposure Cohort (Target)" : "Target Cohort"}
                </FieldLabel>
                <SelectInput
                  value={targetCohortId ?? ""}
                  onChange={(v) => setTargetCohortId(v ? Number(v) : null)}
                >
                  <option value="">Select target cohort…</option>
                  {allCohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {investigationCohortIds.has(c.id) ? " ★" : ""}
                    </option>
                  ))}
                </SelectInput>
                {/* Investigation cohort badges legend */}
                {allCohorts.some((c) => investigationCohortIds.has(c.id)) && (
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    ★ = cohort from this investigation
                  </p>
                )}
              </div>
            )}

            {/* Divider before type-specific fields */}
            {analysisType !== "evidence_synthesis" &&
              analysisType !== "pathway" && (
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-surface-raised" />
                  <span className="text-[10px] uppercase tracking-wide text-zinc-600">
                    Analysis Parameters
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
            <span className="text-[11px] text-zinc-500 flex items-center gap-1">
              <svg
                className="w-3.5 h-3.5 text-zinc-600"
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
              Est. {descriptor.estimatedTime}
            </span>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-surface-raised transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExecute}
              disabled={analysisType === "evidence_synthesis" || isPending}
              className="px-5 py-2 rounded text-xs font-medium text-white bg-[#9B1B30] hover:bg-[#b02035] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[110px] justify-center"
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
                "Run Analysis"
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
