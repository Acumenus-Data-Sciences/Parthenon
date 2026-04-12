import type { ClinicalEvent } from "../../types/profile";
import { DOMAIN_CONFIG, formatTooltipDate, formatDuration } from "../../lib/timeline-utils";

interface EventTooltipProps {
  event: ClinicalEvent;
  x: number;
  y: number;
  containerWidth: number;
}

const TOOLTIP_W = 260;
const TOOLTIP_OFFSET = 14;

export function EventTooltip({ event: ev, x, y, containerWidth }: EventTooltipProps) {
  const leftPos = x + TOOLTIP_OFFSET + TOOLTIP_W > containerWidth
    ? x - TOOLTIP_W - TOOLTIP_OFFSET
    : x + TOOLTIP_OFFSET;
  const duration = ev.end_date && ev.end_date !== ev.start_date
    ? formatDuration(ev.start_date, ev.end_date)
    : null;

  return (
    <div
      className="absolute pointer-events-none z-50"
      style={{ left: Math.max(4, leftPos), top: y - 10 }}
    >
      <div className="rounded-lg bg-[#0E0E11] border border-[#323238] px-3 py-2 shadow-xl" style={{ maxWidth: TOOLTIP_W }}>
        <p className="text-xs font-semibold text-[#F0EDE8]">
          {ev.concept_name}
        </p>
        <div className="mt-1 space-y-0.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] text-[#8A857D]">
              <span
                className="inline-block w-2 h-2 rounded-sm mr-1"
                style={{ backgroundColor: DOMAIN_CONFIG[ev.domain].color }}
              />
              {DOMAIN_CONFIG[ev.domain].label}
            </p>
            {ev.concept_id != null && (
              <p className="text-[10px] text-[#3A3A40] font-mono tabular-nums">
                #{ev.concept_id}
              </p>
            )}
          </div>
          <p className="text-[10px] text-[#8A857D]">
            {formatTooltipDate(ev.start_date)}
            {ev.end_date && ev.end_date !== ev.start_date &&
              ` \u2013 ${formatTooltipDate(ev.end_date)}`}
            {duration && (
              <span className="ml-1 text-[#5A5650]">({duration})</span>
            )}
          </p>
          {ev.value != null && (
            <p className="text-[10px] text-[#C9A227]">
              {String(ev.value)}
              {ev.unit ? ` ${ev.unit}` : ""}
            </p>
          )}
          {ev.vocabulary && (
            <p className="text-[10px] text-[#5A5650]">
              {ev.vocabulary}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
