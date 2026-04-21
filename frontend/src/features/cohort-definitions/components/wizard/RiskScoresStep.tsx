import { X } from "lucide-react";
import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { useTranslation } from "react-i18next";

export function RiskScoresStep() {
  const { t } = useTranslation("app");
  const { riskScores, removeRiskScore } = useCohortWizardStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-text-secondary">
          {t("cohortDefinitions.auto.step3Of3RiskScores_9eca4e")}{" "}
          <span className="text-[11px] text-text-ghost">{t("cohortDefinitions.auto.optional_f53d1c")}</span>
        </div>
        <p className="text-[13px] text-text-muted">
          {t("cohortDefinitions.auto.filterByAnyPreComputedClinicalRiskScores_b44e0c")}
        </p>
      </div>

      {riskScores.length > 0 && (
        <div className="flex flex-col gap-2">
          {riskScores.map((rs, i) => (
            <div
              key={rs._key ?? rs.id}
              className="flex items-center justify-between rounded-md border border-border-default bg-surface-base px-3 py-2"
            >
              <span className="text-[13px] text-text-secondary">
                {rs.scoreName} {rs.operator} {rs.value}
                {rs.tier && ` (Tier: ${rs.tier})`}
              </span>
              <button
                type="button"
                onClick={() => removeRiskScore(i)}
                className="text-text-disabled hover:text-critical"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {riskScores.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-default py-6 text-center">
          <span className="text-[13px] text-text-ghost">
            {t("cohortDefinitions.auto.noRiskScoreCriteriaAddedYet_5449d4")}
          </span>
          <span className="text-[12px] text-text-ghost">
            {t("cohortDefinitions.auto.riskScoreCriteriaCanBeAddedViaThe_4db211")}{" "}
            <strong className="text-accent">{t("cohortDefinitions.auto.advancedEditor_cfadc6")}</strong> {t("cohortDefinitions.auto.afterGeneratingTheCohortDefinition_8e10f6")}
          </span>
        </div>
      )}

      <div className="rounded-lg border border-[rgba(201,162,39,0.15)] bg-[rgba(201,162,39,0.05)] px-4 py-3">
        <span className="text-[13px] text-text-muted">
          <strong className="text-accent">{t("cohortDefinitions.auto.note_fc9d3d")}</strong> {t("cohortDefinitions.auto.riskScoreFilteringRequiresPreComputedRiskScores_dd99be")}
        </span>
      </div>
    </div>
  );
}
