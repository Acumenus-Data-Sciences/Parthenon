import { useState, useEffect } from "react";
import { Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getCohortDefinitions } from "@/features/cohort-definitions/api/cohortApi";
import { CovariateSettingsPanel } from "@/components/analysis/CovariateSettingsPanel";
import type {
  PredictionDesign,
  PredictionAnalysis,
  PredictionModelType,
} from "../types/prediction";
import {
  useUpdatePrediction,
  useCreatePrediction,
} from "../hooks/usePredictions";

const defaultDesign: PredictionDesign = {
  targetCohortId: 0,
  outcomeCohortId: 0,
  model: {
    type: "lasso_logistic_regression",
    hyperParameters: {},
  },
  timeAtRisk: {
    start: 1,
    end: 365,
    endAnchor: "cohort start",
  },
  covariateSettings: {
    useDemographics: true,
    useConditionOccurrence: true,
    useDrugExposure: true,
    useProcedureOccurrence: false,
    useMeasurement: false,
    timeWindows: [{ start: -365, end: 0 }],
  },
  populationSettings: {
    washoutPeriod: 365,
    removeSubjectsWithPriorOutcome: true,
    requireTimeAtRisk: true,
    minTimeAtRisk: 365,
  },
  splitSettings: {
    testFraction: 0.25,
    splitSeed: 42,
  },
};

interface PredictionDesignerProps {
  prediction?: PredictionAnalysis | null;
  isNew?: boolean;
  onSaved?: (p: PredictionAnalysis) => void;
}

