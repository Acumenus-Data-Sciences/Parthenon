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
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-overlay">
        <div className="flex items-center gap-2">
          <Play size={14} className="text-success" />
          <h4 className="text-sm font-semibold text-text-primary">
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
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost"
            />
            <select
              value={sourceId ?? ""}
              onChange={(e) => setSourceId(Number(e.target.value) || null)}
              disabled={loadingSources}
              className={cn(
                "w-full appearance-none rounded-lg border border-border-default bg-surface-base pl-8 pr-8 py-2 text-sm",
                "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
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
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-ghost"
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
            className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base hover:bg-success transition-colors disabled:opacity-50 shrink-0"
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
                ? "border-success/20 bg-success/5"
                : activeGen.status === "failed"
                  ? "border-critical/20 bg-critical/5"
                  : "border-accent/20 bg-accent/5",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {activeGen.status === "completed" ? (
                  <CheckCircle2 size={16} className="text-success" />
                ) : activeGen.status === "failed" ? (
                  <XCircle size={16} className="text-critical" />
                ) : (
                  <Clock size={16} className="text-accent" />
                )}
                <span
                  className={cn(
                    "text-sm font-medium",
                    activeGen.status === "completed"
                      ? "text-success"
                      : activeGen.status === "failed"
                        ? "text-critical"
                        : "text-accent",
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
                <span className="inline-flex items-center gap-1.5 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-success">
                  <Users size={16} />
                  {activeGen.person_count.toLocaleString()}
                  <span className="text-xs font-normal text-text-muted ml-1">
                    persons
                  </span>
                </span>
              )}
            </div>

            {activeGen.fail_message && (
              <p className="mt-2 text-xs text-critical">
                {activeGen.fail_message}
              </p>
            )}

            {isRunning && (
              <div className="mt-2 h-1 rounded-full bg-surface-elevated overflow-hidden">
                <div className="h-full w-1/3 rounded-full bg-accent animate-pulse" />
              </div>
            )}
          </div>
        )}

        {/* Error from mutation */}
        {generateMutation.error && !activeGen && (
          <div className="rounded-lg border border-critical/20 bg-critical/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <XCircle size={14} className="text-critical" />
              <span className="text-xs text-critical">
                Failed to start generation. Please try again.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
