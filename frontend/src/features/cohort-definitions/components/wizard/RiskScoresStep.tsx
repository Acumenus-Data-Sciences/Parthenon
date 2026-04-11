import { X } from "lucide-react";
import { useCohortWizardStore } from "../../stores/cohortWizardStore";

export function RiskScoresStep() {
  const { riskScores, removeRiskScore } = useCohortWizardStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-[#ccc]">
          Step 3 of 3 — Risk Scores{" "}
          <span className="text-[11px] text-[#555]">(optional)</span>
        </div>
        <p className="text-[13px] text-[#888]">
          Filter by any pre-computed clinical risk scores?
        </p>
      </div>

      {riskScores.length > 0 && (
        <div className="flex flex-col gap-2">
          {riskScores.map((rs, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-md border border-[#2a2a3a] bg-[#0E0E11] px-3 py-2"
            >
              <span className="text-[13px] text-[#ccc]">
                {rs.scoreName} {rs.operator} {rs.value}
                {rs.tier && ` (Tier: ${rs.tier})`}
              </span>
              <button
                type="button"
                onClick={() => removeRiskScore(i)}
                className="text-[#444] hover:text-[#E85A6B]"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-[rgba(201,162,39,0.15)] bg-[rgba(201,162,39,0.05)] px-4 py-3">
        <span className="text-[13px] text-[#999]">
          <strong className="text-[#C9A227]">Note:</strong> Risk score filtering requires
          pre-computed risk scores from a completed analysis. If no risk score analyses have
          been run, this step can be skipped. You can add risk score criteria later in the
          Advanced Editor.
        </span>
      </div>
    </div>
  );
}
