import { useState, useEffect } from "react";
import { Loader2, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
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
    { value: "matching" as const, label: "PS Matching" },
    { value: "stratification" as const, label: "PS Stratification" },
    { value: "iptw" as const, label: "IPTW" },
  ];

  return (
    <div className="space-y-6">
      {/* Name & Description */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Basic Information
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Estimation analysis name"
              className={cn(
                "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                "text-[#F0EDE8] placeholder:text-[#5A5650]",
                "focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className={cn(
                "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                "text-[#F0EDE8] placeholder:text-[#5A5650] resize-none",
                "focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
            />
          </div>
        </div>
      </div>

      {/* Target Cohort */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Target Cohort
        </h3>
        <p className="text-xs text-[#8A857D]">
          Select the treatment/exposure cohort.
        </p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin text-[#8A857D]" />
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
              "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
              "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
            )}
          >
            <option value="">Select target cohort...</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Comparator Cohort */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Comparator Cohort
        </h3>
        <p className="text-xs text-[#8A857D]">
          Select the comparator/control cohort.
        </p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin text-[#8A857D]" />
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
              "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
              "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
            )}
          >
            <option value="">Select comparator cohort...</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Outcome Cohorts */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Outcome Cohorts
        </h3>
        <p className="text-xs text-[#8A857D]">
          Select one or more outcome cohorts to estimate effects for.
        </p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin text-[#8A857D]" />
        ) : (
          <>
            <select
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val) toggleOutcomeCohort(val);
                e.target.value = "";
              }}
              className={cn(
                "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
              defaultValue=""
            >
              <option value="">Add an outcome cohort...</option>
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
                      className="inline-flex items-center gap-1 rounded-full bg-[#9B1B30]/10 px-2.5 py-1 text-xs text-[#E85A6B]"
                    >
                      {cohort?.name ?? `Cohort #${id}`}
                      <button
                        type="button"
                        onClick={() => removeOutcomeCohort(id)}
                        className="hover:text-white transition-colors"
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
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Model Settings
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1">
              Model Type
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
                "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
            >
              <option value="cox">Cox Proportional Hazards</option>
              <option value="logistic">Logistic Regression</option>
              <option value="poisson">Poisson Regression</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1">
              End Anchor
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
                "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
            >
              <option value="cohort start">Cohort Start</option>
              <option value="cohort end">Cohort End</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1">
              Time at Risk Start (days)
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
                "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1">
              Time at Risk End (days)
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
                "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
            />
          </div>
        </div>
      </div>

      {/* Propensity Score */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#F0EDE8]">
            Propensity Score
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
                ? "bg-[#2DD4BF]"
                : "bg-[#323238]",
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
              <label className="block text-xs font-medium text-[#8A857D] mb-1">
                PS Adjustment Method
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
                  "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                  "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
                )}
              >
                {psMethodOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8A857D] mb-1">
                Trimming (%)
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
                  "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                  "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
                )}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8A857D] mb-1">
                Matching Ratio
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
                  "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                  "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
                )}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8A857D] mb-1">
                Caliper
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
                  "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                  "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
                )}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8A857D] mb-1">
                Stratification Strata
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
                  "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                  "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
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
          className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-5 py-2.5 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors disabled:opacity-50"
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
