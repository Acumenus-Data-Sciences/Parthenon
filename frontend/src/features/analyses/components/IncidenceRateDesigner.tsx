import { useState, useEffect } from "react";
import { Loader2, Save, X, Zap, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getCohortDefinitions } from "@/features/cohort-definitions/api/cohortApi";
import type {
  IncidenceRateDesign,
  IncidenceRateAnalysis,
  TarConfig,
  StratificationConfig,
  DirectCalcRequest,
} from "../types/analysis";
import {
  useUpdateIncidenceRate,
  useCreateIncidenceRate,
  useCalculateDirectIncidenceRate,
} from "../hooks/useIncidenceRates";
import type { DirectCalcResponse } from "../types/analysis";

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_TAR: TarConfig = {
  start_offset: 0,
  start_anchor: "era_start",
  end_offset: 0,
  end_anchor: "era_end",
};

const DEFAULT_STRAT: StratificationConfig = {
  by_age: true,
  by_gender: true,
  by_year: false,
  age_breaks: [0, 18, 35, 50, 65],
};

const defaultDesign: IncidenceRateDesign = {
  targetCohortId: 0,
  outcomeCohortIds: [],
  timeAtRisk: {
    start: { dateField: "StartDate", offset: 0 },
    end: { dateField: "EndDate", offset: 0 },
  },
  tarConfigs: [DEFAULT_TAR],
  stratification: DEFAULT_STRAT,
  stratifyByGender: false,
  stratifyByAge: false,
  ageGroups: [],
  minCellCount: 5,
};

// ---------------------------------------------------------------------------
// Sub-component: TAR row editor
// ---------------------------------------------------------------------------

