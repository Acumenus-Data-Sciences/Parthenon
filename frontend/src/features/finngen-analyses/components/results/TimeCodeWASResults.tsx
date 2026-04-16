// frontend/src/features/finngen-analyses/components/results/TimeCodeWASResults.tsx
import { useState } from "react";
import type { TimeCodeWASDisplay } from "../../types";
import { CodeWASResults } from "./CodeWASResults";

interface TimeCodeWASResultsProps {
  display: TimeCodeWASDisplay;
}

export function TimeCodeWASResults({ display }: TimeCodeWASResultsProps) {
  const [activeWindow, setActiveWindow] = useState(0);

  if (display.windows.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-text-ghost">
        No temporal windows in results.
      </div>
    );
  }

  const currentWindow = display.windows[activeWindow];

  // Build a CodeWASDisplay from the current window's signals
  const windowDisplay = {
    signals: currentWindow.signals,
    thresholds: {
      bonferroni: currentWindow.signals.length > 0
        ? 0.05 / currentWindow.signals.length
        : 0.05,
      suggestive: currentWindow.signals.length > 0
        ? 0.5 / currentWindow.signals.length
        : 0.5,
    },
    summary: {
      total_codes_tested: currentWindow.signals.length,
      significant_count: currentWindow.signals.filter(
        (s) => s.p_value < (currentWindow.signals.length > 0 ? 0.05 / currentWindow.signals.length : 0.05),
      ).length,
    },
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="text-xs text-text-muted">
        {display.summary.window_count} windows -- {display.summary.total_significant} total significant signals
      </div>

      {/* Window tabs */}
      <div className="flex gap-1 border-b border-border-default pb-px">
        {display.windows.map((w, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActiveWindow(idx)}
            className={[
              "px-3 py-1.5 text-xs font-medium rounded-t transition-colors",
              activeWindow === idx
                ? "text-success border-b-2 border-success"
                : "text-text-ghost hover:text-text-secondary",
            ].join(" ")}
          >
            Day {w.start_day} to {w.end_day}
          </button>
        ))}
      </div>

      {/* Reuse CodeWASResults for the active window */}
      <CodeWASResults display={windowDisplay} />
    </div>
  );
}
