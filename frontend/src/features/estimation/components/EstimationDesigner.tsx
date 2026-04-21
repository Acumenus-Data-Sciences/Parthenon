import { useState, useEffect } from "react";
import { Loader2, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getCohortDefinitions } from "@/features/cohort-definitions/api/cohortApi";
import { CovariateSettingsPanel } from "@/components/analysis/CovariateSettingsPanel";
import type {
  EstimationDesign,
  EstimationAnalysis,
} from "../types/estimation";
import {
  useUpdateEstimation,
  useCreateEstimation,
} from "../hooks/useEstimations";

const defaultDesign: EstimationDesign = {
  targetCohortId: 0,
  comparatorCohortId: 0,
  outcomeCohortIds: [],
  model: {
    type: "cox",
    timeAtRiskStart: 0,
    timeAtRiskEnd: 0,
    endAnchor: "cohort end",
  },
  propensityScore: {
    enabled: true,
    trimming: 0.05,
    matching: { ratio: 1, caliper: 0.2 },
    stratification: { strata: 5 },
  },
  covariateSettings: {
    useDemographics: true,
    useConditionOccurrence: true,
    useDrugExposure: true,
    useProcedureOccurrence: false,
    useMeasurement: false,
    useObservation: false,
    timeWindows: [{ start: -365, end: 0 }],
  },
  negativeControlOutcomes: [],
};

interface EstimationDesignerProps {
  estimation?: EstimationAnalysis | null;
  isNew?: boolean;
  onSaved?: (e: EstimationAnalysis) => void;
}

