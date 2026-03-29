import { useState } from "react";
import { Activity, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSourceStore } from "@/stores/sourceStore";
import {
  useAllRiskScoreAnalyses,
  useRiskScoreCatalogue,
} from "@/features/risk-scores/hooks/useRiskScores";
import type { RiskScoreCriterion } from "../types/cohortExpression";

const OPERATORS = [
  { value: "gte", label: "\u2265", sqlLabel: "greater than or equal to" },
  { value: "gt", label: ">", sqlLabel: "greater than" },
  { value: "lte", label: "\u2264", sqlLabel: "less than or equal to" },
  { value: "lt", label: "<", sqlLabel: "less than" },
  { value: "eq", label: "=", sqlLabel: "equal to" },
] as const;

const TIERS = [
  { value: "low", label: "Low" },
  { value: "intermediate", label: "Intermediate" },
  { value: "high", label: "High" },
  { value: "very_high", label: "Very High" },
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
  const { activeSourceId, defaultSourceId } = useSourceStore();
  const sourceId = activeSourceId ?? defaultSourceId ?? 0;

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
        : `${scoreName} \u2014 ${TIERS.find((t) => t.value === tier)?.label ?? tier} Risk`;

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
    <div className="space-y-4 rounded-lg border border-[#9B1B30]/30 bg-[#9B1B30]/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-[#E85A6B]">
        <Activity size={14} />
        Add Risk Score Criterion
      </div>

      {/* Analysis selector */}
      <div>
        <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider mb-1">
          Risk Score Analysis
        </label>
        {loadingAnalyses ? (
          <Loader2 size={14} className="animate-spin text-[#8A857D]" />
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
            <option value="">Select analysis...</option>
            {(allAnalyses?.data ?? []).map((a: { id: number; name: string; design_json: { scoreIds: string[] } }) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.design_json.scoreIds.length} scores)
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Score selector */}
      {selectedAnalysisId && scoreIds.length > 0 && (
        <div>
          <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider mb-1">
            Score
          </label>
          <select
            value={selectedScoreId}
            onChange={(e) => setSelectedScoreId(e.target.value)}
            className="form-input w-full text-sm"
          >
            <option value="">Select score...</option>
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
            <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider mb-1">
              Filter By
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterMode("value")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                  filterMode === "value"
                    ? "bg-[#9B1B30]/20 border-[#9B1B30]/40 text-[#E85A6B]"
                    : "border-[#232328] text-[#8A857D] hover:text-[#C5C0B8]",
                )}
              >
                Score Value
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("tier")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                  filterMode === "tier"
                    ? "bg-[#9B1B30]/20 border-[#9B1B30]/40 text-[#E85A6B]"
                    : "border-[#232328] text-[#8A857D] hover:text-[#C5C0B8]",
                )}
              >
                Risk Tier
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
                placeholder="Threshold"
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
              <option value="">Select tier...</option>
              {TIERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          )}

          {/* Exclude toggle */}
          <label className="flex items-center gap-2 text-xs text-[#8A857D]">
            <input
              type="checkbox"
              checked={exclude}
              onChange={(e) => setExclude(e.target.checked)}
              className="rounded border-[#323238]"
            />
            Exclude patients matching this criterion
          </label>
        </>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-[#232328]">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="flex items-center gap-1.5 rounded-md bg-[#9B1B30] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#B42240] disabled:opacity-40 transition-colors"
        >
          <CheckCircle2 size={12} />
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-md text-xs text-[#8A857D] hover:text-[#C5C0B8] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
