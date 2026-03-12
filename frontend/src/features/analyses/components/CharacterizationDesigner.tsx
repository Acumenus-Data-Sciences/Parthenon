import { useState, useEffect } from "react";
import { Loader2, Save, X, Zap, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getCohortDefinitions } from "@/features/cohort-definitions/api/cohortApi";
import type {
  CharacterizationDesign,
  FeatureType,
  Characterization,
  DirectRunRequest,
  TimeWindow,
  DirectRunAnalyses,
  DirectRunResult,
} from "../types/analysis";
import {
  useUpdateCharacterization,
  useCreateCharacterization,
  useRunDirectCharacterization,
} from "../hooks/useCharacterizations";

const ALL_FEATURE_TYPES: { value: FeatureType; label: string }[] = [
  { value: "demographics", label: "Demographics" },
  { value: "conditions", label: "Conditions" },
  { value: "drugs", label: "Drugs" },
  { value: "procedures", label: "Procedures" },
  { value: "measurements", label: "Measurements" },
  { value: "visits", label: "Visits" },
];

const TIME_WINDOW_PRESETS: { label: string; window: TimeWindow }[] = [
  { label: "Long-term (−365 to −1)", window: { start_day: -365, end_day: -1 } },
  { label: "Short-term (−30 to −1)", window: { start_day: -30, end_day: -1 } },
  { label: "Index (0 to 0)", window: { start_day: 0, end_day: 0 } },
];

const defaultDesign: CharacterizationDesign = {
  targetCohortIds: [],
  comparatorCohortIds: [],
  featureTypes: ["demographics", "conditions", "drugs"],
  stratifyByGender: false,
  stratifyByAge: false,
  topN: 100,
  minCellCount: 5,
};

const defaultDirectAnalyses: DirectRunAnalyses = {
  aggregate_covariates: true,
  time_to_event: true,
  dechallenge_rechallenge: false,
};

const defaultTimeWindows: TimeWindow[] = [
  { start_day: -365, end_day: -1 },
  { start_day: -30, end_day: -1 },
  { start_day: 0, end_day: 0 },
];

interface CharacterizationDesignerProps {
  characterization?: Characterization | null;
  isNew?: boolean;
  sourceId?: number | null;
  onSaved?: (c: Characterization) => void;
  onDirectResult?: (result: DirectRunResult) => void;
}