export function PredictionDesigner({
  prediction,
  isNew,
  onSaved,
}: PredictionDesignerProps) {
  const { t } = useTranslation("app");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [design, setDesign] = useState<PredictionDesign>(defaultDesign);

  const { data: cohortData, isLoading: loadingCohorts } = useQuery({
    queryKey: ["cohort-definitions", { page: 1, limit: 200 }],
    queryFn: () => getCohortDefinitions({ page: 1, limit: 200 }),
  });

  const createMutation = useCreatePrediction();
  const updateMutation = useUpdatePrediction();

  const cohorts = cohortData?.items ?? [];

  // Sync form from prediction prop — legitimate external-source sync
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (prediction) {
      setName(prediction.name);
      setDescription(prediction.description ?? "");
      const dj = prediction.design_json ?? {};
      setDesign({
        ...defaultDesign,
        ...dj,
        model: { ...defaultDesign.model, ...(dj.model ?? {}) },
        timeAtRisk: { ...defaultDesign.timeAtRisk, ...(dj.timeAtRisk ?? {}) },
        covariateSettings: { ...defaultDesign.covariateSettings, ...(dj.covariateSettings ?? {}) },
        populationSettings: { ...defaultDesign.populationSettings, ...(dj.populationSettings ?? {}) },
        splitSettings: { ...defaultDesign.splitSettings, ...(dj.splitSettings ?? {}) },
      });
    }
  }, [prediction]);

  const handleSave = () => {
    if (!name.trim()) return;

    if (isNew || !prediction) {
      createMutation.mutate(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          design_json: design,
        },
        {
          onSuccess: (p) => onSaved?.(p),
        },
      );
    } else {
      updateMutation.mutate(
        {
          id: prediction.id,
          payload: {
            name: name.trim(),
            description: description.trim(),
            design_json: design,
          },
        },
        {
          onSuccess: (p) => onSaved?.(p),
        },
      );
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const modelTypes: {
    value: PredictionModelType;
    label: string;
  }[] = [
    {
      value: "lasso_logistic_regression",
      label: t("analyses.auto.lASSOLogisticRegression_e0a168"),
    },
    {
      value: "gradient_boosting",
      label: t("analyses.auto.gradientBoostingMachine_0efac9"),
    },
    { value: "random_forest", label: t("analyses.auto.randomForest_3a9d79") },
    { value: "ada_boost", label: t("analyses.auto.adaBoost_7a9d3d") },
    { value: "decision_tree", label: t("analyses.auto.decisionTree_6f17e9") },
    { value: "naive_bayes", label: t("analyses.auto.naiveBayes_952bdf") },
    { value: "mlp", label: t("analyses.auto.multiLayerPerceptron_5a66b8") },
    { value: "lightgbm", label: t("analyses.auto.lightGBM_161af8") },
    {
      value: "cox_model",
      label: t("analyses.auto.coxProportionalHazards_6939ea"),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Name & Description */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("analyses.auto.basicInformation_87cabb")}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              {t("analyses.auto.name_49ee30")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("analyses.auto.predictionModelName_8c12ea")}
              className={cn(
                "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
                "text-text-primary placeholder:text-text-ghost",
                "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
              )}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              {t("analyses.auto.description_b5a7ad")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("analyses.auto.optionalDescription_d196d2")}
              rows={2}
              className={cn(
                "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
                "text-text-primary placeholder:text-text-ghost resize-none",
                "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
              )}
            />
          </div>
        </div>
      </div>

      {/* Target Cohort */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("analyses.auto.targetCohort_4d7f0b")}
        </h3>
        <p className="text-xs text-text-muted">
          {t("analyses.auto.selectThePopulationToDevelopThePredictionModelFor_d217bb")}
        </p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin text-text-muted" />
        ) : (
          <select
            value={design.targetCohortId || ""}
            onChange={(e) =>
              setDesign((d) => ({
                ...d,
                targetCohortId: Number(e.target.value) || 0,
              }))
            }
            className={cn(
              "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
              "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
            )}
          >
            <option value="">{t("analyses.auto.selectTargetCohort_5de8bf")}</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Outcome Cohort */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("analyses.auto.outcomeCohort_b279fb")}
        </h3>
        <p className="text-xs text-text-muted">
          {t("analyses.auto.selectTheOutcomeToPredict_58b0f6")}
        </p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin text-text-muted" />
        ) : (
          <select
            value={design.outcomeCohortId || ""}
            onChange={(e) =>
              setDesign((d) => ({
                ...d,
                outcomeCohortId: Number(e.target.value) || 0,
              }))
            }
            className={cn(
              "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
              "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
            )}
          >
            <option value="">{t("analyses.auto.selectOutcomeCohort_9a111f")}</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Model Type */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("analyses.auto.modelConfiguration_f08a2d")}
        </h3>
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            {t("analyses.auto.modelType_e2716f")}
          </label>
          <select
            value={design.model.type}
            onChange={(e) =>
              setDesign((d) => ({
                ...d,
                model: {
                  ...d.model,
                  type: e.target.value as PredictionDesign["model"]["type"],
                },
              }))
            }
            className={cn(
              "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
              "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
            )}
          >
            {modelTypes.map((mt) => (
              <option key={mt.value} value={mt.value}>
                {mt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Time at Risk */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("analyses.auto.timeAtRisk_7cbd22")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              {t("analyses.auto.startDays_b89266")}
            </label>
            <input
              type="number"
              value={design.timeAtRisk.start}
              onChange={(e) =>
                setDesign((d) => ({
                  ...d,
                  timeAtRisk: {
                    ...d.timeAtRisk,
                    start: Number(e.target.value),
                  },
                }))
              }
              className={cn(
                "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
                "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
              )}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              {t("analyses.auto.endDays_c83851")}
            </label>
            <input
              type="number"
              value={design.timeAtRisk.end}
              onChange={(e) =>
                setDesign((d) => ({
                  ...d,
                  timeAtRisk: {
                    ...d.timeAtRisk,
                    end: Number(e.target.value),
                  },
                }))
              }
              className={cn(
                "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
                "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
              )}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              {t("analyses.auto.endAnchor_cabfb2")}
            </label>
            <select
              value={design.timeAtRisk.endAnchor}
              onChange={(e) =>
                setDesign((d) => ({
                  ...d,
                  timeAtRisk: {
                    ...d.timeAtRisk,
                    endAnchor: e.target.value as "cohort start" | "cohort end",
                  },
                }))
              }
              className={cn(
                "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
                "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
              )}
            >
              <option value="cohort start">{t("analyses.auto.cohortStart_8ed0f7")}</option>
              <option value="cohort end">{t("analyses.auto.cohortEnd_8151f8")}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Covariate Settings */}
      <CovariateSettingsPanel
        settings={design.covariateSettings}
        onChange={(covariateSettings) =>
          setDesign((d) => ({ ...d, covariateSettings }))
        }
      />

      {/* Population Settings */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("analyses.auto.populationSettings_d6d63e")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              {t("analyses.auto.washoutPeriodDays_827424")}
            </label>
            <input
              type="number"
              min={0}
              value={design.populationSettings.washoutPeriod}
              onChange={(e) =>
                setDesign((d) => ({
                  ...d,
                  populationSettings: {
                    ...d.populationSettings,
                    washoutPeriod: Number(e.target.value),
                  },
                }))
              }
              className={cn(
                "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
                "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
              )}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              {t("analyses.auto.minimumTimeAtRiskDays_874dcf")}
            </label>
            <input
              type="number"
              min={0}
              value={design.populationSettings.minTimeAtRisk}
              onChange={(e) =>
                setDesign((d) => ({
                  ...d,
                  populationSettings: {
                    ...d.populationSettings,
                    minTimeAtRisk: Number(e.target.value),
                  },
                }))
              }
              className={cn(
                "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
                "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
              )}
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <button
              type="button"
              onClick={() =>
                setDesign((d) => ({
                  ...d,
                  populationSettings: {
                    ...d.populationSettings,
                    removeSubjectsWithPriorOutcome:
                      !d.populationSettings.removeSubjectsWithPriorOutcome,
                  },
                }))
              }
              className={cn(
                "relative w-9 h-5 rounded-full transition-colors",
                design.populationSettings.removeSubjectsWithPriorOutcome
                  ? "bg-success"
                  : "bg-surface-highlight",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                  design.populationSettings
                    .removeSubjectsWithPriorOutcome && "translate-x-4",
                )}
              />
            </button>
            {t("analyses.auto.removePriorOutcome_e55084")}
          </label>
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <button
              type="button"
              onClick={() =>
                setDesign((d) => ({
                  ...d,
                  populationSettings: {
                    ...d.populationSettings,
                    requireTimeAtRisk:
                      !d.populationSettings.requireTimeAtRisk,
                  },
                }))
              }
              className={cn(
                "relative w-9 h-5 rounded-full transition-colors",
                design.populationSettings.requireTimeAtRisk
                  ? "bg-success"
                  : "bg-surface-highlight",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                  design.populationSettings.requireTimeAtRisk &&
                    "translate-x-4",
                )}
              />
            </button>
            {t("analyses.auto.requireTimeAtRisk_6d95a7")}
          </label>
        </div>
      </div>

      {/* Split Settings */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("analyses.auto.trainTestSplit_45b18b")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              {t("analyses.auto.testFraction_a427e1")} {design.splitSettings.testFraction}
            </label>
            <input
              type="range"
              min={0.1}
              max={0.5}
              step={0.05}
              value={design.splitSettings.testFraction}
              onChange={(e) =>
                setDesign((d) => ({
                  ...d,
                  splitSettings: {
                    ...d.splitSettings,
                    testFraction: Number(e.target.value),
                  },
                }))
              }
              className="w-full accent-success"
            />
            <div className="flex items-center justify-between text-[10px] text-text-ghost">
              <span>0.1</span>
              <span>0.5</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              {t("analyses.auto.randomSeed_17e865")}
            </label>
            <input
              type="number"
              min={1}
              value={design.splitSettings.splitSeed}
              onChange={(e) =>
                setDesign((d) => ({
                  ...d,
                  splitSettings: {
                    ...d.splitSettings,
                    splitSeed: Number(e.target.value) || 42,
                  },
                }))
              }
              className={cn(
                "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
                "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
              )}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-success px-5 py-2.5 text-sm font-medium text-surface-base hover:bg-success-dark transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {isNew ? t("analyses.auto.create_686e69") : t("analyses.auto.saveChanges_f5d604")}
        </button>
      </div>
    </div>
  );
}
