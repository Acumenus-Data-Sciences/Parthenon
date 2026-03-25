import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
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
        "relative flex items-center gap-2 px-3 py-1.5 text-sm border-b border-[#1a1a2e]",
        borderIndicator,
        required && !isMapped && "bg-red-950/20",
      )}
    >
      {side === "target" && (
        <Handle
          type="target"
          position={Position.Left}
          id={name}
          className="!w-2.5 !h-2.5 !bg-[#2DD4BF]"
        />
      )}

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
      </div>

      {side === "source" && (
        <Handle
          type="source"
          position={Position.Right}
          id={name}
          className="!w-2.5 !h-2.5 !bg-[#C9A227]"
        />
      )}
    </div>
  );
}

export const FieldRow = memo(FieldRowComponent);
