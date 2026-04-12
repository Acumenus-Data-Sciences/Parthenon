import { useState } from "react";
import { formatCompact, TOOLTIP_CLS } from "./chartUtils";

interface Segment {
  label: string;
  value: number;
  color: string;
}

interface ProportionalBarProps {
  segments: Segment[];
  height?: number;
  showLabels?: boolean;
}

export function ProportionalBar({
  segments,
  height = 32,
  showLabels = true,
}: ProportionalBarProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;

  return (
    <div>
      {/* Bar */}
      <div
        className="relative flex overflow-hidden rounded-lg"
        style={{ height }}
      >
        {segments.map((seg, i) => {
          const pct = (seg.value / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={seg.label}
              className="relative transition-opacity"
              style={{
                width: `${pct}%`,
                backgroundColor: seg.color,
                opacity: hovered === null || hovered === i ? 1 : 0.4,
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Inline percentage if wide enough */}
              {pct > 12 && (
                <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-[#0E0E11]">
                  {pct.toFixed(1)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {hovered !== null && (
        <div className={`${TOOLTIP_CLS} mt-2 inline-block`}>
          <span className="text-xs" style={{ color: segments[hovered].color }}>
            {segments[hovered].label}
          </span>
          <span className="ml-2 font-['IBM_Plex_Mono',monospace] text-xs text-[#F0EDE8]">
            {formatCompact(segments[hovered].value)} (
            {((segments[hovered].value / total) * 100).toFixed(1)}%)
          </span>
        </div>
      )}

      {/* Legend */}
      {showLabels && hovered === null && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {segments.map((seg) => {
            const pct = (seg.value / total) * 100;
            return (
              <div key={seg.label} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-xs text-[#C5C0B8]">
                  {seg.label}: {formatCompact(seg.value)} ({pct.toFixed(1)}%)
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
