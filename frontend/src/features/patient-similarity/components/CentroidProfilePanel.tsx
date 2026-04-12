import { ArrowRight } from "lucide-react";
import { CohortCentroidRadar } from "./CohortCentroidRadar";
import type { CohortProfileResult } from "../types/patientSimilarity";

interface CentroidProfilePanelProps {
  profile: CohortProfileResult;
  onContinue: () => void;
}

export function CentroidProfilePanel({
  profile,
  onContinue,
}: CentroidProfilePanelProps) {
  return (
    <div className="space-y-4">
      <CohortCentroidRadar profile={profile} />

      {/* Action bar */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          className="flex items-center gap-2 rounded-lg bg-[#2DD4BF]/10 px-4 py-2 text-sm font-medium text-[#2DD4BF] transition-colors hover:bg-[#2DD4BF]/20"
        >
          View Similar Patients
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
