import { useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface InterpretationTooltipProps {
  text: string;
  className?: string;
}

export function InterpretationTooltip({ text, className }: InterpretationTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className={cn("relative inline-block", className)}>
      <button
        type="button"
        className="text-[#5A5650] hover:text-[#8A857D] transition-colors"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label="More information"
        data-testid="interpretation-tooltip-trigger"
      >
        <Info size={14} />
      </button>
      {open && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg border border-[#232328] bg-[#1C1C20] px-3 py-2 text-xs text-[#C5C0B8] shadow-lg z-50"
          role="tooltip"
          data-testid="interpretation-tooltip-content"
        >
          {text}
        </span>
      )}
    </span>
  );
}