export function CharacterizationDesigner({
  characterization,
  isNew,
  sourceId,
  onSaved,
  onDirectResult,
}: CharacterizationDesignerProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [design, setDesign] = useState<CharacterizationDesign>(defaultDesign);

  // Direct run state
  const [directAnalyses, setDirectAnalyses] =
    useState<DirectRunAnalyses>(defaultDirectAnalyses);
  const [timeWindows, setTimeWindows] =
    useState<TimeWindow[]>(defaultTimeWindows);
  const [minPriorObservation, setMinPriorObservation] = useState(365);

  const { data: cohortData, isLoading: loadingCohorts } = useQuery({
    queryKey: ["cohort-definitions", { page: 1, limit: 200 }],
    queryFn: () => getCohortDefinitions({ page: 1, limit: 200 }),
  });

  const createMutation = useCreateCharacterization();
  const updateMutation = useUpdateCharacterization();
  const directRunMutation = useRunDirectCharacterization();

  const cohorts = cohortData?.items ?? [];

  useEffect(() => {
    if (characterization) {
      setName(characterization.name);
      setDescription(characterization.description ?? "");
      setDesign(characterization.design_json);
    }
  }, [characterization]);

  const toggleFeatureType = (ft: FeatureType) => {
    setDesign((prev) => ({
      ...prev,
      featureTypes: prev.featureTypes.includes(ft)
        ? prev.featureTypes.filter((t) => t !== ft)
        : [...prev.featureTypes, ft],
    }));
  };

  const toggleCohort = (
    field: "targetCohortIds" | "comparatorCohortIds",
    cohortId: number,
  ) => {
    setDesign((prev) => ({
      ...prev,
      [field]: prev[field].includes(cohortId)
        ? prev[field].filter((id) => id !== cohortId)
        : [...prev[field], cohortId],
    }));
  };

  const removeCohort = (
    field: "targetCohortIds" | "comparatorCohortIds",
    cohortId: number,
  ) => {
    setDesign((prev) => ({
      ...prev,
      [field]: prev[field].filter((id) => id !== cohortId),
    }));
  };

  const handleSave = () => {
    if (!name.trim()) return;

    if (isNew || !characterization) {
      createMutation.mutate(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          design_json: design,
        },
        {
          onSuccess: (c) => onSaved?.(c),
        },
      );
    } else {
      updateMutation.mutate(
        {
          id: characterization.id,
          payload: {
            name: name.trim(),
            description: description.trim(),
            design_json: design,
          },
        },
        {
          onSuccess: (c) => onSaved?.(c),
        },
      );
    }
  };

  const handleDirectRun = () => {
    if (!sourceId || design.targetCohortIds.length === 0) return;

    const payload: DirectRunRequest = {
      source_id: sourceId,
      target_ids: design.targetCohortIds,
      outcome_ids: design.comparatorCohortIds,
      analyses: directAnalyses,
      time_windows: timeWindows,
      min_cell_count: design.minCellCount,
      min_prior_observation: minPriorObservation,
    };

    directRunMutation.mutate(payload, {
      onSuccess: (result) => onDirectResult?.(result),
    });
  };

  const addTimeWindow = () => {
    setTimeWindows((prev) => [...prev, { start_day: -365, end_day: -1 }]);
  };

  const removeTimeWindow = (index: number) => {
    setTimeWindows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTimeWindow = (
    index: number,
    field: "start_day" | "end_day",
    value: number,
  ) => {
    setTimeWindows((prev) =>
      prev.map((w, i) => (i === index ? { ...w, [field]: value } : w)),
    );
  };

  const addPresetWindow = (preset: TimeWindow) => {
    const already = timeWindows.some(
      (w) => w.start_day === preset.start_day && w.end_day === preset.end_day,
    );
    if (!already) {
      setTimeWindows((prev) => [...prev, preset]);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const canDirectRun =
    !!sourceId &&
    design.targetCohortIds.length > 0 &&
    !directRunMutation.isPending;

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
              placeholder="Characterization name"
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

      {/* Target Cohorts */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          Target Cohorts
        </h3>
        <p className="panel-subtitle">
          Select one or more cohorts to characterize.
        </p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin" style={{ color: "var(--text-muted)" }} />
        ) : (
          <div className="space-y-3 mt-3">
            <select
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val) toggleCohort("targetCohortIds", val);
                e.target.value = "";
              }}
              className="form-input form-select"
              defaultValue=""
            >
              <option value="">Add a target cohort...</option>
              {cohorts
                .filter((c) => !design.targetCohortIds.includes(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            {design.targetCohortIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {design.targetCohortIds.map((id) => {
                  const cohort = cohorts.find((c) => c.id === id);
                  return (
                    <span key={id} className="filter-chip active">
                      {cohort?.name ?? `Cohort #${id}`}
                      <button
                        type="button"
                        onClick={() =>
                          removeCohort("targetCohortIds", id)
                        }
                        className="chip-close"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Comparator / Outcome Cohorts */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          Outcome Cohorts{" "}
          <span style={{ color: "var(--text-ghost)", fontWeight: 400 }}>(optional)</span>
        </h3>
        <p className="panel-subtitle">
          Select outcome cohorts for comparison or time-to-event analysis.
        </p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin" style={{ color: "var(--text-muted)" }} />
        ) : (
          <div className="space-y-3 mt-3">
            <select
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val) toggleCohort("comparatorCohortIds", val);
                e.target.value = "";
              }}
              className="form-input form-select"
              defaultValue=""
            >
              <option value="">Add an outcome cohort...</option>
              {cohorts
                .filter(
                  (c) => !design.comparatorCohortIds.includes(c.id),
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            {design.comparatorCohortIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {design.comparatorCohortIds.map((id) => {
                  const cohort = cohorts.find((c) => c.id === id);
                  return (
                    <span
                      key={id}
                      className="filter-chip active"
                      style={{ borderColor: "var(--accent)", color: "var(--accent-light)", background: "var(--accent-bg)" }}
                    >
                      {cohort?.name ?? `Cohort #${id}`}
                      <button
                        type="button"
                        onClick={() =>
                          removeCohort("comparatorCohortIds", id)
                        }
                        className="chip-close"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Feature Types */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          Feature Types
        </h3>
        <p className="panel-subtitle">
          Select which feature categories to include in the analysis.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
          {ALL_FEATURE_TYPES.map((ft) => (
            <label
              key={ft.value}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors",
              )}
              style={design.featureTypes.includes(ft.value)
                ? { borderColor: "var(--primary)", background: "var(--primary-bg)", color: "var(--text-primary)" }
                : { borderColor: "var(--border-default)", background: "var(--surface-overlay)", color: "var(--text-muted)" }
              }
            >
              <input
                type="checkbox"
                checked={design.featureTypes.includes(ft.value)}
                onChange={() => toggleFeatureType(ft.value)}
                className="sr-only"
              />
              <div
                className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                style={design.featureTypes.includes(ft.value)
                  ? { borderColor: "var(--primary)", background: "var(--primary)" }
                  : { borderColor: "var(--border-subtle)" }
                }
              >
                {design.featureTypes.includes(ft.value) && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M2 5L4 7L8 3"
                      stroke="var(--surface-base)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              {ft.label}
            </label>
          ))}
        </div>
      </div>

      {/* OHDSI Analysis Types */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          OHDSI Analysis Types
        </h3>
        <p className="panel-subtitle">
          Select which OHDSI Characterization analyses to run via the R package.
        </p>
        <div className="space-y-3 mt-3">
          {(
            [
              {
                key: "aggregate_covariates" as const,
                label: "Aggregate Covariates",
                description: "Table 1 — covariate means with SMD comparison",
              },
              {
                key: "time_to_event" as const,
                label: "Time to Event",
                description: "Days from target cohort entry to outcome",
              },
              {
                key: "dechallenge_rechallenge" as const,
                label: "Dechallenge / Rechallenge",
                description: "Drug withdrawal and re-exposure patterns",
              },
            ] as { key: keyof DirectRunAnalyses; label: string; description: string }[]
          ).map(({ key, label, description }) => (
            <label
              key={key}
              className="flex items-start gap-3 rounded-lg border px-3 py-3 cursor-pointer transition-colors"
              style={directAnalyses[key]
                ? { borderColor: "#2DD4BF40", background: "#2DD4BF08" }
                : { borderColor: "var(--border-default)", background: "var(--surface-overlay)" }
              }
            >
              <div className="mt-0.5">
                <button
                  type="button"
                  onClick={() =>
                    setDirectAnalyses((prev) => ({
                      ...prev,
                      [key]: !prev[key],
                    }))
                  }
                  className={cn("toggle", directAnalyses[key] && "active")}
                />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: directAnalyses[key] ? "#2DD4BF" : "var(--text-secondary)" }}>
                  {label}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {description}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Time Windows */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          Time Windows
        </h3>
        <p className="panel-subtitle">
          Define the covariate look-back windows relative to cohort entry (day 0).
        </p>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 mt-3">
          {TIME_WINDOW_PRESETS.map((preset) => {
            const active = timeWindows.some(
              (w) => w.start_day === preset.window.start_day && w.end_day === preset.window.end_day,
            );
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => addPresetWindow(preset.window)}
                disabled={active}
                className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-default"
                style={active
                  ? { borderColor: "#C9A22740", background: "#C9A22710", color: "#C9A227" }
                  : { borderColor: "var(--border-default)", background: "var(--surface-overlay)", color: "var(--text-muted)" }
                }
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Custom windows */}
        <div className="space-y-2 mt-3">
          {timeWindows.map((w, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--border-default)", background: "var(--surface-overlay)" }}
            >
              <span className="text-xs font-medium w-16 shrink-0" style={{ color: "var(--text-muted)" }}>
                Window {i + 1}
              </span>
              <div className="flex items-center gap-2 flex-1">
                <label className="text-xs" style={{ color: "var(--text-ghost)" }}>Start</label>
                <input
                  type="number"
                  value={w.start_day}
                  onChange={(e) =>
                    updateTimeWindow(i, "start_day", Number(e.target.value))
                  }
                  className="form-input py-1 text-xs"
                  style={{ width: "6rem" }}
                />
                <label className="text-xs" style={{ color: "var(--text-ghost)" }}>End</label>
                <input
                  type="number"
                  value={w.end_day}
                  onChange={(e) =>
                    updateTimeWindow(i, "end_day", Number(e.target.value))
                  }
                  className="form-input py-1 text-xs"
                  style={{ width: "6rem" }}
                />
              </div>
              <button
                type="button"
                onClick={() => removeTimeWindow(i)}
                className="p-1 rounded transition-colors hover:opacity-100"
                style={{ color: "var(--text-ghost)", opacity: 0.6 }}
                title="Remove window"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addTimeWindow}
          className="mt-2 flex items-center gap-1.5 text-xs transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <Plus size={12} />
          Add custom window
        </button>
      </div>

      {/* Stratification & Parameters */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          Parameters
        </h3>

        {/* Stratification toggles */}
        <div className="flex items-center gap-6 mt-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--text-secondary)" }}>
            <button
              type="button"
              onClick={() =>
                setDesign((d) => ({
                  ...d,
                  stratifyByGender: !d.stratifyByGender,
                }))
              }
              className={cn("toggle", design.stratifyByGender && "active")}
            />
            Stratify by Gender
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--text-secondary)" }}>
            <button
              type="button"
              onClick={() =>
                setDesign((d) => ({
                  ...d,
                  stratifyByAge: !d.stratifyByAge,
                }))
              }
              className={cn("toggle", design.stratifyByAge && "active")}
            />
            Stratify by Age
          </label>
        </div>

        {/* Top N */}
        <div className="mt-4">
          <label className="form-label">
            Top N Features: {design.topN}
          </label>
          <input
            type="range"
            min={10}
            max={200}
            step={10}
            value={design.topN}
            onChange={(e) =>
              setDesign((d) => ({ ...d, topN: Number(e.target.value) }))
            }
            className="w-full"
            style={{ accentColor: "var(--primary)" }}
          />
          <div className="flex items-center justify-between" style={{ fontSize: "var(--text-xs)", color: "var(--text-ghost)" }}>
            <span>10</span>
            <span>200</span>
          </div>
        </div>

        {/* Min Cell Count */}
        <div className="mt-4 flex items-end gap-6">
          <div>
            <label className="form-label">
              Minimum Cell Count
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={design.minCellCount}
              onChange={(e) =>
                setDesign((d) => ({
                  ...d,
                  minCellCount: Number(e.target.value) || 5,
                }))
              }
              className="form-input"
              style={{ width: "8rem" }}
            />
          </div>

          {/* Min Prior Observation */}
          <div>
            <label className="form-label">
              Min Prior Observation (days)
            </label>
            <input
              type="number"
              min={0}
              max={3650}
              step={30}
              value={minPriorObservation}
              onChange={(e) =>
                setMinPriorObservation(Number(e.target.value) || 365)
              }
              className="form-input"
              style={{ width: "9rem" }}
            />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        {/* Run Direct */}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={handleDirectRun}
            disabled={!canDirectRun}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: "#9B1B30", color: "#F0EDE8" }}
            title={
              !sourceId
                ? "Select a data source above to run"
                : design.targetCohortIds.length === 0
                  ? "Add at least one target cohort"
                  : "Run characterization via OHDSI R package"
            }
          >
            {directRunMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Zap size={14} />
            )}
            Run Direct (OHDSI)
          </button>
          {directRunMutation.isError && (
            <p className="text-xs" style={{ color: "#E85A6B" }}>
              {directRunMutation.error instanceof Error
                ? directRunMutation.error.message
                : "Run failed"}
            </p>
          )}
          {!sourceId && (
            <p className="text-xs" style={{ color: "var(--text-ghost)" }}>
              Select a data source from the header to enable direct run
            </p>
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