export function EstimationDesigner({
  estimation,
  isNew,
  onSaved,
}: EstimationDesignerProps) {
  const { t } = useTranslation("app");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [design, setDesign] = useState<EstimationDesign>(defaultDesign);

  const { data: cohortData, isLoading: loadingCohorts } = useQuery({
    queryKey: ["cohort-definitions", { page: 1, limit: 200 }],
    queryFn: () => getCohortDefinitions({ page: 1, limit: 200 }),
  });

  const createMutation = useCreateEstimation();
  const updateMutation = useUpdateEstimation();

  const cohorts = cohortData?.items ?? [];

  // Sync form from estimation prop — legitimate external-source sync
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (estimation) {
      setName(estimation.name);
      setDescription(estimation.description ?? "");
      const dj = estimation.design_json ?? {};
      setDesign({
        ...defaultDesign,
        ...dj,
        model: { ...defaultDesign.model, ...(dj.model ?? {}) },
        propensityScore: {
          ...defaultDesign.propensityScore,
          ...(dj.propensityScore ?? {}),
          matching: { ...defaultDesign.propensityScore.matching, ...(dj.propensityScore?.matching ?? {}) },
          stratification: { ...defaultDesign.propensityScore.stratification, ...(dj.propensityScore?.stratification ?? {}) },
        },
        covariateSettings: { ...defaultDesign.covariateSettings, ...(dj.covariateSettings ?? {}) },
      });
    }
  }, [estimation]);

  const toggleOutcomeCohort = (cohortId: number) => {
    setDesign((prev) => ({
      ...prev,
      outcomeCohortIds: prev.outcomeCohortIds.includes(cohortId)
        ? prev.outcomeCohortIds.filter((id) => id !== cohortId)
        : [...prev.outcomeCohortIds, cohortId],
    }));
  };

  const removeOutcomeCohort = (cohortId: number) => {
    setDesign((prev) => ({
      ...prev,
      outcomeCohortIds: prev.outcomeCohortIds.filter((id) => id !== cohortId),
    }));
  };

  const handleSave = () => {
    if (!name.trim()) return;

    if (isNew || !estimation) {
      createMutation.mutate(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          design_json: design,
        },
        {
          onSuccess: (e) => onSaved?.(e),
        },
      );
    } else {
      updateMutation.mutate(
        {
          id: estimation.id,
          payload: {
            name: name.trim(),
            description: description.trim(),
            design_json: design,
          },
        },
        {
          onSuccess: (e) => onSaved?.(e),
        },
      );
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const psMethodOptions = [
    {
      value: "matching" as const,
      label: t("analyses.auto.pSMatching_70940f"),
    },
    {
      value: "stratification" as const,
      label: t("analyses.auto.pSStratification_d30504"),
    },
    { value: "iptw" as const, label: "IPTW" },
  ];

  const cohortFallback = (cohortId: number) =>
    t("analyses.auto.cohortNumber_6a7a5a", { id: cohortId });

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
              placeholder={t("analyses.auto.estimationAnalysisName_2c4c24")}
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
          {t("analyses.auto.selectTheTreatmentExposureCohort_4edbec")}
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

      {/* Comparator Cohort */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("analyses.auto.comparatorCohort_904c75")}
        </h3>
        <p className="text-xs text-text-muted">
          {t("analyses.auto.selectTheComparatorControlCohort_0e5e65")}
        </p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin text-text-muted" />
        ) : (
          <select
            value={design.comparatorCohortId || ""}
            onChange={(e) =>
              setDesign((d) => ({
                ...d,
                comparatorCohortId: Number(e.target.value) || 0,
              }))
            }
            className={cn(
              "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
              "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
            )}
          >
            <option value="">{t("analyses.auto.selectComparatorCohort_b651d5")}</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Outcome Cohorts */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("analyses.auto.outcomeCohorts_ed8002")}
        </h3>
        <p className="text-xs text-text-muted">
          {t("analyses.auto.selectOneOrMoreOutcomeCohortsToEstimateEffectsFor_e6b1a9")}
        </p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin text-text-muted" />
        ) : (
          <>
            <select
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val) toggleOutcomeCohort(val);
                e.target.value = "";
              }}
              className={cn(
                "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
                "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
              )}
              defaultValue=""
            >
              <option value="">{t("analyses.auto.addAnOutcomeCohort_c58a88")}</option>
              {cohorts
                .filter((c) => !design.outcomeCohortIds.includes(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            {design.outcomeCohortIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {design.outcomeCohortIds.map((id) => {
                  const cohort = cohorts.find((c) => c.id === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-critical"
                    >
                      {cohort?.name ?? cohortFallback(id)}
                      <button
                        type="button"
                        onClick={() => removeOutcomeCohort(id)}
                        className="hover:text-text-primary transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Model Settings */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("analyses.auto.modelSettings_46e0f9")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    type: e.target.value as "cox" | "logistic" | "poisson",
                  },
                }))
              }
              className={cn(
                "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
                "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
              )}
            >
              <option value="cox">{t("analyses.auto.coxProportionalHazards_6939ea")}</option>
              <option value="logistic">{t("analyses.auto.logisticRegression_3261e6")}</option>
              <option value="poisson">{t("analyses.auto.poissonRegression_36c04a")}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              {t("analyses.auto.endAnchor_cabfb2")}
            </label>
            <select
              value={design.model.endAnchor}
              onChange={(e) =>
                setDesign((d) => ({
                  ...d,
                  model: {
                    ...d.model,
                    endAnchor: e.target.value as
                      | "cohort start"
                      | "cohort end",
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
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              {t("analyses.auto.timeAtRiskStartDays_8b7bdf")}
            </label>
            <input
              type="number"
              value={design.model.timeAtRiskStart}
              onChange={(e) =>
                setDesign((d) => ({
                  ...d,
                  model: {
                    ...d.model,
                    timeAtRiskStart: Number(e.target.value),
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
              {t("analyses.auto.timeAtRiskEndDays_c16099")}
            </label>
            <input
              type="number"
              value={design.model.timeAtRiskEnd}
              onChange={(e) =>
                setDesign((d) => ({
                  ...d,
                  model: {
                    ...d.model,
                    timeAtRiskEnd: Number(e.target.value),
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

      {/* Propensity Score */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            {t("analyses.auto.propensityScore_1cf048")}
          </h3>
          <button
            type="button"
            onClick={() =>
              setDesign((d) => ({
                ...d,
                propensityScore: {
                  ...d.propensityScore,
                  enabled: !d.propensityScore.enabled,
                },
              }))
            }
            className={cn(
              "relative w-9 h-5 rounded-full transition-colors",
              design.propensityScore.enabled
                ? "bg-success"
                : "bg-surface-highlight",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                design.propensityScore.enabled && "translate-x-4",
              )}
            />
          </button>
        </div>

        {design.propensityScore.enabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                {t("analyses.auto.pSAdjustmentMethod_e5c5b3")}
              </label>
              <select
                value={design.propensityScore.method ?? "matching"}
                onChange={(e) =>
                  setDesign((d) => ({
                    ...d,
                    propensityScore: {
                      ...d.propensityScore,
                      method: e.target.value as "matching" | "stratification" | "iptw",
                    },
                  }))
                }
                className={cn(
                  "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
                  "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
                )}
              >
                {psMethodOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                {t("analyses.auto.trimming_733424")}
              </label>
              <input
                type="number"
                min={0}
                max={0.5}
                step={0.01}
                value={design.propensityScore.trimming}
                onChange={(e) =>
                  setDesign((d) => ({
                    ...d,
                    propensityScore: {
                      ...d.propensityScore,
                      trimming: Number(e.target.value),
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
                {t("analyses.auto.matchingRatio_f5c5da")}
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={design.propensityScore.matching.ratio}
                onChange={(e) =>
                  setDesign((d) => ({
                    ...d,
                    propensityScore: {
                      ...d.propensityScore,
                      matching: {
                        ...d.propensityScore.matching,
                        ratio: Number(e.target.value),
                      },
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
                {t("analyses.auto.caliper_d25392")}
              </label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={design.propensityScore.matching.caliper}
                onChange={(e) =>
                  setDesign((d) => ({
                    ...d,
                    propensityScore: {
                      ...d.propensityScore,
                      matching: {
                        ...d.propensityScore.matching,
                        caliper: Number(e.target.value),
                      },
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
                {t("analyses.auto.stratificationStrata_d5ae5c")}
              </label>
              <input
                type="number"
                min={2}
                max={20}
                value={design.propensityScore.stratification.strata}
                onChange={(e) =>
                  setDesign((d) => ({
                    ...d,
                    propensityScore: {
                      ...d.propensityScore,
                      stratification: {
                        strata: Number(e.target.value),
                      },
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
        )}
      </div>

      {/* Covariate Settings */}
      <CovariateSettingsPanel
        settings={design.covariateSettings}
        onChange={(covariateSettings) =>
          setDesign((d) => ({ ...d, covariateSettings }))
        }
      />

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
