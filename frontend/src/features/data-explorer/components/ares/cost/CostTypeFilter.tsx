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
      <div className="mb-2 rounded-lg border border-[#C9A227]/30 bg-[#C9A227]/10 px-4 py-2 text-xs text-[#C9A227]">
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
              ? "border-[#2DD4BF] bg-[#2DD4BF]/10 text-[#2DD4BF]"
              : "border-[#333] text-[#888] hover:border-[#555]"
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
                ? "border-[#2DD4BF] bg-[#2DD4BF]/10 text-[#2DD4BF]"
                : "border-[#333] text-[#888] hover:border-[#555]"
            }`}
          >
            {ct.concept_name} ({ct.record_count.toLocaleString()})
          </button>
        ))}
      </div>
    </div>
  );
}
