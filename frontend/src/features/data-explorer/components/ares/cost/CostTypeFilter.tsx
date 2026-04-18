import { useTranslation } from "react-i18next";
import { formatNumber } from "@/i18n/format";

interface CostTypeInfo {
  cost_type_concept_id: number;
  concept_name: string;
  record_count: number;
}

interface CostTypeFilterProps {
  costTypes: CostTypeInfo[];
  selectedTypeId: number | null;
  onSelect: (typeId: number | null) => void;
}

export default function CostTypeFilter({
  costTypes,
  selectedTypeId,
  onSelect,
}: CostTypeFilterProps) {
  const { t } = useTranslation("app");

  if (costTypes.length <= 1) return null;

  return (
    <div className="mb-4">
      {/* Warning banner when multiple cost types detected */}
      <div className="mb-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-xs text-accent">
        <span className="font-medium">
          {t("dataExplorer.ares.cost.costTypeFilter.title")}
        </span>{" "}
        {t("dataExplorer.ares.cost.costTypeFilter.message", {
          count: formatNumber(costTypes.length),
        })}
      </div>

      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            selectedTypeId === null
              ? "border-success bg-success/10 text-success"
              : "border-border-default text-text-muted hover:border-surface-highlight"
          }`}
        >
          {t("dataExplorer.ares.cost.costTypeFilter.allTypes")}
        </button>
        {costTypes.map((ct) => (
          <button
            key={ct.cost_type_concept_id}
            type="button"
            onClick={() => onSelect(ct.cost_type_concept_id)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              selectedTypeId === ct.cost_type_concept_id
                ? "border-success bg-success/10 text-success"
                : "border-border-default text-text-muted hover:border-surface-highlight"
            }`}
          >
            {t("dataExplorer.ares.cost.costTypeFilter.option", {
              name: ct.concept_name,
              count: formatNumber(ct.record_count),
            })}
          </button>
        ))}
      </div>
    </div>
  );
}
