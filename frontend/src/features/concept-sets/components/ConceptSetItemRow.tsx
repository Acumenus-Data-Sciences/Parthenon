import { Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConceptSetItem } from "../types/conceptSet";

interface ConceptSetItemRowProps {
  item: ConceptSetItem;
  index: number;
  onToggle: (
    itemId: number,
    field: "is_excluded" | "include_descendants" | "include_mapped",
    value: boolean,
  ) => void;
  onRemove: (itemId: number) => void;
  isUpdating: boolean;
  isRemoving: boolean;
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF]/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-[#2DD4BF]" : "bg-[#323238]",
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function ConceptSetItemRow({
  item,
  index,
  onToggle,
  onRemove,
  isUpdating,
  isRemoving,
}: ConceptSetItemRowProps) {
  const concept = item.concept;
  const isStandard = concept?.standard_concept === "S";

  return (
    <tr
      className={cn(
        "border-t border-[#1C1C20] transition-colors hover:bg-[#1C1C20]",
        index % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]",
      )}
    >
      {/* Concept ID */}
      <td className="px-4 py-3 text-sm">
        <span className="font-['IBM_Plex_Mono',monospace] text-xs tabular-nums text-[#C9A227]">
          {item.concept_id}
        </span>
      </td>

      {/* Concept Name */}
      <td className="px-4 py-3 text-sm text-[#F0EDE8]">
        {concept?.concept_name ?? "--"}
      </td>

      {/* Domain */}
      <td className="px-4 py-3">
        {concept?.domain_id ? (
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#60A5FA]/15 text-[#60A5FA]">
            {concept.domain_id}
          </span>
        ) : (
          <span className="text-sm text-[#5A5650]">--</span>
        )}
      </td>

      {/* Vocabulary */}
      <td className="px-4 py-3">
        {concept?.vocabulary_id ? (
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#C9A227]/15 text-[#C9A227]">
            {concept.vocabulary_id}
          </span>
        ) : (
          <span className="text-sm text-[#5A5650]">--</span>
        )}
      </td>

      {/* Standard */}
      <td className="px-4 py-3">
        {isStandard ? (
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#2DD4BF]/15 text-[#2DD4BF]">
            Standard
          </span>
        ) : (
          <span className="text-xs text-[#5A5650]">
            {concept?.standard_concept ?? "--"}
          </span>
        )}
      </td>

      {/* Excluded */}
      <td className="px-4 py-3">
        <ToggleSwitch
          checked={item.is_excluded}
          onChange={(val) => onToggle(item.id, "is_excluded", val)}
          disabled={isUpdating}
          label="Exclude concept"
        />
      </td>

      {/* Descendants */}
      <td className="px-4 py-3">
        <ToggleSwitch
          checked={item.include_descendants}
          onChange={(val) => onToggle(item.id, "include_descendants", val)}
          disabled={isUpdating}
          label="Include descendants"
        />
      </td>

      {/* Mapped */}
      <td className="px-4 py-3">
        <ToggleSwitch
          checked={item.include_mapped}
          onChange={(val) => onToggle(item.id, "include_mapped", val)}
          disabled={isUpdating}
          label="Include mapped"
        />
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          disabled={isRemoving}
          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[#8A857D] hover:text-[#E85A6B] hover:bg-[#232328] transition-colors disabled:opacity-50"
          title="Remove item"
        >
          {isRemoving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Trash2 size={14} />
          )}
        </button>
      </td>
    </tr>
  );
}
