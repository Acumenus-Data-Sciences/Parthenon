import { useState, useEffect } from "react";
import { Loader2, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getCohortDefinitions } from "@/features/cohort-definitions/api/cohortApi";
import type { PathwayDesign, PathwayAnalysis } from "../types/pathway";
import { useUpdatePathway, useCreatePathway } from "../hooks/usePathways";

const defaultDesign: PathwayDesign = {
  targetCohortId: 0,
  eventCohortIds: [],
  maxDepth: 5,
  minCellCount: 5,
  combinationWindow: 1,
  maxPathLength: 5,
};

interface PathwayDesignerProps {
  pathway?: PathwayAnalysis | null;
  isNew?: boolean;
  onSaved?: (p: PathwayAnalysis) => void;
}

export function PathwayDesigner({
  pathway,
  isNew,
  onSaved,
}: PathwayDesignerProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [design, setDesign] = useState<PathwayDesign>(defaultDesign);

  const { data: cohortData, isLoading: loadingCohorts } = useQuery({
    queryKey: ["cohort-definitions", { page: 1, limit: 200 }],
    queryFn: () => getCohortDefinitions({ page: 1, limit: 200 }),
  });

  const createMutation = useCreatePathway();
  const updateMutation = useUpdatePathway();

  const cohorts = cohortData?.items ?? [];

  useEffect(() => {
    if (pathway) {
      setName(pathway.name);
      setDescription(pathway.description ?? "");
      setDesign(pathway.design_json);
    }
  }, [pathway]);

  const toggleEventCohort = (cohortId: number) => {
    setDesign((prev) => ({
      ...prev,
      eventCohortIds: prev.eventCohortIds.includes(cohortId)
        ? prev.eventCohortIds.filter((id) => id !== cohortId)
        : [...prev.eventCohortIds, cohortId],
    }));
  };

  const removeEventCohort = (cohortId: number) => {
    setDesign((prev) => ({
      ...prev,
      eventCohortIds: prev.eventCohortIds.filter((id) => id !== cohortId),
    }));
  };

  const handleSave = () => {
    if (!name.trim()) return;

    if (isNew || !pathway) {
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
          id: pathway.id,
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
              placeholder="Pathway analysis name"
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
          Select the target cohort whose treatment pathways will be analyzed.
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
        {design.targetCohortId > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#2DD4BF]/10 px-2.5 py-1 text-xs text-[#2DD4BF]">
              {cohorts.find((c) => c.id === design.targetCohortId)?.name ??
                `Cohort #${design.targetCohortId}`}
            </span>
          </div>
        )}
      </div>

      {/* Event Cohorts */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Event Cohorts
        </h3>
        <p className="text-xs text-[#8A857D]">
          Select the event cohorts whose sequences will be analyzed within the
          target cohort. These represent treatments, procedures, or conditions
          to track.
        </p>
        {loadingCohorts ? (
          <Loader2 size={16} className="animate-spin text-[#8A857D]" />
        ) : (
          <>
            <select
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val) toggleEventCohort(val);
                e.target.value = "";
              }}
              className={cn(
                "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
                "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
              defaultValue=""
            >
              <option value="">Add an event cohort...</option>
              {cohorts
                .filter((c) => !design.eventCohortIds.includes(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            {design.eventCohortIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {design.eventCohortIds.map((id) => {
                  const cohort = cohorts.find((c) => c.id === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full bg-[#C9A227]/10 px-2.5 py-1 text-xs text-[#C9A227]"
                    >
                      {cohort?.name ?? `Cohort #${id}`}
                      <button
                        type="button"
                        onClick={() => removeEventCohort(id)}
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

      {/* Parameters */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Parameters
        </h3>

        {/* Max Depth */}
        <div>
          <label className="block text-xs font-medium text-[#8A857D] mb-1">
            Max Depth: {design.maxDepth}
          </label>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={design.maxDepth}
            onChange={(e) =>
              setDesign((d) => ({
                ...d,
                maxDepth: Number(e.target.value),
              }))
            }
            className="w-full accent-[#2DD4BF]"
          />
          <div className="flex items-center justify-between text-[10px] text-[#5A5650]">
            <span>1</span>
            <span>10</span>
          </div>
        </div>

        {/* Max Path Length */}
        <div>
          <label className="block text-xs font-medium text-[#8A857D] mb-1">
            Max Path Length: {design.maxPathLength}
          </label>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={design.maxPathLength}
            onChange={(e) =>
              setDesign((d) => ({
                ...d,
                maxPathLength: Number(e.target.value),
              }))
            }
            className="w-full accent-[#2DD4BF]"
          />
          <div className="flex items-center justify-between text-[10px] text-[#5A5650]">
            <span>1</span>
            <span>10</span>
          </div>
        </div>

        {/* Combination Window */}
        <div>
          <label className="block text-xs font-medium text-[#8A857D] mb-1">
            Combination Window (days)
          </label>
          <input
            type="number"
            min={0}
            max={365}
            value={design.combinationWindow}
            onChange={(e) =>
              setDesign((d) => ({
                ...d,
                combinationWindow: Number(e.target.value) || 1,
              }))
            }
            className={cn(
              "w-32 rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
              "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
            )}
          />
          <p className="mt-1 text-[10px] text-[#5A5650]">
            Events within this window are treated as occurring simultaneously.
          </p>
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
