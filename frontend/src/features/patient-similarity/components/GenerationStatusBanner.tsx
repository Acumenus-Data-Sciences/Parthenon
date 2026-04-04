import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
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

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-[#5A5650] py-1.5">
        <Loader2 size={12} className="animate-spin" />
        Checking generation status...
      </div>
    );
  }

  if (!profile) return null;

  if (generateMutation.isPending) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-[#2DD4BF]/5 border border-[#2DD4BF]/20 px-3 py-2 mt-1.5">
        <Loader2 size={14} className="animate-spin text-[#2DD4BF]" />
        <span className="text-xs text-[#2DD4BF]">Generating cohort...</span>
      </div>
    );
  }

  if (!profile.generated) {
    return (
      <div className="rounded-lg bg-[#C9A227]/5 border border-[#C9A227]/20 px-3 py-2 mt-1.5">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-[#C9A227] shrink-0" />
          <span className="text-xs text-[#C9A227]">
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
            "bg-[#C9A227]/10 text-[#C9A227] hover:bg-[#C9A227]/20 border border-[#C9A227]/30",
          )}
        >
          Generate Now
        </button>
        {generateMutation.isSuccess && (
          <p className="mt-1.5 text-[10px] text-[#2DD4BF]">
            Generation queued. This may take a moment.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-1.5">
      <CheckCircle2 size={12} className="text-[#2DD4BF]" />
      <span className="text-xs text-[#8A857D]">
        <span className="font-medium text-[#C5C0B8]">
          {profile.member_count}
        </span>{" "}
        members
      </span>
    </div>
  );
}
