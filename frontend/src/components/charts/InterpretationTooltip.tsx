import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InterpretationTooltipProps {
  metric: string;
  plain: string;
  technical: string;
  className?: string;
}

export function InterpretationTooltip({
  metric,
  plain,
  technical,
  className,
}: InterpretationTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center text-[#8A857D] transition-colors hover:text-[#C5C0B8]"
        aria-label={`What does ${metric} mean?`}
        data-testid="interpretation-tooltip-trigger"
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {open && (
        <div
          data-testid="interpretation-tooltip-popover"
          className="absolute left-6 top-0 z-50 w-64 rounded-lg border border-[#323238] bg-[#1A1A1E] px-3 py-2 shadow-lg"
        >
          <p className="text-xs font-semibold text-[#F0EDE8]">{metric}</p>
          <p className="mt-1 text-xs text-[#C5C0B8]">{plain}</p>
          <p className="mt-1 text-xs italic text-[#8A857D]">{technical}</p>
        </div>
      )}
    </span>
  );
}
