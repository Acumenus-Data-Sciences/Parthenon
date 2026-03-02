import { useState, useEffect } from "react";
import { Loader2, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getCohortDefinitions } from "@/features/cohort-definitions/api/cohortApi";
import type {
  CharacterizationDesign,
  FeatureType,
  Characterization,
} from "../types/analysis";
import {
  useUpdateCharacterization,
  useCreateCharacterization,
} from "../hooks/useCharacterizations";

const ALL_FEATURE_TYPES: { value: FeatureType; label: string }[] = [
  { value: "demographics", label: "Demographics" },
  { value: "conditions", label: "Conditions" },
  { value: "drugs", label: "Drugs" },
  { value: "procedures", label: "Procedures" },
  { value: "measurements", label: "Measurements" },
  { value: "visits", label: "Visits" },
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

interface CharacterizationDesignerProps {
  characterization?: Characterization | null;
  isNew?: boolean;
  onSaved?: (c: Characterization) => void;
}

export function CharacterizationDesigner({
  characterization,
  isNew,
  onSaved,
}: CharacterizationDesignerProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [design, setDesign] = useState<CharacterizationDesign>(defaultDesign);

  const { data: cohortData, isLoading: loadingCohorts } = useQuery({
    queryKey: ["cohort-definitions", { page: 1, limit: 200 }],
    queryFn: () => getCohortDefinitions({ page: 1, limit: 200 }),
  });

  const createMutation = useCreateCharacterization();
  const updateMutation = useUpdateCharacterization();

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

      {/* Comparator Cohorts */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          Comparator Cohorts{" "}
          <span style={{ color: "var(--text-ghost)", fontWeight: 400 }}>(optional)</span>
        </h3>
        <p className="panel-subtitle">
          Select comparator cohorts for side-by-side comparison.
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
              <option value="">Add a comparator cohort...</option>
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
                design.featureTypes.includes(ft.value)
                  ? "border-[color:var(--primary)] bg-[color:var(--primary-bg)] text-[color:var(--text-primary)]"
                  : "border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] text-[color:var(--text-muted)]",
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
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                  >
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
