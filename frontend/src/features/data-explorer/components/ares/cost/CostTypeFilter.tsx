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
  if (costTypes.length <= 1) return null;

  return (
    <div className="mb-4">
      {/* Warning banner when multiple cost types detected */}
      <div className="mb-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-xs text-accent">
        <span className="font-medium">Multiple cost types detected.</span>{" "}
        This source has {costTypes.length} different cost type concepts. Mixing charged amounts with
        paid amounts produces misleading statistics. Filter by cost type for accurate analysis.
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
          All Types
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
            {ct.concept_name} ({ct.record_count.toLocaleString()})
          </button>
        ))}
      </div>
    </div>
  );
}
