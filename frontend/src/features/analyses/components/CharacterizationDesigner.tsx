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
              placeholder="Characterization name"
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

      {/* Target Cohorts */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Target Cohorts
        </h3>
        <p className="text-xs text-[#8A857D]">
          Select one or more cohorts to characterize.
        </p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin text-[#8A857D]" />
        ) : (
          <>
            <select
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val) toggleCohort("targetCohortIds", val);
                e.target.value = "";
              }}
              className={cn(
                "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
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
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full bg-[#2DD4BF]/10 px-2.5 py-1 text-xs text-[#2DD4BF]"
                    >
                      {cohort?.name ?? `Cohort #${id}`}
                      <button
                        type="button"
                        onClick={() =>
                          removeCohort("targetCohortIds", id)
                        }
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

      {/* Comparator Cohorts */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Comparator Cohorts{" "}
          <span className="text-[#5A5650] font-normal">(optional)</span>
        </h3>
        <p className="text-xs text-[#8A857D]">
          Select comparator cohorts for side-by-side comparison.
        </p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin text-[#8A857D]" />
        ) : (
          <>
            <select
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val) toggleCohort("comparatorCohortIds", val);
                e.target.value = "";
              }}
              className={cn(
                "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
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
                      className="inline-flex items-center gap-1 rounded-full bg-[#C9A227]/10 px-2.5 py-1 text-xs text-[#C9A227]"
                    >
                      {cohort?.name ?? `Cohort #${id}`}
                      <button
                        type="button"
                        onClick={() =>
                          removeCohort("comparatorCohortIds", id)
                        }
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

      {/* Feature Types */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Feature Types
        </h3>
        <p className="text-xs text-[#8A857D]">
          Select which feature categories to include in the analysis.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ALL_FEATURE_TYPES.map((ft) => (
            <label
              key={ft.value}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors",
                design.featureTypes.includes(ft.value)
                  ? "border-[#2DD4BF]/30 bg-[#2DD4BF]/5 text-[#2DD4BF]"
                  : "border-[#232328] bg-[#0E0E11] text-[#8A857D] hover:text-[#C5C0B8]",
              )}
            >
              <input
                type="checkbox"
                checked={design.featureTypes.includes(ft.value)}
                onChange={() => toggleFeatureType(ft.value)}
                className="sr-only"
              />
              <div
                className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                  design.featureTypes.includes(ft.value)
                    ? "border-[#2DD4BF] bg-[#2DD4BF]"
                    : "border-[#323238]",
                )}
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
                      stroke="#0E0E11"
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
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Parameters
        </h3>

        {/* Stratification toggles */}
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

        {/* Top N */}
        <div>
          <label className="block text-xs font-medium text-[#8A857D] mb-1">
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
            className="w-full accent-[#2DD4BF]"
          />
          <div className="flex items-center justify-between text-[10px] text-[#5A5650]">
            <span>10</span>
            <span>200</span>
          </div>
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
