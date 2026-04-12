import { useState } from "react";
import { Activity, X, Plus } from "lucide-react";
import { useCohortExpressionStore } from "../stores/cohortExpressionStore";
import { RiskScoreCriterionEditor } from "./RiskScoreCriterionEditor";

export function RiskScoreCriteriaSection() {
  const { expression, addRiskScoreCriterion, removeRiskScoreCriterion } =
    useCohortExpressionStore();
  const [showAdd, setShowAdd] = useState(false);

  const criteria = expression.RiskScoreCriteria ?? [];
  const nextId = criteria.length > 0 ? Math.max(...criteria.map((c) => c.id)) + 1 : 0;

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#5A5650]">
        Filter cohort by pre-computed risk score values or tiers from Risk Score
        Analyses.
      </p>

      {criteria.map((criterion, i) => (
        <div
          key={criterion.id}
          className="flex items-center justify-between rounded-lg border border-[#9B1B30]/30 bg-[#9B1B30]/10 px-3 py-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Activity size={12} className="text-[#E85A6B] shrink-0" />
            <span className="text-xs text-[#F0EDE8] truncate">
              {criterion.label}
            </span>
            <span className="text-[10px] text-[#8A857D] shrink-0">
              {criterion.scoreName}
            </span>
            {criterion.exclude && (
              <span className="text-[10px] text-red-400 shrink-0">
                EXCLUDE
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => removeRiskScoreCriterion(i)}
            className="text-gray-600 hover:text-red-400 shrink-0"
          >
            <X size={12} />
          </button>
        </div>
      ))}

      {showAdd ? (
        <RiskScoreCriterionEditor
          nextId={nextId}
          onAdd={(criterion) => {
            addRiskScoreCriterion(criterion);
            setShowAdd(false);
          }}
          onCancel={() => setShowAdd(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-lg border border-dashed border-[#9B1B30]/40 px-3 py-2 text-xs text-[#E85A6B] hover:border-[#9B1B30] hover:text-[#E85A6B]/80 transition-colors"
        >
          <Plus size={12} />
          Add Risk Score Criterion
        </button>
      )}
    </div>
  );
}
