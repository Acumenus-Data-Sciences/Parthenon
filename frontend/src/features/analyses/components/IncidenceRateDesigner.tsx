import { useState, useEffect } from "react";
import { Loader2, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getCohortDefinitions } from "@/features/cohort-definitions/api/cohortApi";
import type {
  IncidenceRateDesign,
  IncidenceRateAnalysis,
} from "../types/analysis";
import {
  useUpdateIncidenceRate,
  useCreateIncidenceRate,
} from "../hooks/useIncidenceRates";

const defaultDesign: IncidenceRateDesign = {
  targetCohortId: 0,
  outcomeCohortIds: [],
  timeAtRisk: {
    start: { dateField: "StartDate", offset: 0 },
    end: { dateField: "EndDate", offset: 0 },
  },
  stratifyByGender: false,
  stratifyByAge: false,
  ageGroups: [],
  minCellCount: 5,
};

interface IncidenceRateDesignerProps {
  analysis?: IncidenceRateAnalysis | null;
  isNew?: boolean;
  onSaved?: (ir: IncidenceRateAnalysis) => void;
}

export function IncidenceRateDesigner({
  analysis,
  isNew,
  onSaved,
}: IncidenceRateDesignerProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [design, setDesign] = useState<IncidenceRateDesign>(defaultDesign);

  const { data: cohortData, isLoading: loadingCohorts } = useQuery({
    queryKey: ["cohort-definitions", { page: 1, limit: 200 }],
    queryFn: () => getCohortDefinitions({ page: 1, limit: 200 }),
  });

  const createMutation = useCreateIncidenceRate();
  const updateMutation = useUpdateIncidenceRate();

  const cohorts = cohortData?.items ?? [];

  useEffect(() => {
    if (analysis) {
      setName(analysis.name);
      setDescription(analysis.description ?? "");
      setDesign(analysis.design_json);
    }
  }, [analysis]);

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
      outcomeCohortIds: prev.outcomeCohortIds.filter(
        (id) => id !== cohortId,
      ),
    }));
  };

  const handleSave = () => {
    if (!name.trim()) return;

    if (isNew || !analysis) {
      createMutation.mutate(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          design_json: design,
        },
        {
          onSuccess: (ir) => onSaved?.(ir),
        },
      );
    } else {
      updateMutation.mutate(
        {
          id: analysis.id,
          payload: {
            name: name.trim(),
            description: description.trim(),
            design_json: design,
          },
        },
        {
          onSuccess: (ir) => onSaved?.(ir),
        },
      );
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

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
              placeholder="Incidence rate analysis name"
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

      {/* Target Cohort (single select) */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Target Cohort
        </h3>
        <p className="text-xs text-[#8A857D]">
          Select the population at risk for this analysis.
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
            <option value="">Select a target cohort...</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Outcome Cohorts (multi select) */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Outcome Cohorts
        </h3>
        <p className="text-xs text-[#8A857D]">
          Select one or more outcome cohorts to measure incidence for.
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
                .filter(
                  (c) => !design.outcomeCohortIds.includes(c.id),
                )
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
                      className="inline-flex items-center gap-1 rounded-full bg-[#C9A227]/10 px-2.5 py-1 text-xs text-[#C9A227]"
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

      {/* Time at Risk */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Time at Risk
        </h3>
        <p className="text-xs text-[#8A857D]">
          Define the observation period relative to the target cohort entry.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Start */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[#8A857D]">
              Start
            </label>
            <div className="flex items-center gap-2">
              <select
                value={design.timeAtRisk.start.dateField}
                onChange={(e) =>
                  setDesign((d) => ({
                    ...d,
                    timeAtRisk: {
                      ...d.timeAtRisk,
                      start: {
                        ...d.timeAtRisk.start,
                        dateField: e.target.value as
                          | "StartDate"
                          | "EndDate",
                      },
                    },
                  }))
                }
                className={cn(
                  "flex-1 rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                  "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
                )}
              >
                <option value="StartDate">Start Date</option>
                <option value="EndDate">End Date</option>
              </select>
              <span className="text-xs text-[#8A857D]">+</span>
              <input
                type="number"
                value={design.timeAtRisk.start.offset}
                onChange={(e) =>
                  setDesign((d) => ({
                    ...d,
                    timeAtRisk: {
                      ...d.timeAtRisk,
                      start: {
                        ...d.timeAtRisk.start,
                        offset: Number(e.target.value) || 0,
                      },
                    },
                  }))
                }
                className={cn(
                  "w-20 rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                  "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
                )}
              />
              <span className="text-xs text-[#8A857D]">days</span>
            </div>
          </div>

          {/* End */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[#8A857D]">
              End
            </label>
            <div className="flex items-center gap-2">
              <select
                value={design.timeAtRisk.end.dateField}
                onChange={(e) =>
                  setDesign((d) => ({
                    ...d,
                    timeAtRisk: {
                      ...d.timeAtRisk,
                      end: {
                        ...d.timeAtRisk.end,
                        dateField: e.target.value as
                          | "StartDate"
                          | "EndDate",
                      },
                    },
                  }))
                }
                className={cn(
                  "flex-1 rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                  "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
                )}
              >
                <option value="StartDate">Start Date</option>
                <option value="EndDate">End Date</option>
              </select>
              <span className="text-xs text-[#8A857D]">+</span>
              <input
                type="number"
                value={design.timeAtRisk.end.offset}
                onChange={(e) =>
                  setDesign((d) => ({
                    ...d,
                    timeAtRisk: {
                      ...d.timeAtRisk,
                      end: {
                        ...d.timeAtRisk.end,
                        offset: Number(e.target.value) || 0,
                      },
                    },
                  }))
                }
                className={cn(
                  "w-20 rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                  "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
                )}
              />
              <span className="text-xs text-[#8A857D]">days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stratification & Parameters */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Stratification
        </h3>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-[#C5C0B8] cursor-pointer">
            <button
              type="button"
              onClick={() =>
                setDesign((d) => ({
                  ...d,
                  stratifyByGender: !d.stratifyByGender,
                }))
              }
              className={cn(
                "relative w-9 h-5 rounded-full transition-colors",
                design.stratifyByGender
                  ? "bg-[#2DD4BF]"
                  : "bg-[#323238]",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                  design.stratifyByGender && "translate-x-4",
                )}
              />
            </button>
            Stratify by Gender
          </label>
          <label className="flex items-center gap-2 text-sm text-[#C5C0B8] cursor-pointer">
            <button
              type="button"
              onClick={() =>
                setDesign((d) => ({
                  ...d,
                  stratifyByAge: !d.stratifyByAge,
                }))
              }
              className={cn(
                "relative w-9 h-5 rounded-full transition-colors",
                design.stratifyByAge ? "bg-[#2DD4BF]" : "bg-[#323238]",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                  design.stratifyByAge && "translate-x-4",
                )}
              />
            </button>
            Stratify by Age
          </label>
        </div>

        {/* Min Cell Count */}
        <div>
          <label className="block text-xs font-medium text-[#8A857D] mb-1">
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
            className={cn(
              "w-32 rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
              "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
            )}
          />
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
