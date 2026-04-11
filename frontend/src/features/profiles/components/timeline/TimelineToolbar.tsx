import { Search, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ObservationPeriod } from "../../types/profile";

interface TimelineToolbarProps {
  eventCount: number;
  activeDomainCount: number;
  observationPeriods: ObservationPeriod[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function TimelineToolbar({
  eventCount,
  activeDomainCount,
  observationPeriods,
  searchQuery,
  onSearchChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: TimelineToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-surface-overlay border-b border-border-default flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">
          {eventCount} events · {activeDomainCount} domains
        </span>
        {observationPeriods.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] bg-success/10 text-success border border-success/20">
            {observationPeriods.length} obs. period{observationPeriods.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search
            size={11}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-ghost"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Highlight events..."
            className={cn(
              "w-44 rounded-md border border-surface-highlight bg-surface-base pl-7 pr-2 py-1 text-xs",
              "text-text-primary placeholder:text-text-ghost",
              "focus:border-accent focus:outline-none",
            )}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-ghost hover:text-text-primary"
            >
              <X size={10} />
            </button>
          )}
        </div>

        {/* Zoom controls: -, percentage, +, Reset */}
        <div className="flex items-center gap-0.5 rounded-md border border-surface-highlight bg-surface-base">
          <button
            type="button"
            onClick={onZoomOut}
            disabled={zoom <= 0.5}
            className="p-1.5 text-text-muted hover:text-text-primary disabled:text-surface-highlight disabled:cursor-not-allowed transition-colors"
            title="Zoom out"
          >
            <ZoomOut size={12} />
          </button>
          <span className="text-[10px] text-text-ghost w-8 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={onZoomIn}
            disabled={zoom >= 10}
            className="p-1.5 text-text-muted hover:text-text-primary disabled:text-surface-highlight disabled:cursor-not-allowed transition-colors"
            title="Zoom in"
          >
            <ZoomIn size={12} />
          </button>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-[10px] text-text-muted hover:text-text-primary transition-colors px-2 py-1 rounded border border-surface-highlight"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
