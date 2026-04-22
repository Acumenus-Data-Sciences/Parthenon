import { Trash2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { ConceptSetItem } from "../types/conceptSet";

interface ConceptSetItemRowProps {
  item: ConceptSetItem;
  index: number;
  isSelected?: boolean;
  isHighlighted?: boolean;
  onSelectionChange?: (itemId: number) => void;
  onRowClick?: () => void;
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-success" : "bg-surface-highlight",
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
  isSelected,
  isHighlighted,
  onSelectionChange,
  onRowClick,
  onToggle,
  onRemove,
  isUpdating,
  isRemoving,
}: ConceptSetItemRowProps) {
  const { t } = useTranslation("app");
  const concept = item.concept;
  const isStandard = concept?.standard_concept === "S";

  return (
    <tr
      onClick={onRowClick}
      className={cn(
        "border-t border-border-subtle transition-colors hover:bg-surface-overlay cursor-pointer",
        index % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay",
        isSelected && "bg-success/5",
        isHighlighted && "border-l-2 border-l-success",
      )}
    >
      {/* Checkbox */}
      <td className="px-3 py-3">
        <input
          type="checkbox"
          checked={isSelected ?? false}
          onChange={() => onSelectionChange?.(item.id)}
          className="h-3.5 w-3.5 rounded border-surface-highlight bg-surface-base text-success focus:ring-success/40 cursor-pointer"
        />
      </td>

      {/* Concept ID */}
      <td className="px-4 py-3 text-sm">
        <span className="font-['IBM_Plex_Mono',monospace] text-xs tabular-nums text-accent">
          {item.concept_id}
        </span>
      </td>

      {/* Concept Name */}
      <td className="px-4 py-3 text-sm text-text-primary">
        {concept?.concept_name ?? "--"}
      </td>

      {/* Domain */}
      <td className="px-4 py-3">
        {concept?.domain_id ? (
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-info/15 text-info">
            {concept.domain_id}
          </span>
        ) : (
          <span className="text-sm text-text-ghost">--</span>
        )}
      </td>

      {/* Vocabulary */}
      <td className="px-4 py-3">
        {concept?.vocabulary_id ? (
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-accent/15 text-accent">
            {concept.vocabulary_id}
          </span>
        ) : (
          <span className="text-sm text-text-ghost">--</span>
        )}
      </td>

      {/* Standard */}
      <td className="px-4 py-3">
        {isStandard ? (
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-success/15 text-success">
            {t("conceptSets.detailTabs.labels.standard")}
          </span>
        ) : (
          <span className="text-xs text-text-ghost">
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
          label={t("conceptSets.editor.toggleLabels.excludeConcept")}
        />
      </td>

      {/* Descendants */}
      <td className="px-4 py-3">
        <ToggleSwitch
          checked={item.include_descendants}
          onChange={(val) => onToggle(item.id, "include_descendants", val)}
          disabled={isUpdating}
          label={t("conceptSets.editor.toggleLabels.includeDescendants")}
        />
      </td>

      {/* Mapped */}
      <td className="px-4 py-3">
        <ToggleSwitch
          checked={item.include_mapped}
          onChange={(val) => onToggle(item.id, "include_mapped", val)}
          disabled={isUpdating}
          label={t("conceptSets.editor.toggleLabels.includeMapped")}
        />
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          disabled={isRemoving}
          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-critical hover:bg-surface-elevated transition-colors disabled:opacity-50"
          title={t("conceptSets.editor.toggleLabels.removeItem")}
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
