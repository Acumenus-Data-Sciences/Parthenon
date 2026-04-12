import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { useCreateCohortDefinition, useGenerateCohort } from "../../hooks/useCohortDefinitions";
import { useCohortGeneration } from "../../hooks/useCohortGeneration";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import type { Source } from "@/types/models";

export function GenerateStep() {
  const store = useCohortWizardStore();
  const createdId = useCohortWizardStore((s) => s.createdId);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [genId, setGenId] = useState<number | null>(null);

  const { data: sources, isLoading: loadingSources } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const createMutation = useCreateCohortDefinition();
  const generateMutation = useGenerateCohort();
  const { data: generation } = useCohortGeneration(createdId, genId);

  const handleGenerate = () => {
    if (!sourceId) return;

    let expression;
    try {
      expression = store.buildExpression();
    } catch (err) {
      console.error("Failed to build expression:", err);
      return;
    }

    createMutation.mutate(
      {
        name: store.name,
        description: store.description,
        expression_json: expression,
      },
      {
        onSuccess: (def) => {
          store.setCreatedId(def.id);
          generateMutation.mutate(
            { defId: def.id, sourceId },
            {
              onSuccess: (gen) => setGenId(gen.id),
            },
          );
        },
      },
    );
  };

  const generationStatus = generation?.status;
  const isRunning =
    createMutation.isPending ||
    generateMutation.isPending ||
    generationStatus === "running" ||
    generationStatus === "queued" ||
    generationStatus === "pending";

  const isDisabled = !sourceId || isRunning || !store.name || store.entryConcepts.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-[#ccc]">Step 2 of 3 — Generate Cohort</div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[13px] text-[#888]">Run against:</span>
        <select
          value={sourceId ?? ""}
          onChange={(e) => setSourceId(e.target.value ? parseInt(e.target.value, 10) : null)}
          className="rounded-md border border-[#444] bg-[#1a1a2e] px-3 py-1.5 text-[13px] text-[#ccc] outline-none focus:border-[#C9A227]"
          disabled={loadingSources}
        >
          <option value="">Select data source...</option>
          {(sources ?? []).map((s: Source) => (
            <option key={s.id} value={s.id}>
              {s.source_name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isDisabled}
          className="flex items-center gap-1.5 rounded-md bg-[#C9A227] px-4 py-1.5 text-[13px] font-semibold text-[#0E0E11] transition-colors hover:bg-[#B8922A] disabled:opacity-50"
        >
          {isRunning && <Loader2 size={14} className="animate-spin" />}
          Generate
        </button>
      </div>

      {/* Success result */}
      {generationStatus === "completed" && (
        <div className="rounded-lg border border-[rgba(45,212,191,0.15)] bg-[rgba(45,212,191,0.05)] p-4">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-[28px] font-bold text-[#2DD4BF]">
                {generation?.person_count?.toLocaleString() ?? 0}
              </div>
              <div className="text-[11px] text-[#888]">patients</div>
            </div>
          </div>
        </div>
      )}

      {/* Error result */}
      {generationStatus === "failed" && (
        <div className="rounded-lg border border-[rgba(155,27,48,0.3)] bg-[rgba(155,27,48,0.05)] px-4 py-3 text-[13px] text-[#E85A6B]">
          Generation failed. Check the expression and try again.
        </div>
      )}
    </div>
  );
}
