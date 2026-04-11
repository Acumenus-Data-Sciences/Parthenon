import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Wrench, BarChart3, Loader2, Pencil } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCohortWizardStore } from "../../../stores/cohortWizardStore";
import { useCreateCohortDefinition, useGenerateCohort } from "../../../hooks/useCohortDefinitions";
import { useCohortGeneration } from "../../../hooks/useCohortGeneration";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { CohortSummary } from "../CohortSummary";
import type { Source } from "@/types/models";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReviewGenerateStep({ onClose }: Props) {
  const navigate = useNavigate();
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

  // ── Validation ────────────────────────────────────────────────────────────

  const errors: string[] = [];
  if (!store.name) errors.push("Cohort name is required (Step 1)");
  if (store.entryConcepts.length === 0) errors.push("At least one entry event is required (Step 2)");

  // ── Generate handler ──────────────────────────────────────────────────────

  const handleGenerate = () => {
    if (!sourceId || createMutation.isPending || generateMutation.isPending || createdId) return;

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
  const showWhatsNext = generationStatus === "completed";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Summary section */}
      <div>
        <div className="mb-2 text-[13px] font-medium text-[#8A857D]">Cohort Summary</div>
        <CohortSummary />
      </div>

      {/* Edit shortcuts */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => store.setStep(1)}
          className="inline-flex items-center gap-1 rounded border border-[#2A2A30] px-2.5 py-1 text-[11px] text-[#8A857D] hover:border-[#3A3A42] hover:text-[#C5C0B8]"
        >
          <Pencil size={10} />
          Edit Population
        </button>
        <button
          type="button"
          onClick={() => store.setStep(2)}
          className="inline-flex items-center gap-1 rounded border border-[#2A2A30] px-2.5 py-1 text-[11px] text-[#8A857D] hover:border-[#3A3A42] hover:text-[#C5C0B8]"
        >
          <Pencil size={10} />
          Edit Criteria
        </button>
        <button
          type="button"
          onClick={() => store.setStep(3)}
          className="inline-flex items-center gap-1 rounded border border-[#2A2A30] px-2.5 py-1 text-[11px] text-[#8A857D] hover:border-[#3A3A42] hover:text-[#C5C0B8]"
        >
          <Pencil size={10} />
          Edit Follow-up
        </button>
      </div>

      {/* Validation errors */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-[rgba(155,27,48,0.3)] bg-[rgba(155,27,48,0.05)] px-4 py-3">
          <div className="mb-1 text-[12px] font-medium text-[#E85A6B]">
            Cannot generate &mdash; fix these issues:
          </div>
          <ul className="list-inside list-disc text-[12px] text-[#E85A6B]">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Generate section */}
      <div className="border-t border-[#2A2A30] pt-5">
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-[#8A857D]">Run against:</span>
          <select
            value={sourceId ?? ""}
            onChange={(e) => setSourceId(e.target.value ? parseInt(e.target.value, 10) : null)}
            className="rounded-md border border-[#323238] bg-[#1C1C20] px-3 py-1.5 text-[13px] text-[#C5C0B8] outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/15"
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
      </div>

      {/* Success result */}
      {generationStatus === "completed" && (
        <div className="rounded-lg border border-[rgba(45,212,191,0.15)] bg-[rgba(45,212,191,0.05)] p-4">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-[28px] font-bold text-[#2DD4BF]">
                {generation?.person_count?.toLocaleString() ?? 0}
              </div>
              <div className="text-[11px] text-[#8A857D]">patients</div>
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

      {/* What's Next section */}
      {showWhatsNext && (
        <div className="border-t border-[#2A2A30] pt-5">
          <div className="mb-3 text-[13px] font-medium text-[#C9A227]">What&apos;s Next?</div>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => onClose()}
              className="rounded-lg border border-[rgba(45,212,191,0.2)] bg-[rgba(45,212,191,0.05)] p-4 text-left transition-colors hover:border-[rgba(45,212,191,0.4)]"
            >
              <div className="flex items-center gap-2 text-[13px] font-medium text-[#2DD4BF]">
                <Check size={16} />
                Done &mdash; Save &amp; Close
              </div>
              <p className="mt-1 ml-[24px] text-[12px] text-[#8A857D]">
                Cohort is saved and ready for use in analyses and studies.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(createdId ? `/cohort-definitions/${createdId}` : "/cohort-definitions");
              }}
              className="rounded-lg border border-[rgba(201,162,39,0.2)] bg-[rgba(201,162,39,0.05)] p-4 text-left transition-colors hover:border-[rgba(201,162,39,0.4)]"
            >
              <div className="flex items-center gap-2 text-[13px] font-medium text-[#C9A227]">
                <Wrench size={16} />
                Open in Advanced Editor
              </div>
              <p className="mt-1 ml-[24px] text-[12px] text-[#8A857D]">
                Fine-tune with the full expression editor. Supports nested boolean logic, custom
                temporal windows, and all advanced features.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(createdId ? `/cohort-definitions/${createdId}` : "/cohort-definitions");
              }}
              className="rounded-lg border border-[#2A2A30] bg-[#1C1C20] p-4 text-left transition-colors hover:border-[#3A3A42]"
            >
              <div className="flex items-center gap-2 text-[13px] font-medium text-[#C5C0B8]">
                <BarChart3 size={16} />
                View Diagnostics
              </div>
              <p className="mt-1 ml-[24px] text-[12px] text-[#8A857D]">
                See attrition chart, patient breakdown by age/gender, and detailed generation
                statistics.
              </p>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
