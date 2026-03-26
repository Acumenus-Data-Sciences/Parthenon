import { memo } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FieldRowProps {
  name: string;
  type: string;
  side: "source" | "target";
  isMapped: boolean;
  isReviewed?: boolean;
  required?: boolean;
  nullPct?: number;
  distinctCount?: number;
  isDragSource?: boolean;
  isDropTarget?: boolean;
  isDropHighlighted?: boolean;
  isDragging?: boolean;
  hint?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function FieldRowComponent({
  name,
  type,
  side,
  isMapped,
  isReviewed,
  required,
  nullPct,
  distinctCount,
  isDragSource,
  isDropHighlighted,
  isDragging,
  hint,
}: FieldRowProps) {
  const borderIndicator =
    side === "target" && isMapped && isReviewed
      ? "border-l-2 border-l-green-500"
      : side === "target" && isMapped && !isReviewed
        ? "border-l-2 border-l-amber-500"
        : side === "source" && isMapped
          ? "border-r-2 border-r-teal-500"
          : "";

  return (
    <div
      className={cn(
        "relative flex items-center gap-2 px-3 py-1.5 text-sm border-b border-[#2A2A30]/40",
        borderIndicator,
        required && !isMapped && "bg-red-950/20",
        isDropHighlighted && "ring-1 ring-[#2DD4BF] bg-[#2DD4BF]/5",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white truncate">{name}</span>
          {required && !isMapped && (
            <span className="text-red-400 text-xs">*</span>
          )}
          <span className="text-[10px] px-1 py-0.5 rounded bg-gray-800 text-gray-400">
            {type}
          </span>
        </div>
        {side === "source" && nullPct !== undefined && (
          <div className="text-[10px] text-gray-500 mt-0.5">
            null: {nullPct}% &bull; {distinctCount ?? 0} distinct
          </div>
        )}
        {hint && (
          <div className="text-[10px] text-gray-600 italic mt-0.5">
            {hint}
          </div>
        )}
      </div>

      {isDragSource && (
        <GripVertical className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
      )}
    </div>
  );
}

export const FieldRow = memo(FieldRowComponent);
