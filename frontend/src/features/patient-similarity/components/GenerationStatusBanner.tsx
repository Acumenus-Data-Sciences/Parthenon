import { useEffect, useRef } from "react";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useGenerateCohort } from "@/features/cohort-definitions/hooks/useCohortDefinitions";
import type { CohortProfileResult } from "../types/patientSimilarity";

interface GenerationStatusBannerProps {
  profile: CohortProfileResult | undefined;
  isLoading: boolean;
  cohortDefinitionId: number;
  sourceId: number;
}

export function GenerationStatusBanner({
  profile,
  isLoading,
  cohortDefinitionId,
  sourceId,
}: GenerationStatusBannerProps) {
  const generateMutation = useGenerateCohort();
  const queryClient = useQueryClient();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll cohort-profile after generation is queued until it becomes generated
  const isGenerated = profile?.generated === true;
  useEffect(() => {
    if (generateMutation.isSuccess && !isGenerated) {
      pollRef.current = setInterval(() => {
        queryClient.invalidateQueries({
          queryKey: ["patient-similarity", "cohort-profile", cohortDefinitionId, sourceId],
        });
      }, 5000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [generateMutation.isSuccess, isGenerated, cohortDefinitionId, sourceId, queryClient]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] py-1.5">
        <Loader2 size={12} className="animate-spin" />
        Checking generation status...
      </div>
    );
  }

  if (!profile) return null;

  const isGenerating = generateMutation.isPending || (generateMutation.isSuccess && !profile.generated);

  if (isGenerating) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 px-3 py-2 mt-1.5">
        <Loader2 size={14} className="animate-spin text-[var(--color-primary)]" />
        <span className="text-xs text-[var(--color-primary)]">
          {generateMutation.isPending ? "Queueing generation..." : "Generating cohort..."}
        </span>
      </div>
    );
  }

  if (!profile.generated) {
    return (
      <div className="rounded-lg bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 px-3 py-2 mt-1.5">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-[var(--color-primary)] shrink-0" />
          <span className="text-xs text-[var(--color-primary)]">
            Not generated for this source
          </span>
        </div>
        <button
          type="button"
          onClick={() =>
            generateMutation.mutate({ defId: cohortDefinitionId, sourceId })
          }
          className={cn(
            "mt-2 w-full rounded px-3 py-1.5 text-xs font-medium transition-colors",
            "bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/30",
          )}
        >
          Generate Now
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-1.5">
      <CheckCircle2 size={12} className="text-[var(--color-primary)]" />
      <span className="text-xs text-[var(--color-text-secondary)]">
        <span className="font-medium text-[var(--color-text-primary)]">
          {profile.member_count}
        </span>{" "}
        members
      </span>
    </div>
  );
}
