import {
  X,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  Play,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RiskScoreModel, ScoreEligibility } from "../types/riskScore";
import { TIER_COLORS } from "../types/riskScore";
import {
  getRiskScoreCategoryLabel,
  getRiskScoreTierLabel,
} from "../lib/i18n";

interface ScoreDetailModalProps {
  score: RiskScoreModel;
  color: string;
  eligibility: ScoreEligibility | undefined;
  sourceSelected: boolean;
  onClose: () => void;
  onCreateAnalysis: (scoreId: string) => void;
  onRunSingle: (scoreId: string) => void;
}

export function ScoreDetailModal({
  score,
  color,
  eligibility,
  sourceSelected,
  onClose,
  onCreateAnalysis,
  onRunSingle,
}: ScoreDetailModalProps) {
  const { t } = useTranslation("app");
  const isEligible = eligibility?.eligible === true;
  const patientCount = eligibility?.patient_count ?? 0;
  const missingComponents = eligibility?.missing ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border-default bg-surface-base shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border-default px-6 pb-4 pt-6">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2.5">
              <Activity size={18} style={{ color }} />
              <span
                className="rounded px-2 py-0.5 font-['IBM_Plex_Mono',monospace] text-xs"
                style={{ backgroundColor: `${color}15`, color }}
              >
                {score.score_id}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                style={{ backgroundColor: `${color}10`, color }}
              >
                {getRiskScoreCategoryLabel(t, score.category)}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-text-primary">
              {score.score_name}
            </h2>
            <p className="mt-1 text-sm text-text-muted">{score.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-1 shrink-0 text-text-ghost transition-colors hover:text-text-secondary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {!sourceSelected ? (
            <div className="rounded-lg border border-accent/20 bg-accent/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-accent" />
                <p className="text-sm text-accent">
                  {t("riskScores.scoreDetail.selectSourcePrompt")}
                </p>
              </div>
            </div>
          ) : eligibility && isEligible ? (
            <div className="rounded-lg border border-success/30 bg-success/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-success" />
                <p className="text-sm font-medium text-success">
                  {t("riskScores.scoreDetail.eligiblePatients", {
                    count: patientCount.toLocaleString(),
                  })}
                </p>
              </div>
            </div>
          ) : eligibility && !isEligible ? (
            <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <XCircle size={16} className="text-accent" />
                <p className="text-sm font-medium text-accent">
                  {t("riskScores.scoreDetail.insufficientData")}
                </p>
              </div>
              {missingComponents.length > 0 && (
                <div className="mt-2 ml-6">
                  <p className="mb-1 text-xs text-accent/80">
                    {t("riskScores.scoreDetail.missing")}
                  </p>
                  <ul className="space-y-0.5 text-xs text-accent/70">
                    {missingComponents.map((missing) => (
                      <li key={missing}>- {missing}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-info/20 bg-info/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-info" />
                <p className="text-sm text-info">
                  {t("riskScores.scoreDetail.checkingEligibility")}
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-text-ghost">
              {t("riskScores.scoreDetail.eligiblePopulation")}
            </p>
            <p className="text-sm text-text-secondary">
              {score.eligible_population}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {score.required_components.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-wider text-text-ghost">
                  {t("riskScores.scoreDetail.requiredComponents")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {score.required_components.map((component) => (
                    <span
                      key={component}
                      className="inline-block rounded border border-border-default bg-surface-overlay px-2 py-1 font-['IBM_Plex_Mono',monospace] text-[10px] text-text-secondary"
                    >
                      {component}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {score.required_tables.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-wider text-text-ghost">
                  {t("riskScores.scoreDetail.cdmTablesUsed")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {score.required_tables.map((tableName) => (
                    <span
                      key={tableName}
                      className="inline-block rounded bg-surface-overlay px-2 py-1 font-['IBM_Plex_Mono',monospace] text-[10px] text-text-ghost"
                    >
                      {tableName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {Object.keys(score.risk_tiers).length > 0 && (
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-wider text-text-ghost">
                {t("riskScores.scoreDetail.riskTierDefinitions")}
              </p>
              <div className="overflow-hidden rounded-lg border border-border-default">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface-overlay">
                      <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-text-ghost">
                        {t("riskScores.common.headers.tier")}
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-text-ghost">
                        {t("riskScores.scoreDetail.scoreRange")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(score.risk_tiers).map(([tier, bounds]) => {
                      const tierColor = TIER_COLORS[tier] ?? "var(--text-muted)";
                      return (
                        <tr key={tier} className="border-t border-border-default">
                          <td className="px-3 py-2">
                            <span
                              className="inline-flex items-center gap-1.5 text-xs font-medium"
                              style={{ color: tierColor }}
                            >
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: tierColor }}
                              />
                              {getRiskScoreTierLabel(t, tier)}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-['IBM_Plex_Mono',monospace] text-text-secondary">
                            {bounds[0] ?? "-inf"} - {bounds[1] ?? "inf"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border-default px-6 py-4">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
            {t("riskScores.common.actions.close")}
          </button>
          <div className="flex items-center gap-2">
            {sourceSelected && eligibility && isEligible && (
              <>
                <button
                  type="button"
                  onClick={() => onRunSingle(score.score_id)}
                  className="btn btn-ghost btn-sm flex items-center gap-1.5"
                >
                  <Play size={12} />
                  {t("riskScores.common.actions.quickRun")}
                </button>
                <button
                  type="button"
                  onClick={() => onCreateAnalysis(score.score_id)}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-light"
                >
                  <Plus size={12} />
                  {t("riskScores.common.actions.createAnalysis")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