function TarRow({
  tar,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  tar: TarConfig;
  index: number;
  canRemove: boolean;
  onChange: (updated: TarConfig) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="rounded-lg border border-border-default bg-surface-base p-3 space-y-3"
      aria-label={`Time-at-risk window ${index + 1}`}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Window {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded text-text-ghost hover:text-critical transition-colors"
            title="Remove window"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Start */}
        <div className="space-y-1.5">
          <label className="form-label">Start</label>
          <div className="flex items-center gap-2">
            <select
              value={tar.start_anchor}
              onChange={(e) =>
                onChange({ ...tar, start_anchor: e.target.value as TarConfig["start_anchor"] })
              }
              className="form-input form-select flex-1"
            >
              <option value="era_start">Era Start</option>
              <option value="era_end">Era End</option>
            </select>
            <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
              +
            </span>
            <input
              type="number"
              value={tar.start_offset}
              onChange={(e) =>
                onChange({ ...tar, start_offset: Number(e.target.value) || 0 })
              }
              className="form-input"
              style={{ width: "5rem" }}
            />
            <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
              d
            </span>
          </div>
        </div>

        {/* End */}
        <div className="space-y-1.5">
          <label className="form-label">End</label>
          <div className="flex items-center gap-2">
            <select
              value={tar.end_anchor}
              onChange={(e) =>
                onChange({ ...tar, end_anchor: e.target.value as TarConfig["end_anchor"] })
              }
              className="form-input form-select flex-1"
            >
              <option value="era_start">Era Start</option>
              <option value="era_end">Era End</option>
            </select>
            <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
              +
            </span>
            <input
              type="number"
              value={tar.end_offset}
              onChange={(e) =>
                onChange({ ...tar, end_offset: Number(e.target.value) || 0 })
              }
              className="form-input"
              style={{ width: "5rem" }}
            />
            <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
              d
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Age breaks editor
// ---------------------------------------------------------------------------

function AgeBreaksEditor({
  breaks,
  onChange,
}: {
  breaks: number[];
  onChange: (breaks: number[]) => void;
}) {
  const [raw, setRaw] = useState(breaks.join(", "));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRaw(breaks.join(", "));
  }, [breaks]);

  const handleBlur = () => {
    const parsed = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number);

    if (parsed.some(isNaN)) {
      setError("All values must be numbers.");
      return;
    }
    const sorted = [...parsed].sort((a, b) => a - b);
    setError(null);
    onChange(sorted);
    setRaw(sorted.join(", "));
  };

  return (
    <div className="space-y-1">
      <label className="form-label">Age Group Breaks (comma-separated)</label>
      <input
        type="text"
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          setError(null);
        }}
        onBlur={handleBlur}
        className={cn("form-input", error && "border-critical")}
        placeholder="0, 18, 35, 50, 65"
      />
      {error ? (
        <p className="text-xs" style={{ color: "var(--critical)" }}>
          {error}
        </p>
      ) : (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Groups:{" "}
          {breaks.length < 2
            ? "—"
            : breaks
                .slice(0, -1)
                .map((b, i) => `${b}–${breaks[i + 1]}`)
                .join(", ")}
          {breaks.length > 0 ? `, ${breaks[breaks.length - 1]}+` : ""}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Outcome row (with clean window)
// ---------------------------------------------------------------------------

interface OutcomeEntry {
  cohort_id: number;
  clean_window: number;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IncidenceRateDesignerProps {
  analysis?: IncidenceRateAnalysis | null;
  isNew?: boolean;
  onSaved?: (ir: IncidenceRateAnalysis) => void;
  sourceId?: number | null;
  onDirectResults?: (results: DirectCalcResponse) => void;
}

export function IncidenceRateDesigner({
  analysis,
  isNew,
  onSaved,
  sourceId,
  onDirectResults,
}: IncidenceRateDesignerProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [design, setDesign] = useState<IncidenceRateDesign>(defaultDesign);
  // outcome entries with per-outcome clean windows
  const [outcomeEntries, setOutcomeEntries] = useState<OutcomeEntry[]>([]);

  const { data: cohortData, isLoading: loadingCohorts } = useQuery({
    queryKey: ["cohort-definitions", { page: 1, limit: 200 }],
    queryFn: () => getCohortDefinitions({ page: 1, limit: 200 }),
  });

  const createMutation = useCreateIncidenceRate();
  const updateMutation = useUpdateIncidenceRate();
  const directCalcMutation = useCalculateDirectIncidenceRate();

  const cohorts = cohortData?.items ?? [];

  useEffect(() => {
    if (analysis) {
      setName(analysis.name);
      setDescription(analysis.description ?? "");
      const dj = analysis.design_json ?? {};
      const merged: IncidenceRateDesign = {
        ...defaultDesign,
        ...dj,
        timeAtRisk: {
          start: { ...defaultDesign.timeAtRisk.start, ...(dj.timeAtRisk?.start ?? {}) },
          end: { ...defaultDesign.timeAtRisk.end, ...(dj.timeAtRisk?.end ?? {}) },
        },
        tarConfigs: dj.tarConfigs?.length ? dj.tarConfigs : [DEFAULT_TAR],
        stratification: dj.stratification
          ? { ...DEFAULT_STRAT, ...dj.stratification }
          : DEFAULT_STRAT,
      };
      setDesign(merged);
      // Reconstruct outcome entries from outcomeCohortIds
      setOutcomeEntries(
        (dj.outcomeCohortIds ?? []).map((id: number) => ({
          cohort_id: id,
          clean_window: 0,
        })),
      );
    }
  }, [analysis]);

  // Keep design.outcomeCohortIds in sync with outcomeEntries
  const syncedDesign: IncidenceRateDesign = {
    ...design,
    outcomeCohortIds: outcomeEntries.map((e) => e.cohort_id),
  };

  // ---- outcome management ----

  const addOutcomeCohort = (cohortId: number) => {
    if (!cohortId || outcomeEntries.some((e) => e.cohort_id === cohortId)) return;
    setOutcomeEntries((prev) => [...prev, { cohort_id: cohortId, clean_window: 0 }]);
  };

  const removeOutcomeCohort = (cohortId: number) => {
    setOutcomeEntries((prev) => prev.filter((e) => e.cohort_id !== cohortId));
  };

  const updateCleanWindow = (cohortId: number, value: number) => {
    setOutcomeEntries((prev) =>
      prev.map((e) => (e.cohort_id === cohortId ? { ...e, clean_window: value } : e)),
    );
  };

  // ---- TAR management ----

  const updateTar = (index: number, updated: TarConfig) => {
    setDesign((prev) => {
      const configs = prev.tarConfigs.map((t, i) => (i === index ? updated : t));
      return { ...prev, tarConfigs: configs };
    });
  };

  const addTar = () => {
    setDesign((prev) => ({
      ...prev,
      tarConfigs: [...prev.tarConfigs, { ...DEFAULT_TAR }],
    }));
  };

  const removeTar = (index: number) => {
    setDesign((prev) => ({
      ...prev,
      tarConfigs: prev.tarConfigs.filter((_, i) => i !== index),
    }));
  };

  // ---- stratification helpers ----

  const setStrat = (patch: Partial<StratificationConfig>) => {
    setDesign((prev) => ({
      ...prev,
      stratification: { ...prev.stratification, ...patch },
    }));
  };

  // ---- save ----

  const handleSave = () => {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      design_json: syncedDesign,
    };

    if (isNew || !analysis) {
      createMutation.mutate(payload, { onSuccess: (ir) => onSaved?.(ir) });
    } else {
      updateMutation.mutate(
        { id: analysis.id, payload },
        { onSuccess: (ir) => onSaved?.(ir) },
      );
    }
  };

  // ---- direct calculate ----

  const canCalculateDirect =
    !!sourceId &&
    syncedDesign.targetCohortId > 0 &&
    outcomeEntries.length > 0 &&
    syncedDesign.tarConfigs.length > 0;

  const handleCalculateDirect = () => {
    if (!canCalculateDirect) return;

    const targetCohort = cohorts.find((c) => c.id === syncedDesign.targetCohortId);

    const request: DirectCalcRequest = {
      source_id: sourceId!,
      targets: [
        {
          cohort_id: syncedDesign.targetCohortId,
          cohort_name: targetCohort?.name ?? `Cohort #${syncedDesign.targetCohortId}`,
        },
      ],
      outcomes: outcomeEntries.map((e) => {
        const cohort = cohorts.find((c) => c.id === e.cohort_id);
        return {
          cohort_id: e.cohort_id,
          cohort_name: cohort?.name ?? `Cohort #${e.cohort_id}`,
          clean_window: e.clean_window,
        };
      }),
      time_at_risk: syncedDesign.tarConfigs,
      strata: syncedDesign.stratification,
      min_cell_count: syncedDesign.minCellCount,
    };

    directCalcMutation.mutate(request, {
      onSuccess: (results) => {
        onDirectResults?.(results);
      },
    });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isCalculating = directCalcMutation.isPending;
  const directError = directCalcMutation.error
    ? String((directCalcMutation.error as Error).message)
    : null;

  return (
    <div className="space-y-6">
      {/* Name & Description */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          Basic Information
        </h3>
        <div className="space-y-3 mt-3">
          <div>
            <label className="form-label">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Incidence rate analysis name"
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="form-input form-textarea"
            />
          </div>
        </div>
      </div>

      {/* Target Cohort */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          Target Cohort
        </h3>
        <p className="panel-subtitle">Select the population at risk for this analysis.</p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin" style={{ color: "var(--text-muted)" }} />
        ) : (
          <select
            value={syncedDesign.targetCohortId || ""}
            onChange={(e) =>
              setDesign((d) => ({ ...d, targetCohortId: Number(e.target.value) || 0 }))
            }
            className="form-input form-select mt-3"
          >
            <option value="">Select a target cohort...</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Outcome Cohorts */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          Outcome Cohorts
        </h3>
        <p className="panel-subtitle">
          Select one or more outcome cohorts. Each outcome can have its own clean window (days
          after outcome where a recurrence is not counted).
        </p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin" style={{ color: "var(--text-muted)" }} />
        ) : (
          <div className="space-y-3 mt-3">
            <select
              onChange={(e) => {
                addOutcomeCohort(Number(e.target.value));
                e.target.value = "";
              }}
              className="form-input form-select"
              defaultValue=""
            >
              <option value="">Add an outcome cohort...</option>
              {cohorts
                .filter((c) => !outcomeEntries.some((e) => e.cohort_id === c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>

            {outcomeEntries.length > 0 && (
              <div className="space-y-2">
                {outcomeEntries.map((entry) => {
                  const cohort = cohorts.find((c) => c.id === entry.cohort_id);
                  return (
                    <div
                      key={entry.cohort_id}
                      className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-base px-3 py-2"
                    >
                      <span
                        className="flex-1 text-sm truncate"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {cohort?.name ?? `Cohort #${entry.cohort_id}`}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Clean window
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={entry.clean_window}
                          onChange={(e) =>
                            updateCleanWindow(
                              entry.cohort_id,
                              Number(e.target.value) || 0,
                            )
                          }
                          className="form-input"
                          style={{ width: "4.5rem" }}
                          aria-label={`Clean window for ${cohort?.name ?? entry.cohort_id}`}
                        />
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          d
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOutcomeCohort(entry.cohort_id)}
                        className="p-1 rounded text-text-ghost hover:text-critical transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Time at Risk (OHDSI CohortIncidence style) */}
      <div className="panel">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
              Time-at-Risk Windows
            </h3>
            <p className="panel-subtitle">
              Define one or more observation periods relative to cohort entry.
              Each window is evaluated independently.
            </p>
          </div>
          <button
            type="button"
            onClick={addTar}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-raised px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary hover:border-surface-highlight transition-colors"
          >
            <Plus size={12} />
            Add Window
          </button>
        </div>

        <div className="space-y-2">
          {syncedDesign.tarConfigs.map((tar, i) => (
            <TarRow
              key={i}
              index={i}
              tar={tar}
              canRemove={syncedDesign.tarConfigs.length > 1}
              onChange={(updated) => updateTar(i, updated)}
              onRemove={() => removeTar(i)}
            />
          ))}
        </div>
      </div>

      {/* Stratification */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          Stratification
        </h3>

        <div className="flex flex-wrap items-center gap-6 mt-3">
          {(
            [
              { key: "by_gender", label: "By Gender" },
              { key: "by_age", label: "By Age Group" },
              { key: "by_year", label: "By Calendar Year" },
            ] as const
          ).map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-2 text-sm cursor-pointer"
              style={{ color: "var(--text-secondary)" }}
            >
              <button
                type="button"
                onClick={() =>
                  setStrat({ [key]: !syncedDesign.stratification[key] })
                }
                className={cn(
                  "toggle",
                  syncedDesign.stratification[key] && "active",
                )}
                aria-checked={syncedDesign.stratification[key]}
                role="switch"
              />
              {label}
            </label>
          ))}
        </div>

        {syncedDesign.stratification.by_age && (
          <div className="mt-4">
            <AgeBreaksEditor
              breaks={syncedDesign.stratification.age_breaks}
              onChange={(breaks) => setStrat({ age_breaks: breaks })}
            />
          </div>
        )}

        <div className="mt-4">
          <label className="form-label">Minimum Cell Count</label>
          <input
            type="number"
            min={1}
            max={100}
            value={syncedDesign.minCellCount}
            onChange={(e) =>
              setDesign((d) => ({ ...d, minCellCount: Number(e.target.value) || 5 }))
            }
            className="form-input"
            style={{ width: "8rem" }}
          />
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Cells below this threshold are suppressed for privacy.
          </p>
        </div>
      </div>

      {/* Direct calculation error */}
      {directError && (
        <div
          className="rounded-lg border border-critical/30 bg-critical/5 px-4 py-3"
          role="alert"
        >
          <p className="text-sm" style={{ color: "var(--critical)" }}>
            Direct calculation failed: {directError}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between gap-3">
        {/* Calculate Direct — only shown when source is selected in parent */}
        <div className="flex items-center gap-2">
          {onDirectResults && (
            <button
              type="button"
              onClick={handleCalculateDirect}
              disabled={isCalculating || !canCalculateDirect}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
                "border border-success/40 bg-success/10 text-success hover:bg-success/20",
              )}
              title={
                !sourceId
                  ? "Select a data source first"
                  : !canCalculateDirect
                  ? "Select target and at least one outcome"
                  : "Run CohortIncidence directly via R"
              }
            >
              {isCalculating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Zap size={14} />
              )}
              {isCalculating ? "Calculating…" : "Calculate Direct"}
            </button>
          )}
          {isCalculating && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Running OHDSI CohortIncidence via R…
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          className="btn btn-primary"
        >
          {isSaving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {isNew ? "Create" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
