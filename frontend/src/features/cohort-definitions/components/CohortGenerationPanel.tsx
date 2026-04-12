import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Play,
  CheckCircle2,
  XCircle,
  Users,
  Database,
  ChevronDown,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { useGenerateCohort } from "../hooks/useCohortDefinitions";
import { useCohortGeneration } from "../hooks/useCohortGeneration";

interface CohortGenerationPanelProps {
  definitionId: number | null;
}

export function CohortGenerationPanel({
  definitionId,
}: CohortGenerationPanelProps) {
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [activeGenId, setActiveGenId] = useState<number | null>(null);

  const { data: sources, isLoading: loadingSources } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const generateMutation = useGenerateCohort();

  const { data: activeGen } = useCohortGeneration(
    definitionId,
    activeGenId,
  );

  // Clear active generation when it reaches a terminal state
  useEffect(() => {
    if (
      activeGen &&
      ["completed", "failed", "cancelled"].includes(activeGen.status)
    ) {
      // Keep it visible for a moment so the user sees the result
      const timer = setTimeout(() => setActiveGenId(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [activeGen?.status]);

  const handleGenerate = () => {
    if (!definitionId || !sourceId) return;
    generateMutation.mutate(
      { defId: definitionId, sourceId },
      {
        onSuccess: (gen) => {
          setActiveGenId(gen.id);
        },
      },
    );
  };

  const isRunning =
    activeGen?.status === "running" ||
    activeGen?.status === "queued" ||
    activeGen?.status === "pending";

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1C1C20]">
        <div className="flex items-center gap-2">
          <Play size={14} className="text-[#2DD4BF]" />
          <h4 className="text-sm font-semibold text-[#F0EDE8]">
            Generate Cohort
          </h4>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Source + Generate */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Database
              size={12}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
            />
            <select
              value={sourceId ?? ""}
              onChange={(e) => setSourceId(Number(e.target.value) || null)}
              disabled={loadingSources}
              className={cn(
                "w-full appearance-none rounded-lg border border-[#232328] bg-[#0E0E11] pl-8 pr-8 py-2 text-sm",
                "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
                "cursor-pointer",
              )}
            >
              <option value="">Select a data source</option>
              {sources?.map((src) => (
                <option key={src.id} value={src.id}>
                  {src.source_name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
            />
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={
              !sourceId ||
              !definitionId ||
              generateMutation.isPending ||
              isRunning
            }
            className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors disabled:opacity-50 shrink-0"
          >
            {generateMutation.isPending || isRunning ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            Generate
          </button>
        </div>

        {/* Active generation status */}
        {activeGen && (
          <div
            className={cn(
              "rounded-lg border px-4 py-3",
              activeGen.status === "completed"
                ? "border-[#2DD4BF]/20 bg-[#2DD4BF]/5"
                : activeGen.status === "failed"
                  ? "border-[#E85A6B]/20 bg-[#E85A6B]/5"
                  : "border-[#C9A227]/20 bg-[#C9A227]/5",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {activeGen.status === "completed" ? (
                  <CheckCircle2 size={16} className="text-[#2DD4BF]" />
                ) : activeGen.status === "failed" ? (
                  <XCircle size={16} className="text-[#E85A6B]" />
                ) : (
                  <Clock size={16} className="text-[#C9A227]" />
                )}
                <span
                  className={cn(
                    "text-sm font-medium",
                    activeGen.status === "completed"
                      ? "text-[#2DD4BF]"
                      : activeGen.status === "failed"
                        ? "text-[#E85A6B]"
                        : "text-[#C9A227]",
                  )}
                >
                  {activeGen.status === "completed"
                    ? "Generation complete"
                    : activeGen.status === "failed"
                      ? "Generation failed"
                      : "Generating cohort..."}
                </span>
              </div>

              {activeGen.person_count !== null && (
                <span className="inline-flex items-center gap-1.5 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-[#2DD4BF]">
                  <Users size={16} />
                  {activeGen.person_count.toLocaleString()}
                  <span className="text-xs font-normal text-[#8A857D] ml-1">
                    persons
                  </span>
                </span>
              )}
            </div>

            {activeGen.fail_message && (
              <p className="mt-2 text-xs text-[#E85A6B]">
                {activeGen.fail_message}
              </p>
            )}

            {isRunning && (
              <div className="mt-2 h-1 rounded-full bg-[#232328] overflow-hidden">
                <div className="h-full w-1/3 rounded-full bg-[#C9A227] animate-pulse" />
              </div>
            )}
          </div>
        )}

        {/* Error from mutation */}
        {generateMutation.error && !activeGen && (
          <div className="rounded-lg border border-[#E85A6B]/20 bg-[#E85A6B]/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <XCircle size={14} className="text-[#E85A6B]" />
              <span className="text-xs text-[#E85A6B]">
                Failed to start generation. Please try again.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
