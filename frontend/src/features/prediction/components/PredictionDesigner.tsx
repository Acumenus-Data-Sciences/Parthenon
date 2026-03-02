import { useState, useEffect } from "react";
import { Loader2, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getCohortDefinitions } from "@/features/cohort-definitions/api/cohortApi";
import type {
  PredictionDesign,
  PredictionAnalysis,
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

  useEffect(() => {
    if (prediction) {
      setName(prediction.name);
      setDescription(prediction.description ?? "");
      setDesign(prediction.design_json);
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
    value: PredictionDesign["model"]["type"];
    label: string;
  }[] = [
    { value: "lasso_logistic_regression", label: "LASSO Logistic Regression" },
    { value: "gradient_boosting", label: "Gradient Boosting Machine" },
    { value: "random_forest", label: "Random Forest" },
  ];

  const covariateOptions = [
    { key: "useDemographics" as const, label: "Demographics" },
    { key: "useConditionOccurrence" as const, label: "Condition Occurrence" },
    { key: "useDrugExposure" as const, label: "Drug Exposure" },
    { key: "useProcedureOccurrence" as const, label: "Procedure Occurrence" },
    { key: "useMeasurement" as const, label: "Measurement" },
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
              placeholder="Prediction model name"
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
          Select the population to develop the prediction model for.
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

      {/* Outcome Cohort */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Outcome Cohort
        </h3>
        <p className="text-xs text-[#8A857D]">
          Select the outcome to predict.
        </p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin text-[#8A857D]" />
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
              "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
              "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
            )}
          >
            <option value="">Select outcome cohort...</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Model Type */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Model Configuration
        </h3>
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
                  type: e.target.value as PredictionDesign["model"]["type"],
                },
              }))
            }
            className={cn(
              "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
              "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
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
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Time at Risk
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1">
              Start (days)
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
                "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1">
              End (days)
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
                "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1">
              End Anchor
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
                "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
            >
              <option value="cohort start">Cohort Start</option>
              <option value="cohort end">Cohort End</option>
            </select>
          </div>
        </div>
      </div>

      {/* Covariate Settings */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Covariate Settings
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {covariateOptions.map((opt) => (
            <label
              key={opt.key}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors",
                design.covariateSettings[opt.key]
                  ? "border-[#2DD4BF]/30 bg-[#2DD4BF]/5 text-[#2DD4BF]"
                  : "border-[#232328] bg-[#0E0E11] text-[#8A857D] hover:text-[#C5C0B8]",
              )}
            >
              <input
                type="checkbox"
                checked={design.covariateSettings[opt.key]}
                onChange={() =>
                  setDesign((d) => ({
                    ...d,
                    covariateSettings: {
                      ...d.covariateSettings,
                      [opt.key]: !d.covariateSettings[opt.key],
                    },
                  }))
                }
                className="sr-only"
              />
              <div
                className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                  design.covariateSettings[opt.key]
                    ? "border-[#2DD4BF] bg-[#2DD4BF]"
                    : "border-[#323238]",
                )}
              >
                {design.covariateSettings[opt.key] && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                  >
                    <path
                      d="M2 5L4 7L8 3"
                      stroke="#0E0E11"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              {opt.label}
            </label>
          ))}
        </div>

        {/* Time Windows */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-[#8A857D] mb-2">
            Time Windows
          </label>
          {design.covariateSettings.timeWindows.map((tw, idx) => (
            <div key={idx} className="flex items-center gap-2 mb-2">
              <input
                type="number"
                value={tw.start}
                onChange={(e) => {
                  const newWindows = [
                    ...design.covariateSettings.timeWindows,
                  ];
                  newWindows[idx] = {
                    ...newWindows[idx],
                    start: Number(e.target.value),
                  };
                  setDesign((d) => ({
                    ...d,
                    covariateSettings: {
                      ...d.covariateSettings,
                      timeWindows: newWindows,
                    },
                  }));
                }}
                className={cn(
                  "w-28 rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                  "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
                )}
              />
              <span className="text-xs text-[#5A5650]">to</span>
              <input
                type="number"
                value={tw.end}
                onChange={(e) => {
                  const newWindows = [
                    ...design.covariateSettings.timeWindows,
                  ];
                  newWindows[idx] = {
                    ...newWindows[idx],
                    end: Number(e.target.value),
                  };
                  setDesign((d) => ({
                    ...d,
                    covariateSettings: {
                      ...d.covariateSettings,
                      timeWindows: newWindows,
                    },
                  }));
                }}
                className={cn(
                  "w-28 rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                  "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
                )}
              />
              <span className="text-xs text-[#5A5650]">days</span>
              {design.covariateSettings.timeWindows.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setDesign((d) => ({
                      ...d,
                      covariateSettings: {
                        ...d.covariateSettings,
                        timeWindows:
                          d.covariateSettings.timeWindows.filter(
                            (_, i) => i !== idx,
                          ),
                      },
                    }));
                  }}
                  className="text-[#8A857D] hover:text-[#E85A6B] transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setDesign((d) => ({
                ...d,
                covariateSettings: {
                  ...d.covariateSettings,
                  timeWindows: [
                    ...d.covariateSettings.timeWindows,
                    { start: -365, end: 0 },
                  ],
                },
              }))
            }
            className="text-xs text-[#2DD4BF] hover:text-[#26B8A5] transition-colors"
          >
            + Add time window
          </button>
        </div>
      </div>

      {/* Population Settings */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Population Settings
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1">
              Washout Period (days)
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
                "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1">
              Minimum Time at Risk (days)
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
                "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-[#C5C0B8] cursor-pointer">
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
                  ? "bg-[#2DD4BF]"
                  : "bg-[#323238]",
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
            Remove Prior Outcome
          </label>
          <label className="flex items-center gap-2 text-sm text-[#C5C0B8] cursor-pointer">
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
                  ? "bg-[#2DD4BF]"
                  : "bg-[#323238]",
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
            Require Time at Risk
          </label>
        </div>
      </div>

      {/* Split Settings */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Train/Test Split
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1">
              Test Fraction: {design.splitSettings.testFraction}
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
              className="w-full accent-[#2DD4BF]"
            />
            <div className="flex items-center justify-between text-[10px] text-[#5A5650]">
              <span>0.1</span>
              <span>0.5</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1">
              Random Seed
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
                "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
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
