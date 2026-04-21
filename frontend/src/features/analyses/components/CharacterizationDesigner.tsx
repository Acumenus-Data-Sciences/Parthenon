import { useState, useEffect } from "react";
import { Loader2, Save, X, Zap, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getCohortDefinitions } from "@/features/cohort-definitions/api/cohortApi";
import { useTranslation } from "react-i18next";
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

function getAllFeatureTypes(t: (key: string) => string): { value: FeatureType; label: string }[] {
  return [
    { value: "demographics", label: t("analyses.auto.demographics_d6f6d1") },
    { value: "conditions", label: t("analyses.auto.conditions_229eb0") },
    { value: "drugs", label: t("analyses.auto.drugs_626c25") },
    { value: "procedures", label: t("analyses.auto.procedures_5102ab") },
    { value: "measurements", label: t("analyses.auto.measurements_930aeb") },
    { value: "visits", label: t("analyses.auto.visits_d7e637") },
  ];
}

function getTimeWindowPresets(t: (key: string) => string): { label: string; window: TimeWindow }[] {
  return [
    { label: t("analyses.auto.longTerm365To1_b8e296"), window: { start_day: -365, end_day: -1 } },
    { label: t("analyses.auto.shortTerm30To1_512204"), window: { start_day: -30, end_day: -1 } },
    { label: t("analyses.auto.index0To0_bb5827"), window: { start_day: 0, end_day: 0 } },
  ];
}

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
  const { t } = useTranslation("app");
  const allFeatureTypes = getAllFeatureTypes(t);
  const timeWindowPresets = getTimeWindowPresets(t);
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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (characterization) {
      setName(characterization.name);
      setDescription(characterization.description ?? "");
      setDesign({
        ...defaultDesign,
        ...characterization.design_json,
        targetCohortIds: characterization.design_json?.targetCohortIds ?? defaultDesign.targetCohortIds,
        comparatorCohortIds: characterization.design_json?.comparatorCohortIds ?? defaultDesign.comparatorCohortIds,
        featureTypes: characterization.design_json?.featureTypes ?? characterization.design_json?.featureAnalyses ?? defaultDesign.featureTypes,
      });
    }
  }, [characterization]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
          {t("analyses.auto.basicInformation_87cabb")}
        </h3>
        <div className="space-y-3 mt-3">
          <div>
            <label className="form-label">{t("analyses.auto.name_49ee30")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("analyses.auto.characterizationName_9dde7f")}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">{t("analyses.auto.description_b5a7ad")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("analyses.auto.optionalDescription_d196d2")}
              rows={2}
              className="form-input form-textarea"
            />
          </div>
        </div>
      </div>

      {/* Target Cohorts */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          {t("analyses.auto.targetCohorts_730954")}
        </h3>
        <p className="panel-subtitle">
          {t("analyses.auto.selectOneOrMoreCohortsToCharacterize_4745cc")}
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
              <option value="">{t("analyses.auto.addATargetCohort_c3df89")}</option>
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
          {t("analyses.auto.outcomeCohorts_ed8002")}{" "}
          <span style={{ color: "var(--text-ghost)", fontWeight: 400 }}>{t("analyses.auto.optional_f53d1c")}</span>
        </h3>
        <p className="panel-subtitle">
          {t("analyses.auto.selectOutcomeCohortsForComparisonOrTimeTo_1bd486")}
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
              <option value="">{t("analyses.auto.addAnOutcomeCohort_c58a88")}</option>
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
          {t("analyses.auto.featureTypes_4c81a3")}
        </h3>
        <p className="panel-subtitle">
          {t("analyses.auto.selectWhichFeatureCategoriesToIncludeInThe_9d5d7d")}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
          {allFeatureTypes.map((ft) => (
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
          {t("analyses.auto.oHDSIAnalysisTypes_23ecb8")}
        </h3>
        <p className="panel-subtitle">
          {t("analyses.auto.selectWhichOHDSICharacterizationAnalysesToRunVia_41bfab")}
        </p>
        <div className="space-y-3 mt-3">
          {(
            [
              {
                key: "aggregate_covariates" as const,
                label: t("analyses.auto.aggregateCovariates_4e873a"),
                description: t("analyses.auto.table1CovariateMeansWithSMDComparison_1b2010"),
              },
              {
                key: "time_to_event" as const,
                label: t("analyses.auto.timeToEvent_367be0"),
                description: t("analyses.auto.daysFromTargetCohortEntryToOutcome_0c53f5"),
              },
              {
                key: "dechallenge_rechallenge" as const,
                label: t("analyses.auto.dechallengeRechallenge_4854be"),
                description: t("analyses.auto.drugWithdrawalAndReExposurePatterns_b545cb"),
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
                <p className="text-sm font-medium" style={{ color: directAnalyses[key] ? "var(--success)" : "var(--text-secondary)" }}>
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
          {t("analyses.auto.timeWindows_88d5d3")}
        </h3>
        <p className="panel-subtitle">
          {t("analyses.auto.defineTheCovariateLookBackWindowsRelativeTo_b71059")}
        </p>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 mt-3">
          {timeWindowPresets.map((preset) => {
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
                  ? { borderColor: "#C9A22740", background: "#C9A22710", color: "var(--accent)" }
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
                {t("analyses.auto.window_c89686")} {i + 1}
              </span>
              <div className="flex items-center gap-2 flex-1">
                <label className="text-xs" style={{ color: "var(--text-ghost)" }}>{t("analyses.auto.start_a6122a")}</label>
                <input
                  type="number"
                  value={w.start_day}
                  onChange={(e) =>
                    updateTimeWindow(i, "start_day", Number(e.target.value))
                  }
                  className="form-input py-1 text-xs"
                  style={{ width: "6rem" }}
                />
                <label className="text-xs" style={{ color: "var(--text-ghost)" }}>{t("analyses.auto.end_87557f")}</label>
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
                title={t("analyses.auto.removeWindow_89f7a2")}
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
          {t("analyses.auto.addCustomWindow_8f43bf")}
        </button>
      </div>

      {/* Stratification & Parameters */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          {t("analyses.auto.parameters_3225a1")}
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
            {t("analyses.auto.stratifyByGender_4879ab")}
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
            {t("analyses.auto.stratifyByAge_05a59d")}
          </label>
        </div>

        {/* Top N */}
        <div className="mt-4">
          <label className="form-label">
            {t("analyses.auto.topNFeatures_af535f")} {design.topN}
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
              {t("analyses.auto.minimumCellCount_2438c8")}
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
              {t("analyses.auto.minPriorObservationDays_01e009")}
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
            style={{ background: "var(--primary)", color: "#FFFFFF" }}
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
            {t("analyses.auto.runDirectOHDSI_192424")}
          </button>
          {directRunMutation.isError && (
            <p className="text-xs" style={{ color: "var(--critical)" }}>
              {directRunMutation.error instanceof Error
                ? directRunMutation.error.message
                : "Run failed"}
            </p>
          )}
          {!sourceId && (
            <p className="text-xs" style={{ color: "var(--text-ghost)" }}>
              {t("analyses.auto.selectADataSourceFromTheHeaderTo_87174d")}
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
