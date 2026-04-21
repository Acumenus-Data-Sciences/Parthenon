import { useState } from "react";
import { Activity, X, Plus } from "lucide-react";
import { useCohortExpressionStore } from "../stores/cohortExpressionStore";
import { RiskScoreCriterionEditor } from "./RiskScoreCriterionEditor";
import { useTranslation } from "react-i18next";

export function RiskScoreCriteriaSection() {
  const { t } = useTranslation("app");
  const { expression, addRiskScoreCriterion, removeRiskScoreCriterion } =
    useCohortExpressionStore();
  const [showAdd, setShowAdd] = useState(false);

  const criteria = expression.RiskScoreCriteria ?? [];
  const nextId = criteria.length > 0 ? Math.max(...criteria.map((c) => c.id)) + 1 : 0;

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-ghost">
        {t("cohortDefinitions.auto.filterCohortByPreComputedRiskScoreValues_9f3c51")}
      </p>

      {criteria.map((criterion, i) => (
        <div
          key={criterion.id}
          className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-3 py-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Activity size={12} className="text-critical shrink-0" />
            <span className="text-xs text-text-primary truncate">
              {criterion.label}
            </span>
            <span className="text-[10px] text-text-muted shrink-0">
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
            className="text-text-ghost hover:text-red-400 shrink-0"
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
          className="flex items-center gap-2 rounded-lg border border-dashed border-primary/40 px-3 py-2 text-xs text-critical hover:border-primary hover:text-critical/80 transition-colors"
        >
          <Plus size={12} />
          {t("cohortDefinitions.auto.addRiskScoreCriterion_fe4a6c")}
        </button>
      )}
    </div>
  );
}
