import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("app");
  return (
    <div className="space-y-4">
      <CohortCentroidRadar profile={profile} />

      {/* Action bar */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          className="flex items-center gap-2 rounded-lg bg-success/10 px-4 py-2 text-sm font-medium text-success transition-colors hover:bg-success/20"
        >
          {t("patientSimilarity.workspace.viewSimilarPatients")}
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
