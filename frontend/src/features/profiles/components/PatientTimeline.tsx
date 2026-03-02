import { useState, useMemo, useRef, useCallback } from "react";
import { ChevronRight, ChevronDown as ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClinicalEvent, ClinicalDomain } from "../types/profile";

// ---------------------------------------------------------------------------
// Domain configuration
// ---------------------------------------------------------------------------

const DOMAIN_CONFIG: Record<
  ClinicalDomain,
  { label: string; color: string; order: number }
> = {
  condition: { label: "Conditions", color: "#E85A6B", order: 0 },
  drug: { label: "Drugs", color: "#2DD4BF", order: 1 },
  procedure: { label: "Procedures", color: "#C9A227", order: 2 },
  measurement: { label: "Measurements", color: "#818CF8", order: 3 },
  observation: { label: "Observations", color: "#94A3B8", order: 4 },
  visit: { label: "Visits", color: "#F59E0B", order: 5 },
};

const ALL_DOMAINS: ClinicalDomain[] = [
  "condition",
  "drug",
  "procedure",
  "measurement",
  "observation",
  "visit",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDate(d: string): number {
  return new Date(d).getTime();
}

function formatTimelineDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function formatTooltipDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PatientTimelineProps {
  events: ClinicalEvent[];
}

const LANE_HEIGHT = 28;
const EVENT_HEIGHT = 6;
const MIN_EVENT_WIDTH = 4;
const TIMELINE_PADDING = 60;
const LABEL_WIDTH = 140;

export function PatientTimeline({ events }: PatientTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [collapsedDomains, setCollapsedDomains] = useState<
    Set<ClinicalDomain>
  >(new Set());
  const [tooltip, setTooltip] = useState<{
    event: ClinicalEvent;
    x: number;
    y: number;
  } | null>(null);

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const isDragging = useRef(false);
  const dragStart = useRef(0);
  const panStart = useRef(0);

  // Group events by domain
  const domainEvents = useMemo(() => {
    const grouped: Record<ClinicalDomain, ClinicalEvent[]> = {
      condition: [],
      drug: [],
      procedure: [],
      measurement: [],
      observation: [],
      visit: [],
    };
    for (const ev of events) {
      if (grouped[ev.domain]) {
        grouped[ev.domain].push(ev);
      }
    }
    return grouped;
  }, [events]);

  // Compute time bounds
  const { timeMin, timeMax } = useMemo(() => {
    if (events.length === 0) {
      const now = Date.now();
      return { timeMin: now - 365 * 24 * 60 * 60 * 1000, timeMax: now };
    }
    let min = Infinity;
    let max = -Infinity;
    for (const ev of events) {
      const start = parseDate(ev.start_date);
      if (start < min) min = start;
      if (start > max) max = start;
      if (ev.end_date) {
        const end = parseDate(ev.end_date);
        if (end > max) max = end;
      }
    }
    // Add 5% padding
    const range = max - min || 365 * 24 * 60 * 60 * 1000;
    return { timeMin: min - range * 0.05, timeMax: max + range * 0.05 };
  }, [events]);

  const timeRange = timeMax - timeMin;

  // Active (non-collapsed) domains
  const activeDomains = useMemo(
    () =>
      ALL_DOMAINS
        .filter((d) => domainEvents[d].length > 0)
        .sort((a, b) => DOMAIN_CONFIG[a].order - DOMAIN_CONFIG[b].order),
    [domainEvents],
  );

  const toggleDomain = (domain: ClinicalDomain) => {
    setCollapsedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

  // SVG dimensions
  const svgWidth = 900;
  const chartWidth = svgWidth - LABEL_WIDTH - TIMELINE_PADDING;

  let yOffset = 30; // Space for time axis
  const lanePositions: { domain: ClinicalDomain; y: number; height: number }[] = [];
  for (const domain of activeDomains) {
    const isCollapsed = collapsedDomains.has(domain);
    const eventCount = domainEvents[domain].length;
    const rows = isCollapsed ? 0 : Math.min(Math.ceil(eventCount / 3), 8);
    const height = isCollapsed ? LANE_HEIGHT : LANE_HEIGHT + rows * (EVENT_HEIGHT + 2);
    lanePositions.push({ domain, y: yOffset, height });
    yOffset += height + 2;
  }

  const svgHeight = yOffset + 10;

  // Convert time to x position with zoom and pan
  const timeToX = useCallback(
    (t: number) => {
      const normalized = (t - timeMin) / timeRange;
      return LABEL_WIDTH + (normalized * chartWidth * zoom + panOffset);
    },
    [timeMin, timeRange, chartWidth, zoom, panOffset],
  );

  // Generate time axis ticks
  const ticks = useMemo(() => {
    const count = Math.max(4, Math.floor(chartWidth / 120));
    const result: { x: number; label: string }[] = [];
    for (let i = 0; i <= count; i++) {
      const t = timeMin + (timeRange * i) / count;
      const x = timeToX(t);
      if (x >= LABEL_WIDTH && x <= svgWidth - 10) {
        result.push({ x, label: formatTimelineDate(t) });
      }
    }
    return result;
  }, [timeMin, timeRange, timeToX, chartWidth, svgWidth]);

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.5, Math.min(10, zoom * delta));

    // Zoom toward cursor position
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const cursorX = e.clientX - rect.left - LABEL_WIDTH;
      const newPan = panOffset - cursorX * (newZoom / zoom - 1);
      setPanOffset(newPan);
    }
    setZoom(newZoom);
  };

  // Drag pan
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = e.clientX;
    panStart.current = panOffset;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current;
    setPanOffset(panStart.current + dx);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 rounded-lg border border-dashed border-[#323238] bg-[#151518]">
        <p className="text-sm text-[#8A857D]">
          No clinical events to display
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1C1C20] border-b border-[#232328]">
        <span className="text-xs text-[#8A857D]">
          {events.length} events across {activeDomains.length} domains
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPanOffset(0);
            }}
            className="text-[10px] text-[#8A857D] hover:text-[#F0EDE8] transition-colors px-2 py-1 rounded border border-[#323238]"
          >
            Reset
          </button>
          <span className="text-[10px] text-[#5A5650]">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>

      {/* SVG Timeline */}
      <div
        ref={containerRef}
        className="overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          width="100%"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="select-none"
        >
          {/* Clip path for chart area */}
          <defs>
            <clipPath id="chart-clip">
              <rect
                x={LABEL_WIDTH}
                y={0}
                width={chartWidth + TIMELINE_PADDING}
                height={svgHeight}
              />
            </clipPath>
          </defs>

          {/* Time axis */}
          <g clipPath="url(#chart-clip)">
            <line
              x1={LABEL_WIDTH}
              x2={svgWidth}
              y1={24}
              y2={24}
              stroke="#323238"
              strokeWidth={1}
            />
            {ticks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={tick.x}
                  x2={tick.x}
                  y1={20}
                  y2={28}
                  stroke="#5A5650"
                  strokeWidth={1}
                />
                <text
                  x={tick.x}
                  y={16}
                  textAnchor="middle"
                  className="fill-[#8A857D]"
                  style={{ fontSize: 9 }}
                >
                  {tick.label}
                </text>
                {/* Grid lines */}
                <line
                  x1={tick.x}
                  x2={tick.x}
                  y1={28}
                  y2={svgHeight}
                  stroke="#1C1C20"
                  strokeWidth={1}
                  strokeDasharray="2 4"
                />
              </g>
            ))}
          </g>

          {/* Swim lanes */}
          {lanePositions.map(({ domain, y, height }) => {
            const config = DOMAIN_CONFIG[domain];
            const isCollapsed = collapsedDomains.has(domain);
            const domEvts = domainEvents[domain];

            return (
              <g key={domain}>
                {/* Lane background */}
                <rect
                  x={0}
                  y={y}
                  width={svgWidth}
                  height={height}
                  fill={`${config.color}05`}
                />
                <line
                  x1={0}
                  x2={svgWidth}
                  y1={y}
                  y2={y}
                  stroke="#1C1C20"
                  strokeWidth={1}
                />

                {/* Domain label */}
                <g
                  className="cursor-pointer"
                  onClick={() => toggleDomain(domain)}
                >
                  <rect
                    x={0}
                    y={y}
                    width={LABEL_WIDTH}
                    height={LANE_HEIGHT}
                    fill="transparent"
                  />
                  {/* Collapse indicator - using simple triangle */}
                  <text
                    x={10}
                    y={y + LANE_HEIGHT / 2 + 4}
                    className="fill-[#5A5650]"
                    style={{ fontSize: 8 }}
                  >
                    {isCollapsed ? "\u25B6" : "\u25BC"}
                  </text>
                  {/* Color indicator */}
                  <rect
                    x={22}
                    y={y + LANE_HEIGHT / 2 - 4}
                    width={8}
                    height={8}
                    rx={2}
                    fill={config.color}
                  />
                  <text
                    x={36}
                    y={y + LANE_HEIGHT / 2 + 3}
                    className="fill-[#C5C0B8]"
                    style={{ fontSize: 10, fontWeight: 500 }}
                  >
                    {config.label}
                  </text>
                  <text
                    x={LABEL_WIDTH - 8}
                    y={y + LANE_HEIGHT / 2 + 3}
                    textAnchor="end"
                    className="fill-[#5A5650]"
                    style={{ fontSize: 9 }}
                  >
                    {domEvts.length}
                  </text>
                </g>

                {/* Events */}
                {!isCollapsed && (
                  <g clipPath="url(#chart-clip)">
                    {domEvts.map((ev, evIdx) => {
                      const startX = timeToX(parseDate(ev.start_date));
                      const endX = ev.end_date
                        ? timeToX(parseDate(ev.end_date))
                        : startX + MIN_EVENT_WIDTH;
                      const w = Math.max(endX - startX, MIN_EVENT_WIDTH);
                      const row = evIdx % 8;
                      const evY =
                        y +
                        LANE_HEIGHT +
                        row * (EVENT_HEIGHT + 2);

                      const isSingleDay = !ev.end_date || w <= MIN_EVENT_WIDTH;

                      return (
                        <g
                          key={evIdx}
                          onMouseEnter={(e) => {
                            const rect =
                              containerRef.current?.getBoundingClientRect();
                            if (rect) {
                              setTooltip({
                                event: ev,
                                x: e.clientX - rect.left,
                                y: e.clientY - rect.top,
                              });
                            }
                          }}
                          onMouseLeave={() => setTooltip(null)}
                          className="cursor-pointer"
                        >
                          {isSingleDay ? (
                            <circle
                              cx={startX}
                              cy={evY + EVENT_HEIGHT / 2}
                              r={EVENT_HEIGHT / 2}
                              fill={config.color}
                              opacity={0.8}
                            />
                          ) : (
                            <rect
                              x={startX}
                              y={evY}
                              width={w}
                              height={EVENT_HEIGHT}
                              rx={2}
                              fill={config.color}
                              opacity={0.7}
                            />
                          )}
                        </g>
                      );
                    })}
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-50"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 10,
          }}
        >
          <div className="rounded-lg bg-[#0E0E11] border border-[#323238] px-3 py-2 shadow-xl max-w-xs">
            <p className="text-xs font-semibold text-[#F0EDE8]">
              {tooltip.event.concept_name}
            </p>
            <div className="mt-1 space-y-0.5">
              <p className="text-[10px] text-[#8A857D]">
                <span
                  className="inline-block w-2 h-2 rounded-sm mr-1"
                  style={{
                    backgroundColor:
                      DOMAIN_CONFIG[tooltip.event.domain].color,
                  }}
                />
                {DOMAIN_CONFIG[tooltip.event.domain].label}
              </p>
              <p className="text-[10px] text-[#8A857D]">
                {formatTooltipDate(tooltip.event.start_date)}
                {tooltip.event.end_date &&
                  ` - ${formatTooltipDate(tooltip.event.end_date)}`}
              </p>
              {tooltip.event.value != null && (
                <p className="text-[10px] text-[#C9A227]">
                  Value: {tooltip.event.value}
                  {tooltip.event.unit ? ` ${tooltip.event.unit}` : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-4 py-2 border-t border-[#232328] bg-[#1C1C20]">
        {activeDomains.map((domain) => {
          const config = DOMAIN_CONFIG[domain];
          return (
            <div key={domain} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-[10px] text-[#8A857D]">
                {config.label} ({domainEvents[domain].length})
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
