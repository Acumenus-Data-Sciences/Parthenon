import { useState } from "react";
import { Activity, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSourceStore } from "@/stores/sourceStore";
import {
  useAllRiskScoreAnalyses,
  useRiskScoreCatalogue,
} from "@/features/risk-scores/hooks/useRiskScores";
import type { RiskScoreCriterion } from "../types/cohortExpression";
import { useTranslation } from "react-i18next";

const OPERATORS = [
  { value: "gte", label: "\u2265", sqlLabel: "greater than or equal to" },
  { value: "gt", label: ">", sqlLabel: "greater than" },
  { value: "lte", label: "\u2264", sqlLabel: "less than or equal to" },
  { value: "lt", label: "<", sqlLabel: "less than" },
  { value: "eq", label: "=", sqlLabel: "equal to" },
] as const;

interface RiskScoreCriterionEditorProps {
  onAdd: (criterion: RiskScoreCriterion) => void;
  onCancel: () => void;
  nextId: number;
}

export function RiskScoreCriterionEditor({
  onAdd,
  onCancel,
  nextId,
}: RiskScoreCriterionEditorProps) {
  const { t } = useTranslation("app");
  const { activeSourceId, defaultSourceId } = useSourceStore();
  const sourceId = activeSourceId ?? defaultSourceId ?? 0;
  const tiers = [
    { value: "low", label: t("cohortDefinitions.auto.low_28d0ed") },
    {
      value: "intermediate",
      label: t("cohortDefinitions.auto.intermediate_b57ed7"),
    },
    { value: "high", label: t("cohortDefinitions.auto.high_655d20") },
    {
      value: "very_high",
      label: t("cohortDefinitions.auto.veryHigh_9055b2"),
    },
  ] as const;

  const { data: allAnalyses, isLoading: loadingAnalyses } =
    useAllRiskScoreAnalyses();
  const { data: catalogue } = useRiskScoreCatalogue();

  const [selectedAnalysisId, setSelectedAnalysisId] = useState<number | null>(
    null,
  );
  const [selectedScoreId, setSelectedScoreId] = useState<string>("");
  const [filterMode, setFilterMode] = useState<"value" | "tier">("value");
  const [operator, setOperator] = useState<string>("gte");
  const [value, setValue] = useState<string>("");
  const [tier, setTier] = useState<string>("");
  const [exclude, setExclude] = useState(false);

  const selectedAnalysis = allAnalyses?.data?.find(
    (a: { id: number }) => a.id === selectedAnalysisId,
  );
  const scoreIds: string[] = selectedAnalysis?.design_json?.scoreIds ?? [];
  const scoreNameMap: Record<string, string> = {};
  for (const s of catalogue?.scores ?? []) {
    scoreNameMap[s.score_id] = s.score_name;
  }

  const scoreName = scoreNameMap[selectedScoreId] ?? selectedScoreId;

  const canAdd =
    selectedAnalysisId !== null &&
    selectedScoreId !== "" &&
    ((filterMode === "value" && value.trim() !== "") ||
      (filterMode === "tier" && tier !== ""));

  const handleAdd = () => {
    if (!canAdd || selectedAnalysisId === null) return;

    const label =
      filterMode === "value"
        ? `${scoreName} ${OPERATORS.find((o) => o.value === operator)?.label ?? operator} ${value}`
        : `${scoreName} \u2014 ${tiers.find((item) => item.value === tier)?.label ?? tier} Risk`;

    onAdd({
      id: nextId,
      label: exclude ? `NOT: ${label}` : label,
      analysisId: selectedAnalysisId,
      scoreId: selectedScoreId,
      scoreName,
      operator: filterMode === "value" ? (operator as RiskScoreCriterion["operator"]) : null,
      value: filterMode === "value" ? parseFloat(value) : null,
      tier: filterMode === "tier" ? tier : null,
      exclude,
    });
  };

  // sourceId is available for future source-scoped queries
  void sourceId;

  return (
    <div className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-critical">
        <Activity size={14} />
        {t("cohortDefinitions.auto.addRiskScoreCriterion_fe4a6c")}
      </div>

      {/* Analysis selector */}
      <div>
        <label className="block text-[10px] text-text-ghost uppercase tracking-wider mb-1">
          {t("cohortDefinitions.auto.riskScoreAnalysis_3f6d3e")}
        </label>
        {loadingAnalyses ? (
          <Loader2 size={14} className="animate-spin text-text-muted" />
        ) : (
          <select
            value={selectedAnalysisId ?? ""}
            onChange={(e) => {
              setSelectedAnalysisId(
                e.target.value ? Number(e.target.value) : null,
              );
              setSelectedScoreId("");
            }}
            className="form-input w-full text-sm"
          >
            <option value="">{t("cohortDefinitions.auto.selectAnalysis_56184d")}</option>
            {(allAnalyses?.data ?? []).map((a: { id: number; name: string; design_json: { scoreIds: string[] } }) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.design_json.scoreIds.length} {t("cohortDefinitions.auto.scores_3cf320")}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Score selector */}
      {selectedAnalysisId && scoreIds.length > 0 && (
        <div>
          <label className="block text-[10px] text-text-ghost uppercase tracking-wider mb-1">
            {t("cohortDefinitions.auto.score_5dd135")}
          </label>
          <select
            value={selectedScoreId}
            onChange={(e) => setSelectedScoreId(e.target.value)}
            className="form-input w-full text-sm"
          >
            <option value="">{t("cohortDefinitions.auto.selectScore_4e2f60")}</option>
            {scoreIds.map((id) => (
              <option key={id} value={id}>
                {scoreNameMap[id] ?? id}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Filter mode */}
      {selectedScoreId && (
        <>
          <div>
            <label className="block text-[10px] text-text-ghost uppercase tracking-wider mb-1">
              {t("cohortDefinitions.auto.filterBy_5015f5")}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterMode("value")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                  filterMode === "value"
                    ? "bg-primary/20 border-primary/40 text-critical"
                    : "border-border-default text-text-muted hover:text-text-secondary",
                )}
              >
                {t("cohortDefinitions.auto.scoreValue_990b82")}
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("tier")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                  filterMode === "tier"
                    ? "bg-primary/20 border-primary/40 text-critical"
                    : "border-border-default text-text-muted hover:text-text-secondary",
                )}
              >
                {t("cohortDefinitions.auto.riskTier_1496ae")}
              </button>
            </div>
          </div>

          {filterMode === "value" ? (
            <div className="flex items-center gap-2">
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="form-input text-sm w-20"
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={t("cohortDefinitions.auto.threshold_2a63f5")}
                className="form-input text-sm flex-1"
                step="0.1"
              />
            </div>
          ) : (
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="form-input w-full text-sm"
            >
              <option value="">{t("cohortDefinitions.auto.selectTier_a0e7b2")}</option>
              {tiers.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          )}

          {/* Exclude toggle */}
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={exclude}
              onChange={(e) => setExclude(e.target.checked)}
              className="rounded border-surface-highlight"
            />
            {t("cohortDefinitions.auto.excludePatientsMatchingThisCriterion_91d32f")}
          </label>
        </>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-border-default">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-light disabled:opacity-40 transition-colors"
        >
          <CheckCircle2 size={12} />
          {t("cohortDefinitions.auto.add_ec211f")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-md text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          {t("cohortDefinitions.auto.cancel_ea4788")}
        </button>
      </div>
    </div>
  );
}
