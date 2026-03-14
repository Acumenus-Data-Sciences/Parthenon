import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { InclusionRuleEditor } from "./InclusionRuleEditor";
import type {
  CriteriaGroup,
  WindowedCriteria,
} from "../types/cohortExpression";

interface CriteriaGroupEditorProps {
  group: CriteriaGroup;
  onChange: (group: CriteriaGroup) => void;
  depth?: number;
}

const GROUP_TYPES = [
  { value: "ALL", label: "ALL", desc: "All criteria must be satisfied" },
  { value: "ANY", label: "ANY", desc: "At least one criterion must be satisfied" },
  {
    value: "AT_MOST_0",
    label: "NONE",
    desc: "No criteria may be satisfied",
  },
] as const;

export function CriteriaGroupEditor({
  group,
  onChange,
  depth = 0,
}: CriteriaGroupEditorProps) {
  const handleTypeChange = (type: CriteriaGroup["Type"]) => {
    onChange({ ...group, Type: type });
  };

  const handleRuleChange = (index: number, rule: WindowedCriteria) => {
    const updated = [...group.CriteriaList];
    updated[index] = rule;
    onChange({ ...group, CriteriaList: updated });
  };

  const handleRuleRemove = (index: number) => {
    onChange({
      ...group,
      CriteriaList: group.CriteriaList.filter((_, i) => i !== index),
    });
  };

  const handleNestedGroupChange = (index: number, nested: CriteriaGroup) => {
    const updated = [...group.Groups];
    updated[index] = nested;
    onChange({ ...group, Groups: updated });
  };

  const handleNestedGroupRemove = (index: number) => {
    onChange({
      ...group,
      Groups: group.Groups.filter((_, i) => i !== index),
    });
  };

  const handleAddNestedGroup = () => {
    onChange({
      ...group,
      Groups: [
        ...group.Groups,
        { Type: "ALL", CriteriaList: [], Groups: [] },
      ],
    });
  };

  const borderColor =
    depth === 0
      ? "border-[#232328]"
      : depth === 1
        ? "border-[#2DD4BF]/20"
        : "border-[#C9A227]/20";

  return (
    <div
      className={cn(
        "rounded-lg border p-4 space-y-3",
        borderColor,
        depth === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]",
      )}
    >
      {/* Group type selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#8A857D]">Match</span>
        {GROUP_TYPES.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleTypeChange(opt.value)}
            title={opt.desc}
            className={cn(
              "rounded-lg px-3 py-1 text-xs font-semibold transition-colors",
              group.Type === opt.value
                ? "bg-[#2DD4BF]/15 text-[#2DD4BF] border border-[#2DD4BF]/30"
                : "bg-[#0E0E11] text-[#5A5650] border border-[#232328] hover:text-[#8A857D]",
            )}
          >
            {opt.label}
          </button>
        ))}
        <span className="text-xs text-[#8A857D]">of the following:</span>
      </div>

      {/* Criteria list */}
      {(group.CriteriaList ?? []).length > 0 && (
        <div className="space-y-2">
          {(group.CriteriaList ?? []).map((rule, i) => (
            <InclusionRuleEditor
              key={i}
              rule={rule}
              index={i}
              onChange={(r) => handleRuleChange(i, r)}
              onRemove={() => handleRuleRemove(i)}
            />
          ))}
        </div>
      )}

      {/* Nested groups */}
      {(group.Groups ?? []).length > 0 && (
        <div className="space-y-2">
          {(group.Groups ?? []).map((nested, i) => (
            <div key={i} className="relative">
              <CriteriaGroupEditor
                group={nested}
                onChange={(g) => handleNestedGroupChange(i, g)}
                depth={depth + 1}
              />
              <button
                type="button"
                onClick={() => handleNestedGroupRemove(i)}
                className="absolute top-2 right-2 text-xs text-[#8A857D] hover:text-[#E85A6B] transition-colors"
              >
                Remove group
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {(group.CriteriaList ?? []).length === 0 && (group.Groups ?? []).length === 0 && (
        <div className="flex items-center justify-center py-6 text-xs text-[#5A5650]">
          No criteria in this group. Add rules or nested groups below.
        </div>
      )}

      {/* Add buttons */}
      {depth < 2 && (
        <div className="flex items-center gap-2 pt-2 border-t border-[#232328]">
          <button
            type="button"
            onClick={handleAddNestedGroup}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-1.5 text-xs text-[#8A857D] hover:text-[#C5C0B8] hover:bg-[#1C1C20] transition-colors"
          >
            <Plus size={12} />
            Add Nested Group
          </button>
        </div>
      )}
    </div>
  );
}
