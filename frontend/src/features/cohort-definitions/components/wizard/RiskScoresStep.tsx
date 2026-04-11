import { X } from "lucide-react";
import { useCohortWizardStore } from "../../stores/cohortWizardStore";

export function RiskScoresStep() {
  const { riskScores, removeRiskScore } = useCohortWizardStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-[#C5C0B8]">
          Risk Scores{" "}
          <span className="text-[11px] text-[#5A5650]">(optional)</span>
        </div>
        <p className="text-[13px] text-[#8A857D]">
          Filter by any pre-computed clinical risk scores?
        </p>
      </div>

      {riskScores.length > 0 && (
        <div className="flex flex-col gap-2">
          {riskScores.map((rs, i) => (
            <div
              key={rs._key ?? rs.id}
              className="flex items-center justify-between rounded-md border border-[#2A2A30] bg-[#0E0E11] px-3 py-2"
            >
              <span className="text-[13px] text-[#C5C0B8]">
                {rs.scoreName} {rs.operator} {rs.value}
                {rs.tier && ` (Tier: ${rs.tier})`}
              </span>
              <button
                type="button"
                onClick={() => removeRiskScore(i)}
                className="text-[#323238] hover:text-[#E85A6B]"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {riskScores.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[#2A2A30] py-6 text-center">
          <span className="text-[13px] text-[#5A5650]">
            No risk score criteria added yet.
          </span>
          <span className="text-[12px] text-[#5A5650]">
            Risk score criteria can be added via the{" "}
            <strong className="text-[#C9A227]">Advanced Editor</strong> after generating
            the cohort definition.
          </span>
        </div>
      )}

      <div className="rounded-lg border border-[rgba(201,162,39,0.15)] bg-[rgba(201,162,39,0.05)] px-4 py-3">
        <span className="text-[13px] text-[#8A857D]">
          <strong className="text-[#C9A227]">Note:</strong> Risk score filtering requires
          pre-computed risk scores from a completed analysis. If no risk score analyses have
          been run, this step can be skipped. You can add risk score criteria later in the
          Advanced Editor.
        </span>
      </div>
    </div>
  );
}
