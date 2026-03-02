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

      {/* Target Cohort (single select) */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          Target Cohort
        </h3>
        <p className="panel-subtitle">
          Select the population at risk for this analysis.
        </p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin" style={{ color: "var(--text-muted)" }} />
        ) : (
          <select
            value={design.targetCohortId || ""}
            onChange={(e) =>
              setDesign((d) => ({
                ...d,
                targetCohortId: Number(e.target.value) || 0,
              }))
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

      {/* Outcome Cohorts (multi select) */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          Outcome Cohorts
        </h3>
        <p className="panel-subtitle">
          Select one or more outcome cohorts to measure incidence for.
        </p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin" style={{ color: "var(--text-muted)" }} />
        ) : (
          <div className="space-y-3 mt-3">
            <select
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val) toggleOutcomeCohort(val);
                e.target.value = "";
              }}
              className="form-input form-select"
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
                      className="filter-chip active"
                      style={{ borderColor: "var(--accent)", color: "var(--accent-light)", background: "var(--accent-bg)" }}
                    >
                      {cohort?.name ?? `Cohort #${id}`}
                      <button
                        type="button"
                        onClick={() => removeOutcomeCohort(id)}
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

      {/* Time at Risk */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          Time at Risk
        </h3>
        <p className="panel-subtitle">
          Define the observation period relative to the target cohort entry.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          {/* Start */}
          <div className="space-y-2">
            <label className="form-label">Start</label>
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
                className="form-input form-select flex-1"
              >
                <option value="StartDate">Start Date</option>
                <option value="EndDate">End Date</option>
              </select>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>+</span>
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
                className="form-input"
                style={{ width: "5rem" }}
              />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>days</span>
            </div>
          </div>

          {/* End */}
          <div className="space-y-2">
            <label className="form-label">End</label>
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
                className="form-input form-select flex-1"
              >
                <option value="StartDate">Start Date</option>
                <option value="EndDate">End Date</option>
              </select>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>+</span>
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
                className="form-input"
                style={{ width: "5rem" }}
              />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stratification & Parameters */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          Stratification
        </h3>

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

        {/* Min Cell Count */}
        <div className="mt-4">
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
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
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
