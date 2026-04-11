import { useState, useEffect, useRef, useCallback } from "react";
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
  const containerRef = useRef<HTMLSpanElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, close]);

  return (
    <span ref={containerRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center text-text-muted transition-colors hover:text-text-secondary"
        aria-label={`What does ${metric} mean?`}
        data-testid="interpretation-tooltip-trigger"
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {open && (
        <div
          data-testid="interpretation-tooltip-popover"
          className="absolute left-6 top-0 z-50 w-64 rounded-lg border border-surface-highlight bg-surface-overlay px-3 py-2 shadow-lg"
        >
          <p className="text-xs font-semibold text-text-primary">{metric}</p>
          <p className="mt-1 text-xs text-text-secondary">{plain}</p>
          <p className="mt-1 text-xs italic text-text-muted">{technical}</p>
        </div>
      )}
    </span>
  );
}
