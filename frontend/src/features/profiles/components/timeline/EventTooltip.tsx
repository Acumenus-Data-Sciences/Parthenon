import type { ClinicalEvent } from "../../types/profile";
import { DOMAIN_CONFIG, formatTooltipDate, formatDuration, getTimelineDomainLabel } from "../../lib/timeline-utils";

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
      <div className="rounded-lg bg-surface-base border border-surface-highlight px-3 py-2 shadow-xl" style={{ maxWidth: TOOLTIP_W }}>
        <p className="text-xs font-semibold text-text-primary">
          {ev.concept_name}
        </p>
        <div className="mt-1 space-y-0.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] text-text-muted">
              <span
                className="inline-block w-2 h-2 rounded-sm mr-1"
                style={{ backgroundColor: DOMAIN_CONFIG[ev.domain].color }}
              />
              {getTimelineDomainLabel(ev.domain)}
            </p>
            {ev.concept_id != null && (
              <p className="text-[10px] text-text-disabled font-mono tabular-nums">
                #{ev.concept_id}
              </p>
            )}
          </div>
          <p className="text-[10px] text-text-muted">
            {formatTooltipDate(ev.start_date)}
            {ev.end_date && ev.end_date !== ev.start_date &&
              ` \u2013 ${formatTooltipDate(ev.end_date)}`}
            {duration && (
              <span className="ml-1 text-text-ghost">({duration})</span>
            )}
          </p>
          {ev.value != null && (
            <p className="text-[10px] text-accent">
              {String(ev.value)}
              {ev.unit ? ` ${ev.unit}` : ""}
            </p>
          )}
          {ev.vocabulary && (
            <p className="text-[10px] text-text-ghost">
              {ev.vocabulary}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
