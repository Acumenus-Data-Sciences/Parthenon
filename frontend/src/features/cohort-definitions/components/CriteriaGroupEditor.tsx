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
      ? "border-border-default"
      : depth === 1
        ? "border-success/20"
        : "border-accent/20";

  return (
    <div
      className={cn(
        "rounded-lg border p-4 space-y-3",
        borderColor,
        depth === 0 ? "bg-surface-raised" : "bg-surface-overlay",
      )}
    >
      {/* Group type selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">Match</span>
        {GROUP_TYPES.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleTypeChange(opt.value)}
            title={opt.desc}
            className={cn(
              "rounded-lg px-3 py-1 text-xs font-semibold transition-colors",
              group.Type === opt.value
                ? "bg-success/15 text-success border border-success/30"
                : "bg-surface-base text-text-ghost border border-border-default hover:text-text-muted",
            )}
          >
            {opt.label}
          </button>
        ))}
        <span className="text-xs text-text-muted">of the following:</span>
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
                className="absolute top-2 right-2 text-xs text-text-muted hover:text-critical transition-colors"
              >
                Remove group
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {(group.CriteriaList ?? []).length === 0 && (group.Groups ?? []).length === 0 && (
        <div className="flex items-center justify-center py-6 text-xs text-text-ghost">
          No criteria in this group. Add rules or nested groups below.
        </div>
      )}

      {/* Add buttons */}
      {depth < 2 && (
        <div className="flex items-center gap-2 pt-2 border-t border-border-default">
          <button
            type="button"
            onClick={handleAddNestedGroup}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary hover:bg-surface-overlay transition-colors"
          >
            <Plus size={12} />
            Add Nested Group
          </button>
        </div>
      )}
    </div>
  );
}
